import { access, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, extname, join } from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { addJob, QUEUE_NAMES } from './queueService';
import { sendConversionLiveActivityStartPush } from '../utils/apnLiveActivity';
import { normalizeRadarrConfig } from '../utils/plugins/normalizers';
import { createLocalC411ReleaseFromConversion } from './c411/local-release';

// Exported for the worker
export { createLocalC411ReleaseFromConversion };

type MediaService = 'radarr' | 'sonarr';
type MediaConversionStatus = 'queued' | 'running' | 'completed' | 'failed';

export type MediaConversionPreset = {
  key: string;
  label: string;
  description: string;
  output_extension: 'mkv' | 'mp4';
  target_height: number | null;
  target_video_codec: 'hevc' | 'h264' | 'av1';
  crf: number;
  ffmpeg_preset: string;
  copy_audio: boolean;
  copy_subtitles: boolean;
  tone_map_hdr: boolean;
  audio_track_indices: number[] | null;
};

type AudioStreamDetail = {
  index: number;
  codec: string;
  channels: number | null;
  channel_layout: string | null;
  language: string | null;
  title: string | null;
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
  audio_streams_detail: AudioStreamDetail[];
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
  index?: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  color_transfer?: string;
  color_space?: string;
  codec_tag_string?: string;
  side_data_list?: Array<{ side_data_type?: string }>;
  channels?: number;
  channel_layout?: string;
  tags?: { language?: string; title?: string };
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


const CODEC_DEFAULTS: Record<string, { crf: number; ffmpeg_preset: string }> = {
  h264: { crf: 20, ffmpeg_preset: 'medium' },
  hevc: { crf: 22, ffmpeg_preset: 'medium' },
  av1:  { crf: 30, ffmpeg_preset: '6' },
};

type DynamicPresetOptions = {
  toneMap?: boolean;
  audioTracks?: number[] | null;
};

function buildDynamicPreset(codec: 'h264' | 'hevc' | 'av1', height: number | null, options: DynamicPresetOptions = {}): MediaConversionPreset {
  const codecLabel = codec === 'hevc' ? 'H.265' : codec === 'av1' ? 'AV1' : 'H.264';
  const resLabel = height ? `${height}p` : 'Original';
  const defaults = CODEC_DEFAULTS[codec];
  return {
    key: JSON.stringify({ codec, height, tone_map_hdr: options.toneMap ?? false, audio_tracks: options.audioTracks ?? null }),
    label: `${codecLabel} ${resLabel}`,
    description: `Re-encode to ${codecLabel}${height ? ` at ${height}p` : ' without changing resolution'}.`,
    output_extension: 'mkv',
    target_height: height,
    target_video_codec: codec,
    crf: defaults.crf,
    ffmpeg_preset: defaults.ffmpeg_preset,
    copy_audio: true,
    copy_subtitles: true,
    tone_map_hdr: options.toneMap ?? false,
    audio_track_indices: options.audioTracks ?? null,
  };
}

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

// Exported for the worker
export function getPresetOrThrow(key: string): MediaConversionPreset {
  // New format: JSON string
  if (key.startsWith('{')) {
    try {
      const opts = JSON.parse(key) as { codec: 'h264' | 'hevc' | 'av1'; height: number | null; tone_map_hdr?: boolean; audio_tracks?: number[] | null };
      return buildDynamicPreset(opts.codec, opts.height, { toneMap: opts.tone_map_hdr, audioTracks: opts.audio_tracks });
    } catch {}
  }
  // Legacy format: "{codec}:{height|orig}"
  const match = key.match(/^(h264|hevc|av1):(orig|\d+)$/);
  if (!match) throw new Error(`Unknown conversion preset: ${key}`);
  const codec = match[1] as 'h264' | 'hevc' | 'av1';
  const height = match[2] === 'orig' ? null : parseInt(match[2], 10);
  return buildDynamicPreset(codec, height);
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
    const codecUpdated = withResolution.replace(/\b(H264|x264|AVC|AV1|av1)\b/i, 'H265');
    return codecUpdated === withResolution ? `${withResolution}.H265` : codecUpdated;
  }

  if (preset.target_video_codec === 'av1') {
    const codecUpdated = withResolution.replace(/\b(H264|x264|AVC|H265|x265|HEVC)\b/i, 'AV1');
    return codecUpdated === withResolution ? `${withResolution}.AV1` : codecUpdated;
  }

  const codecUpdated = withResolution.replace(/\b(H265|x265|HEVC|AV1|av1)\b/i, 'H264');
  return codecUpdated === withResolution ? `${withResolution}.H264` : codecUpdated;
}

const OUTPUT_DIR = '/mnt/storage/Downloads/conversions';

function buildOutputPath(inputPath: string, preset: MediaConversionPreset) {
  return join(OUTPUT_DIR, `${buildOutputBaseName(inputPath, preset)}.${preset.output_extension}`);
}

function buildSourceInfo(_inputPath: string, fileSizeBytes: number, probe: ProbeResult): MediaConversionSourceInfo {
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const durationSeconds = toFiniteNumber(probe.format?.duration);
  const rawAudioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const subtitleStreams = streams.filter((stream) => stream.codec_type === 'subtitle').length;

  const audioStreamsDetail: AudioStreamDetail[] = rawAudioStreams.map((s, i) => ({
    index: i,
    codec: s.codec_name ?? 'unknown',
    channels: toFiniteNumber(s.channels),
    channel_layout: s.channel_layout ?? null,
    language: s.tags?.language ?? null,
    title: s.tags?.title ?? null,
  }));

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
    audio_streams: rawAudioStreams.length,
    audio_streams_detail: audioStreamsDetail,
    subtitle_streams: subtitleStreams,
  };
}

async function validateSource(source: ResolvedSource, preset: MediaConversionPreset): Promise<{
  validation: MediaConversionValidation;
  probeData: Prisma.JsonObject;
}> {
  const extension = extname(source.inputPath).toLowerCase();
  const fileStat = await stat(source.inputPath);
  await mkdir(OUTPUT_DIR, { recursive: true });
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
    warnings.push(`The target file already exists and will be overwritten: ${outputPath}`);
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
  const sameCodec = sourceInfo.video_codec === preset.target_video_codec;

  if (sameCodec && preset.target_height === null) {
    reasons.push(`The source is already ${preset.target_video_codec.toUpperCase()} — select a different codec or a target resolution`);
  } else if (preset.target_height !== null && sourceInfo.height !== null) {
    if (sourceInfo.height === preset.target_height && sameCodec) {
      reasons.push(`The source is already ${sourceInfo.height}p ${preset.target_video_codec.toUpperCase()}, this conversion would have no effect`);
    } else if (sourceInfo.height < preset.target_height) {
      if (sameCodec) {
        reasons.push(`The source is ${sourceInfo.height}p — upscaling to ${preset.target_height}p with the same codec has no benefit`);
      } else {
        warnings.push(`The source is ${sourceInfo.height}p — upscaling to ${preset.target_height}p will not improve quality`);
      }
    }
  }

  if (sourceInfo.hdr && !preset.tone_map_hdr) {
    warnings.push('HDR metadata will be preserved. Output may look washed out on SDR displays.');
  }
  if (sourceInfo.dolby_vision && !preset.tone_map_hdr) {
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

// Exported for the worker
export function buildFfmpegArgs(job: {
  inputPath: string;
  outputPath: string;
  preset: MediaConversionPreset;
  sourceHdr?: boolean;
}) {
  const videoCodecArgs =
    job.preset.target_video_codec === 'hevc'
      ? ['-c:v', 'libx265']
      : job.preset.target_video_codec === 'av1'
        ? ['-c:v', 'libsvtav1']
        : ['-c:v', 'libx264'];

  // Build video filter chain
  const vfParts: string[] = [];
  if (job.preset.tone_map_hdr) {
    vfParts.push(
      'zscale=t=linear:npl=100',
      'format=gbrpf32le',
      'zscale=p=bt709',
      'tonemap=tonemap=hable:desat=0',
      'zscale=t=bt709:m=bt709:r=tv',
      'format=yuv420p',
    );
  }
  if (job.preset.target_height !== null) {
    vfParts.push(`scale=-2:${job.preset.target_height}:flags=lanczos`);
  }

  // HDR preservation for HEVC when not tone-mapping
  const hdrParams =
    !job.preset.tone_map_hdr && (job.sourceHdr ?? job.preset.tone_map_hdr === false) && job.preset.target_video_codec === 'hevc'
      ? ['-x265-params', 'hdr-opt=1:repeat-headers=1']
      : [];

  // Audio track mapping
  const audioMaps =
    job.preset.audio_track_indices?.length
      ? job.preset.audio_track_indices.flatMap(i => ['-map', `0:a:${i}`])
      : ['-map', '0:a?'];

  const args = [
    '-y',
    '-i',
    job.inputPath,
    '-map', '0:v:0',
    ...audioMaps,
    '-map', '0:s?',
    '-map_metadata', '0',
    '-map_chapters', '0',
    ...(vfParts.length > 0 ? ['-vf', vfParts.join(',')] : []),
    ...videoCodecArgs,
    '-preset', job.preset.ffmpeg_preset,
    '-crf', String(job.preset.crf),
    ...hdrParams,
    '-c:a', job.preset.copy_audio ? 'copy' : 'aac',
    '-c:s', job.preset.copy_subtitles ? 'copy' : 'mov_text',
    '-progress', 'pipe:1',
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

export function serializeMediaConversionJob(job: NonNullable<MediaConversionJobRecord>) {
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

// Exported for the worker
export async function updateJobProgress(
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

// Internal runConversionJob and scheduleMediaConversionWorker REMOVED 
// as they are now handled by BullMQ workers.

export async function resumePendingMediaConversionJobs() {
  // Re-queue jobs that were running when the server stopped
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

  const queuedJobs = await prisma.mediaConversionJob.findMany({
    where: { status: 'queued' },
  });

  for (const job of queuedJobs) {
    await addJob(QUEUE_NAMES.MEDIA_CONVERSIONS, `media-conversion:${job.id}`, { jobId: job.id });
  }
  
  if (queuedJobs.length > 0) {
    console.log(`[MediaConversionService] Re-enqueued ${queuedJobs.length} jobs in BullMQ.`);
  }
}


export async function getMediaConversionPreview(params: {
  service: MediaService;
  sourceId: number;
  target_codec: 'h264' | 'hevc' | 'av1';
  target_height: number | null;
  tone_map_hdr?: boolean;
  audio_tracks?: number[] | null;
}) {
  const source = await resolveSource(params.service, params.sourceId);
  const preset = buildDynamicPreset(params.target_codec, params.target_height, { toneMap: params.tone_map_hdr, audioTracks: params.audio_tracks });
  const { validation } = await validateSource(source, preset);

  return {
    service: source.service,
    source_id: source.sourceId,
    source_title: source.sourceTitle,
    preset,
    validation,
  };
}

export async function createMediaConversionJob(params: {
  service: MediaService;
  sourceId: number;
  target_codec: 'h264' | 'hevc' | 'av1';
  target_height: number | null;
  tone_map_hdr?: boolean;
  audio_tracks?: number[] | null;
  requestedByUserId?: number;
}) {
  const source = await resolveSource(params.service, params.sourceId);
  const preset = buildDynamicPreset(params.target_codec, params.target_height, { toneMap: params.tone_map_hdr, audioTracks: params.audio_tracks });
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

  // Enqueue to BullMQ
  await addJob(QUEUE_NAMES.MEDIA_CONVERSIONS, `media-conversion:${job.id}`, { jobId: job.id });

  // Send push-to-start to iOS so the Live Activity starts immediately
  const presetLabel = formatPresetLabelForPush(preset.key);
  sendConversionLiveActivityStartPushForUser(params.requestedByUserId, job.id, job.sourceTitle ?? '', presetLabel).catch(
    (err) => console.warn('[ConversionLiveActivity] Failed to send start push:', err)
  );

  return serializeMediaConversionJob(job);
}

export async function listMediaConversionJobs(service: MediaService, sourceId: number) {
  const jobs = await prisma.mediaConversionJob.findMany({
    where: { service, sourceId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return jobs.map(serializeMediaConversionJob);
}

export async function listActiveMediaConversionJobs() {
  const jobs = await prisma.mediaConversionJob.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });

  return jobs.map(serializeMediaConversionJob);
}

export async function getMediaConversionJob(jobId: number) {
  const job = await prisma.mediaConversionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Conversion job not found');
  }

  return serializeMediaConversionJob(job);
}

export async function cancelMediaConversionJob(jobId: number) {
  const job = await prisma.mediaConversionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Conversion job not found');
  }

  if (job.status === 'completed' || job.status === 'failed') {
    // Already done — delete the record entirely
    await prisma.mediaConversionJob.delete({ where: { id: jobId } });
    return serializeMediaConversionJob(job);
  }

  // BullMQ doesn't easily support killing a running process in another worker
  // unless we use a custom mechanism (like Redis flags or signals).
  // For now, we update the status in DB. The worker checks status occasionally.
  const updatedJob = await prisma.mediaConversionJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      errorMessage: 'Cancelled by user',
      completedAt: new Date(),
    },
  });

  return serializeMediaConversionJob(updatedJob);
}

export async function clearFinishedMediaConversionJobs(service: 'radarr' | 'sonarr', sourceId: number) {
  await prisma.mediaConversionJob.deleteMany({
    where: { service, sourceId, status: { in: ['completed', 'failed'] } },
  });
}

// Exported for the worker
export function formatPresetLabelForPush(preset: string): string {
  if (preset.startsWith('{')) {
    try {
      const p = JSON.parse(preset) as { codec?: string; height?: number | null; tone_map_hdr?: boolean; audio_tracks?: number[] | null };
      const codecMap: Record<string, string> = { hevc: 'H.265', h264: 'H.264', av1: 'AV1' };
      const codec = codecMap[p.codec ?? ''] ?? (p.codec?.toUpperCase() ?? '?');
      const res = p.height ? `${p.height}p` : 'Original';
      const extras = [p.tone_map_hdr && 'HDR→SDR', p.audio_tracks?.length && `${p.audio_tracks.length} pistes`].filter(Boolean);
      return [codec, res, ...extras].join(' · ');
    } catch {}
  }
  return preset;
}

// Exported for the worker
export async function sendConversionLiveActivityStartPushForUser(
  userId: number | undefined,
  jobId: number,
  sourceTitle: string,
  presetLabel: string,
): Promise<void> {
  if (!userId) return;
  const tokens = await prisma.liveActivityToken.findMany({
    where: { userId, type: 'conversion_start' },
    select: { token: true },
  });
  if (!tokens.length) return;

  const { invalidTokens } = await sendConversionLiveActivityStartPush(
    tokens.map((t) => t.token),
    {
      attributes: { jobId, sourceTitle, presetLabel },
      contentState: { status: 'queued', progress: 0, etaSeconds: null, speed: null },
    },
  );

  if (invalidTokens.length) {
    await prisma.liveActivityToken.deleteMany({ where: { token: { in: invalidTokens } } });
  }
}
