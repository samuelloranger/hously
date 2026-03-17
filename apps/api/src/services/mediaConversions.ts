import { access, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, extname, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { enqueueTask } from './backgroundQueue';
import { normalizeRadarrConfig } from '../utils/plugins/normalizers';
import { createLocalC411ReleaseFromConversion } from './c411/local-release';

type MediaService = 'radarr' | 'sonarr';
type MediaConversionStatus = 'queued' | 'running' | 'completed' | 'failed';

type MediaConversionPreset = {
  key: string;
  label: string;
  description: string;
  output_extension: 'mkv' | 'mp4';
  target_height: number | null;
  target_video_codec: 'hevc' | 'h264';
  crf: number;
  ffmpeg_preset: string;
  copy_audio: boolean;
  copy_subtitles: boolean;
};

type MediaConversionSourceInfo = {
  file_size_bytes: number;
  duration_seconds: number | null;
  container: string | null;
  video_codec: string | null;
  width: number | null;
  height: number | null;
  pix_fmt: string | null;
  hdr: boolean;
  dolby_vision: boolean;
  audio_streams: number;
  subtitle_streams: number;
};

type MediaConversionValidation = {
  can_convert: boolean;
  reasons: string[];
  warnings: string[];
  input_path: string;
  output_path: string;
  source: MediaConversionSourceInfo;
};

type RadarrMovie = {
  id: number;
  title?: string | null;
  hasFile?: boolean | null;
  movieFile?: {
    path?: string | null;
    relativePath?: string | null;
    size?: number | null;
  } | null;
};

type ProbeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  color_transfer?: string;
  color_space?: string;
  codec_tag_string?: string;
  side_data_list?: Array<{ side_data_type?: string }>;
};

type ProbeResult = {
  format?: {
    format_name?: string;
    duration?: string;
  };
  streams?: ProbeStream[];
};

type ResolvedSource = {
  service: MediaService;
  sourceId: number;
  sourceTitle: string;
  inputPath: string;
};

type MediaConversionJobRecord = Awaited<ReturnType<typeof prisma.mediaConversionJob.findUnique>>;

const HOST_STORAGE_PREFIX = '/mnt/storage/';
const SUPPORTED_INPUT_EXTENSIONS = new Set(['.mkv', '.mp4', '.m4v', '.mov']);
const ACTIVE_STATUSES: MediaConversionStatus[] = ['queued', 'running'];

const MEDIA_CONVERSION_PRESETS: MediaConversionPreset[] = [
  {
    key: 'hevc_1080p',
    label: 'HEVC 1080p',
    description: 'Downscale to 1080p H.265 while copying all audio and subtitle streams.',
    output_extension: 'mkv',
    target_height: 1080,
    target_video_codec: 'hevc',
    crf: 22,
    ffmpeg_preset: 'medium',
    copy_audio: true,
    copy_subtitles: true,
  },
  {
    key: 'h264_to_h265',
    label: 'H.264 to H.265',
    description: 'Re-encode an H.264 source to H.265 without changing the resolution.',
    output_extension: 'mkv',
    target_height: null,
    target_video_codec: 'hevc',
    crf: 22,
    ffmpeg_preset: 'medium',
    copy_audio: true,
    copy_subtitles: true,
  },
  {
    key: 'h264_1080p_compat',
    label: 'H.264 1080p',
    description: 'Downscale to 1080p H.264 for compatibility while copying audio and subtitles.',
    output_extension: 'mkv',
    target_height: 1080,
    target_video_codec: 'h264',
    crf: 20,
    ffmpeg_preset: 'medium',
    copy_audio: true,
    copy_subtitles: true,
  },
];

let workerScheduled = false;

const clampProgress = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const fileExists = async (candidate: string): Promise<boolean> => {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
};

const remapArrPath = (contentPath: string) => contentPath.replace(/^\/data\//, HOST_STORAGE_PREFIX);

function getPresetOrThrow(key: string): MediaConversionPreset {
  const preset = MEDIA_CONVERSION_PRESETS.find((entry) => entry.key === key);
  if (!preset) throw new Error(`Unknown conversion preset: ${key}`);
  return preset;
}

async function loadRadarrMovie(sourceId: number): Promise<RadarrMovie> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'radarr', enabled: true },
    select: { config: true },
  });

  if (!plugin?.config) throw new Error('Radarr plugin is not configured');
  const config = normalizeRadarrConfig(plugin.config);
  if (!config) throw new Error('Radarr plugin is not configured');

  const url = new URL(`/api/v3/movie/${sourceId}`, config.website_url);
  const response = await fetch(url.toString(), {
    headers: {
      'X-Api-Key': config.api_key,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Radarr request failed with status ${response.status}`);
  }

  return response.json() as Promise<RadarrMovie>;
}

async function resolveMovieSource(sourceId: number): Promise<ResolvedSource> {
  const movie = await loadRadarrMovie(sourceId);
  if (!movie?.id || !movie.title) {
    throw new Error('Radarr movie not found');
  }
  if (!movie.hasFile || !movie.movieFile?.path) {
    throw new Error('This Radarr movie does not have a local file to convert');
  }

  const candidates = [movie.movieFile.path, remapArrPath(movie.movieFile.path)];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return {
        service: 'radarr',
        sourceId,
        sourceTitle: movie.title,
        inputPath: candidate,
      };
    }
  }

  throw new Error(`Could not access the Radarr file on disk: ${movie.movieFile.path}`);
}

async function resolveSource(service: MediaService, sourceId: number): Promise<ResolvedSource> {
  if (service === 'radarr') return resolveMovieSource(sourceId);
  throw new Error('Sonarr conversion is not implemented yet');
}

async function runProbe(inputPath: string): Promise<ProbeResult> {
  const proc = spawn('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const readStream = async (stream: NodeJS.ReadableStream | null | undefined) => {
    if (!stream) return '';
    let output = '';
    for await (const chunk of stream) {
      output += chunk.toString();
    }
    return output;
  };

  const stdoutPromise = readStream(proc.stdout);
  const stderrPromise = readStream(proc.stderr);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', resolve);
  });

  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || `ffprobe failed with exit code ${exitCode}`);
  }

  return JSON.parse(stdout) as ProbeResult;
}

function detectDolbyVision(stream: ProbeStream | undefined): boolean {
  if (!stream) return false;
  const sideData = Array.isArray(stream.side_data_list) ? stream.side_data_list : [];
  if (sideData.some((entry) => (entry.side_data_type ?? '').toLowerCase().includes('dovi'))) return true;
  const codecTag = (stream.codec_tag_string ?? '').toLowerCase();
  return codecTag.includes('dvh1') || codecTag.includes('dvhe');
}

function detectHdr(stream: ProbeStream | undefined): boolean {
  if (!stream) return false;
  const transfer = (stream.color_transfer ?? '').toLowerCase();
  const colorSpace = (stream.color_space ?? '').toLowerCase();
  return transfer === 'smpte2084' || transfer === 'arib-std-b67' || colorSpace === 'bt2020nc' || colorSpace === 'bt2020c';
}

function normalizeVideoCodec(codecName: string | undefined): string | null {
  if (!codecName) return null;
  const codec = codecName.toLowerCase();
  if (codec === 'hevc') return 'hevc';
  if (codec === 'h264') return 'h264';
  if (codec === 'av1') return 'av1';
  return codec;
}

function buildOutputBaseName(inputPath: string, preset: MediaConversionPreset) {
  const ext = extname(inputPath);
  const stem = basename(inputPath, ext);
  const withResolution = (() => {
    if (preset.target_height === null) return stem;
    const resolutionReplaced = stem.replace(/\b(2160p|4k|uhd)\b/i, `${preset.target_height}p`);
    return resolutionReplaced === stem ? `${stem}.${preset.target_height}p` : resolutionReplaced;
  })();

  if (preset.target_video_codec === 'hevc') {
    const codecUpdated = withResolution.replace(/\b(H264|x264|AVC)\b/i, 'H265');
    return codecUpdated === withResolution ? `${withResolution}.H265` : codecUpdated;
  }

  const codecUpdated = withResolution.replace(/\b(H265|x265|HEVC)\b/i, 'H264');
  return codecUpdated === withResolution ? `${withResolution}.H264` : codecUpdated;
}

function buildOutputPath(inputPath: string, preset: MediaConversionPreset) {
  return join(dirname(inputPath), `${buildOutputBaseName(inputPath, preset)}.${preset.output_extension}`);
}

function buildSourceInfo(inputPath: string, fileSizeBytes: number, probe: ProbeResult): MediaConversionSourceInfo {
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const durationSeconds = toFiniteNumber(probe.format?.duration);
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio').length;
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle').length;

  return {
    file_size_bytes: fileSizeBytes,
    duration_seconds: durationSeconds,
    container: probe.format?.format_name ?? null,
    video_codec: normalizeVideoCodec(videoStream?.codec_name),
    width: toFiniteNumber(videoStream?.width),
    height: toFiniteNumber(videoStream?.height),
    pix_fmt: videoStream?.pix_fmt ?? null,
    hdr: detectHdr(videoStream),
    dolby_vision: detectDolbyVision(videoStream),
    audio_streams: audioStreams,
    subtitle_streams: subtitleStreams,
  };
}

async function validateSource(source: ResolvedSource, preset: MediaConversionPreset): Promise<{
  validation: MediaConversionValidation;
  probeData: Prisma.JsonObject;
}> {
  const extension = extname(source.inputPath).toLowerCase();
  const fileStat = await stat(source.inputPath);
  const outputPath = buildOutputPath(source.inputPath, preset);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!fileStat.isFile()) {
    reasons.push('The source path is not a regular file');
  }
  if (!SUPPORTED_INPUT_EXTENSIONS.has(extension)) {
    reasons.push(`Unsupported input extension: ${extension || '(none)'}`);
  }
  if (source.inputPath === outputPath) {
    reasons.push('The output path would overwrite the source file');
  }
  if (await fileExists(outputPath)) {
    reasons.push(`The target file already exists: ${outputPath}`);
  }

  const probe = await runProbe(source.inputPath);
  const sourceInfo = buildSourceInfo(source.inputPath, fileStat.size, probe);

  if (!sourceInfo.video_codec) {
    reasons.push('No video stream was detected in the file');
  }
  if (!sourceInfo.width || !sourceInfo.height) {
    reasons.push('Could not determine the video resolution');
  }
  if (!sourceInfo.duration_seconds || sourceInfo.duration_seconds <= 0) {
    reasons.push('Could not determine the video duration');
  }
  if (preset.target_height !== null && sourceInfo.height !== null && sourceInfo.height <= preset.target_height) {
    reasons.push(`The source is already ${sourceInfo.height}p, so the ${preset.target_height}p preset is not appropriate`);
  }
  if (preset.key === 'h264_to_h265' && sourceInfo.video_codec !== 'h264') {
    reasons.push('The H.264 to H.265 preset only applies to H.264 source files');
  }
  if (sourceInfo.hdr) {
    warnings.push('HDR metadata detected. This preset does not tone-map HDR to SDR.');
  }
  if (sourceInfo.dolby_vision) {
    warnings.push('Dolby Vision metadata detected. The output may lose Dolby Vision compatibility.');
  }
  if (sourceInfo.audio_streams === 0) {
    warnings.push('No audio stream was detected. The output will be video-only.');
  }

  return {
    validation: {
      can_convert: reasons.length === 0,
      reasons,
      warnings,
      input_path: source.inputPath,
      output_path: outputPath,
      source: sourceInfo,
    },
    probeData: probe as Prisma.JsonObject,
  };
}

function buildFfmpegArgs(job: {
  inputPath: string;
  outputPath: string;
  preset: MediaConversionPreset;
}) {
  const videoCodecArgs =
    job.preset.target_video_codec === 'hevc'
      ? ['-c:v', 'libx265']
      : ['-c:v', 'libx264'];

  const args = [
    '-y',
    '-i',
    job.inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-map',
    '0:s?',
    '-map_metadata',
    '0',
    '-map_chapters',
    '0',
    ...(job.preset.target_height !== null ? ['-vf', `scale=-2:${job.preset.target_height}:flags=lanczos`] : []),
    ...videoCodecArgs,
    '-preset',
    job.preset.ffmpeg_preset,
    '-crf',
    String(job.preset.crf),
    '-c:a',
    job.preset.copy_audio ? 'copy' : 'aac',
    '-c:s',
    job.preset.copy_subtitles ? 'copy' : 'mov_text',
    '-progress',
    'pipe:1',
    '-nostats',
    job.outputPath,
  ];

  return args;
}

function parseProgressSeconds(value: string | undefined): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric !== null) {
    if (numeric > 1_000_000) return numeric / 1_000_000;
    if (numeric > 10_000) return numeric / 1_000;
    return numeric;
  }

  if (!value) return null;
  const match = value.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseSpeedMultiplier(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)x/i);
  return match ? toFiniteNumber(match[1]) : null;
}

function serializeJob(job: NonNullable<MediaConversionJobRecord>) {
  return {
    id: job.id,
    service: job.service as MediaService,
    source_id: job.sourceId,
    source_title: job.sourceTitle,
    preset: job.preset,
    status: job.status as MediaConversionStatus,
    input_path: job.inputPath,
    output_path: job.outputPath,
    progress: clampProgress(job.progress),
    duration_seconds: job.durationSeconds,
    processed_seconds: job.processedSeconds,
    eta_seconds: job.etaSeconds,
    fps: job.fps,
    speed: job.speed,
    error_message: job.errorMessage,
    validation_summary: (job.validationSummary as MediaConversionValidation | null) ?? null,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt?.toISOString() ?? null,
    started_at: job.startedAt?.toISOString() ?? null,
    completed_at: job.completedAt?.toISOString() ?? null,
    requested_by_user_id: job.requestedByUserId,
  };
}

async function updateJobProgress(
  jobId: number,
  durationSeconds: number | null,
  progressState: Record<string, string>,
  force = false,
) {
  const processedSeconds =
    parseProgressSeconds(progressState.out_time_us) ??
    parseProgressSeconds(progressState.out_time_ms) ??
    parseProgressSeconds(progressState.out_time);
  const fps = toFiniteNumber(progressState.fps);
  const speed = progressState.speed?.trim() || null;
  const speedMultiplier = parseSpeedMultiplier(speed ?? undefined);
  const progress =
    processedSeconds !== null && durationSeconds && durationSeconds > 0
      ? clampProgress((processedSeconds / durationSeconds) * 100)
      : 0;
  const etaSeconds =
    processedSeconds !== null && durationSeconds && durationSeconds > 0 && speedMultiplier && speedMultiplier > 0
      ? Math.max(0, Math.round((durationSeconds - processedSeconds) / speedMultiplier))
      : null;

  await prisma.mediaConversionJob.update({
    where: { id: jobId },
    data: {
      progress,
      processedSeconds: processedSeconds ?? undefined,
      etaSeconds,
      fps: fps ?? undefined,
      speed,
      ...(force ? { updatedAt: new Date() } : {}),
    },
  });
}

async function runConversionJob(jobId: number) {
  const job = await prisma.mediaConversionJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'queued') return;

  const preset = getPresetOrThrow(job.preset);
  await mkdir(dirname(job.outputPath), { recursive: true });
  await prisma.mediaConversionJob.update({
    where: { id: jobId },
    data: {
      status: 'running',
      progress: 0,
      processedSeconds: 0,
      etaSeconds: null,
      fps: null,
      speed: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
    },
  });

  const proc = spawn('ffmpeg', buildFfmpegArgs({ inputPath: job.inputPath, outputPath: job.outputPath, preset }), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const progressState: Record<string, string> = {};
  const stderrTail: string[] = [];
  let lastPersistAt = 0;
  let progressFlush = Promise.resolve();

  const flushProgress = (force = false) => {
    const now = Date.now();
    if (!force && now - lastPersistAt < 1200) return;
    lastPersistAt = now;
    progressFlush = progressFlush
      .then(() => updateJobProgress(jobId, job.durationSeconds, progressState, force))
      .catch(error => {
        console.warn(`[media-conversion:${jobId}] Failed to persist progress:`, error);
      });
  };

  createInterface({ input: proc.stdout! }).on('line', line => {
    const separator = line.indexOf('=');
    if (separator <= 0) return;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    progressState[key] = value;
    if (key === 'progress') flushProgress(value === 'end');
    else flushProgress(false);
  });

  createInterface({ input: proc.stderr! }).on('line', line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    stderrTail.push(trimmed);
    if (stderrTail.length > 20) stderrTail.shift();
  });

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', resolve);
  }).catch(async error => {
    await prisma.mediaConversionJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'ffmpeg failed to start',
        completedAt: new Date(),
      },
    });
    throw error;
  });

  await progressFlush;

  if (exitCode === 0) {
    try {
      if (job.service === 'radarr') {
        await createLocalC411ReleaseFromConversion({
          service: 'radarr',
          sourceId: job.sourceId,
          preset: job.preset,
          inputPath: job.inputPath,
          outputPath: job.outputPath,
          conversionJobId: jobId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create local C411 release';
      await prisma.mediaConversionJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          progress: 100,
          errorMessage: `Conversion finished but local C411 release creation failed: ${message}`,
          completedAt: new Date(),
        },
      });
      return;
    }

    await prisma.mediaConversionJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        processedSeconds: job.durationSeconds ?? job.processedSeconds ?? undefined,
        etaSeconds: 0,
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.mediaConversionJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      errorMessage: stderrTail.slice(-3).join(' | ') || `ffmpeg exited with code ${exitCode}`,
      completedAt: new Date(),
    },
  });
}

export function scheduleMediaConversionWorker() {
  if (workerScheduled) return;
  workerScheduled = true;

  enqueueTask('media-conversion:worker', async () => {
    try {
      while (true) {
        const nextJob = await prisma.mediaConversionJob.findFirst({
          where: { status: 'queued' },
          orderBy: { createdAt: 'asc' },
        });
        if (!nextJob) break;
        await runConversionJob(nextJob.id);
      }
    } finally {
      workerScheduled = false;
      const remaining = await prisma.mediaConversionJob.count({
        where: { status: 'queued' },
      }).catch(() => 0);
      if (remaining > 0) scheduleMediaConversionWorker();
    }
  });
}

export async function resumePendingMediaConversionJobs() {
  await prisma.mediaConversionJob.updateMany({
    where: { status: 'running' },
    data: {
      status: 'queued',
      startedAt: null,
      errorMessage: 'Re-queued after API restart',
      fps: null,
      speed: null,
      etaSeconds: null,
    },
  });

  const queued = await prisma.mediaConversionJob.count({
    where: { status: 'queued' },
  });

  if (queued > 0) scheduleMediaConversionWorker();
}

export function getMediaConversionPresets() {
  return MEDIA_CONVERSION_PRESETS.map((preset) => ({ ...preset }));
}

export async function getMediaConversionPreview(params: {
  service: MediaService;
  sourceId: number;
  preset: string;
}) {
  const source = await resolveSource(params.service, params.sourceId);
  const preset = getPresetOrThrow(params.preset);
  const { validation } = await validateSource(source, preset);

  return {
    service: source.service,
    source_id: source.sourceId,
    source_title: source.sourceTitle,
    preset,
    available_presets: getMediaConversionPresets(),
    validation,
  };
}

export async function createMediaConversionJob(params: {
  service: MediaService;
  sourceId: number;
  preset: string;
  requestedByUserId?: number;
}) {
  const source = await resolveSource(params.service, params.sourceId);
  const preset = getPresetOrThrow(params.preset);
  const { validation, probeData } = await validateSource(source, preset);

  if (!validation.can_convert) {
    throw new Error(validation.reasons[0] || 'This file cannot be converted');
  }

  const existingJob = await prisma.mediaConversionJob.findFirst({
    where: {
      service: params.service,
      sourceId: params.sourceId,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingJob) {
    throw new Error('A conversion is already queued or running for this media');
  }

  const job = await prisma.mediaConversionJob.create({
    data: {
      service: params.service,
      sourceId: params.sourceId,
      sourceTitle: source.sourceTitle,
      preset: preset.key,
      status: 'queued',
      requestedByUserId: params.requestedByUserId,
      inputPath: validation.input_path,
      outputPath: validation.output_path,
      progress: 0,
      durationSeconds: validation.source.duration_seconds,
      processedSeconds: 0,
      validationSummary: validation as unknown as Prisma.InputJsonValue,
      probeData,
    },
  });

  scheduleMediaConversionWorker();
  return serializeJob(job);
}

export async function listMediaConversionJobs(service: MediaService, sourceId: number) {
  const jobs = await prisma.mediaConversionJob.findMany({
    where: { service, sourceId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return jobs.map(serializeJob);
}

export async function listActiveMediaConversionJobs() {
  const jobs = await prisma.mediaConversionJob.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });

  return jobs.map(serializeJob);
}

export async function getMediaConversionJob(jobId: number) {
  const job = await prisma.mediaConversionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Conversion job not found');
  }

  return serializeJob(job);
}
