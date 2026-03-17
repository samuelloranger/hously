import type { Job } from 'bullmq';
import type { ResolvedReleaseSource } from '../c411/prepare-release';

export interface C411PrepareJobData {
  releaseId: number;
  source: ResolvedReleaseSource;
  requestedByUserId?: number;
}

export async function processC411PrepareJob(job: Job<C411PrepareJobData>) {
  const { releaseId, source, requestedByUserId } = job.data;
  
  const { processQueuedPrepareRelease } = await import('../c411/prepare-release');
  
  console.log(`[C411Worker] Processing prepare for release ${releaseId}`);
  
  try {
    await processQueuedPrepareRelease(releaseId, source, requestedByUserId);
    return { success: true };
  } catch (error) {
    console.error(`[C411Worker] Failed to prepare release ${releaseId}:`, error);
    throw error;
  }
}
