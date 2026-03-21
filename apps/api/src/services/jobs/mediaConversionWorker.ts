import { spawn } from 'node:child_process';
import { mkdir, unlink, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import type { Job } from 'bullmq';
import { prisma } from '../../db';
import { sendConversionLiveActivityUpdatePush } from '../../utils/apnLiveActivity';

export interface MediaConversionJobData {
  jobId: number;
}

export async function processMediaConversionJob(job: Job<MediaConversionJobData>) {
  const { jobId } = job.data;
  
  // We need to import the utilities from mediaConversions.ts
  // To avoid circular dependencies, we might need to refactor them out later.
  // For now, let's assume they are exported.
  const { 
    getPresetOrThrow, 
    buildFfmpegArgs, 
    updateJobProgress,
    createLocalC411ReleaseFromConversion
  } = await import('../mediaConversions');

  const jobRecord = await prisma.mediaConversionJob.findUnique({ where: { id: jobId } });
  if (!jobRecord) throw new Error(`Job ${jobId} not found`);
  
  if (jobRecord.status === 'completed') return { success: true, message: 'Already completed' };

  const preset = getPresetOrThrow(jobRecord.preset);
  await mkdir(dirname(jobRecord.outputPath), { recursive: true });

  // Remove stale output file if it exists (e.g. from a previous failed attempt)
  try {
    await access(jobRecord.outputPath);
    await unlink(jobRecord.outputPath);
    console.log(`[MediaWorker:${jobId}] Removed stale output file: ${jobRecord.outputPath}`);
  } catch {
    // File doesn't exist, nothing to do
  }

  await prisma.mediaConversionJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      progress: 0,
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  console.log(`[MediaWorker] Starting conversion for job ${jobId}: ${jobRecord.sourceTitle}`);

  const validationSummary = jobRecord.validationSummary as { source?: { hdr?: boolean } } | null;
  const ffmpegArgs = buildFfmpegArgs({
    inputPath: jobRecord.inputPath,
    outputPath: jobRecord.outputPath,
    preset,
    sourceHdr: validationSummary?.source?.hdr ?? false,
  });

  const proc = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const progressState: Record<string, string> = {};
  const stderrTail: string[] = [];
  let lastPersistAt = 0;
  let lastPushAt = 0;

  return new Promise((resolve, reject) => {
    createInterface({ input: proc.stdout! }).on('line', async (line) => {
      const separator = line.indexOf('=');
      if (separator <= 0) return;
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1);
      progressState[key] = value;

      const now = Date.now();
      const isEnd = value === 'end';

      // Update DB progress every 2 seconds or at the end
      if (isEnd || now - lastPersistAt > 2000) {
        lastPersistAt = now;
        try {
          await updateJobProgress(jobId, jobRecord.durationSeconds, progressState, isEnd);
          // Also update BullMQ progress
          const progress = parseInt(progressState.progress || '0');
          if (!isNaN(progress)) await job.updateProgress(progress);
        } catch (err) {
          console.warn(`[MediaWorker:${jobId}] Failed to update progress:`, err);
        }

        // Send Live Activity push update every ~15 seconds (not at the end — handled in close)
        if (!isEnd && now - lastPushAt > 15000) {
          lastPushAt = now;
          prisma.mediaConversionJob.findUnique({
            where: { id: jobId },
            select: { activityPushToken: true, etaSeconds: true, speed: true, progress: true },
          }).then(fresh => {
            if (fresh?.activityPushToken) {
              sendConversionLiveActivityUpdatePush(fresh.activityPushToken, {
                status: 'running',
                progress: fresh.progress ?? 0,
                etaSeconds: fresh.etaSeconds ?? null,
                speed: fresh.speed ?? null,
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      }
    });

    createInterface({ input: proc.stderr! }).on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      stderrTail.push(trimmed);
      if (stderrTail.length > 20) stderrTail.shift();
    });

    proc.on('error', async (err) => {
      console.error(`[MediaWorker:${jobId}] Process error:`, err);
      await prisma.mediaConversionJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: err.message,
          completedAt: new Date(),
        },
      });
      reject(err);
    });

    proc.on('close', async (code) => {
      if (code === 0) {
        console.log(`[MediaWorker:${jobId}] Conversion successful`);
        
        try {
          if (jobRecord.service === 'radarr') {
            await createLocalC411ReleaseFromConversion({
              service: 'radarr',
              sourceId: jobRecord.sourceId,
              preset: jobRecord.preset,
              inputPath: jobRecord.inputPath,
              outputPath: jobRecord.outputPath,
              conversionJobId: jobId,
            });
          }
          
          await prisma.mediaConversionJob.update({
            where: { id: jobId },
            data: {
              status: 'completed',
              progress: 100,
              completedAt: new Date(),
            },
          });

          // End the Live Activity on iOS
          const completedJob = await prisma.mediaConversionJob.findUnique({
            where: { id: jobId },
            select: { activityPushToken: true },
          });
          if (completedJob?.activityPushToken) {
            await sendConversionLiveActivityUpdatePush(completedJob.activityPushToken, {
              status: 'completed',
              progress: 100,
              etaSeconds: null,
              speed: null,
            }, true).catch(() => {});
          }

          resolve({ success: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Post-conversion failed';
          await prisma.mediaConversionJob.update({
            where: { id: jobId },
            data: {
              status: 'failed',
              errorMessage: `Post-conversion failed: ${msg}`,
              completedAt: new Date(),
            },
          });
          reject(err);
        }
      } else {
        const errorMsg = stderrTail.slice(-3).join(' | ') || `ffmpeg exited with code ${code}`;
        console.error(`[MediaWorker:${jobId}] Conversion failed: ${errorMsg}`);
        await prisma.mediaConversionJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            errorMessage: errorMsg,
            completedAt: new Date(),
          },
        });

        // End the Live Activity on iOS with failed status
        const failedJob = await prisma.mediaConversionJob.findUnique({
          where: { id: jobId },
          select: { activityPushToken: true },
        });
        if (failedJob?.activityPushToken) {
          await sendConversionLiveActivityUpdatePush(failedJob.activityPushToken, {
            status: 'failed',
            progress: 0,
            etaSeconds: null,
            speed: null,
          }, true).catch(() => {});
        }

        reject(new Error(errorMsg));
      }
    });
  });
}
