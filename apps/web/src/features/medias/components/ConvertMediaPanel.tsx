import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  LoaderCircle,
  ChevronRight,
  HardDrive,
  Clock,
  Settings2,
  FileVideo,
  Zap,
  Info,
  Sun,
  Music,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateMediaConversion,
  useCancelMediaConversion,
  useClearMediaConversions,
  useMediaConversionPreview,
  useMediaConversions,
  type MediaConversionJob,
  type MediaItem,
} from '@hously/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ConvertMediaPanelProps {
  isActive: boolean;
  media: MediaItem | null;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// Codec compression ratios relative to source codec (empirical estimates for typical CRF settings)
const CODEC_COMPRESSION_RATIOS: Record<string, Record<string, number>> = {
  h264: { h264: 1.0, hevc: 0.55, av1: 0.45 },
  hevc: { h264: 1.8,  hevc: 1.0,  av1: 0.65 },
  av1:  { h264: 2.2,  hevc: 1.5,  av1: 1.0  },
};

function estimateOutputSize(
  source: { file_size_bytes: number; duration_seconds: number | null; video_codec: string | null; width: number | null; height: number | null },
  targetCodec: string,
  targetHeight: number | null,
): number | null {
  if (!source.duration_seconds || source.duration_seconds <= 0) return null;
  if (!source.file_size_bytes || source.file_size_bytes <= 0) return null;

  const srcCodec = source.video_codec ?? 'h264';
  const codecRatio = CODEC_COMPRESSION_RATIOS[srcCodec]?.[targetCodec] ?? 1.0;

  const srcH = source.height ?? 1;
  const srcW = source.width ?? 1;
  const tgtH = targetHeight ?? srcH;
  const tgtW = Math.round((srcW / srcH) * tgtH / 2) * 2;
  const resRatio = srcH > 0 && srcW > 0 ? (tgtW * tgtH) / (srcW * srcH) : 1.0;

  return Math.round(source.file_size_bytes * codecRatio * resRatio);
}

function formatDuration(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return 'N/A';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatJobStatus(t: any, job: MediaConversionJob) {
  if (job.status === 'queued') return t('medias.convert.status.queued');
  if (job.status === 'running') return t('medias.convert.status.running');
  if (job.status === 'completed') return t('medias.convert.status.completed');
  if (job.status === 'failed') return t('medias.convert.status.failed');
  return job.status;
}

function formatPresetLabel(preset: string): string {
  try {
    const p = JSON.parse(preset) as { codec?: string; height?: number | null; tone_map_hdr?: boolean; audio_tracks?: number[] | null };
    const codecMap: Record<string, string> = { hevc: 'H.265', h264: 'H.264', av1: 'AV1' };
    const codec = codecMap[p.codec ?? ''] ?? p.codec?.toUpperCase() ?? '?';
    const res = p.height ? `${p.height}p` : 'Original';
    const extras = [p.tone_map_hdr && 'HDR→SDR', p.audio_tracks?.length && `${p.audio_tracks.length} pistes`].filter(Boolean);
    return [codec, res, ...extras].join(' · ');
  } catch {
    return preset;
  }
}

const CODEC_OPTIONS = [
  { value: 'hevc', label: 'H.265 / HEVC' },
  { value: 'h264', label: 'H.264 / AVC' },
  { value: 'av1',  label: 'AV1' },
] as const;

const CODEC_EFFECT_KEY: Record<string, Record<string, string>> = {
  h264: { hevc: 'h264_to_hevc', av1: 'h264_to_av1', h264: 'same_quality' },
  hevc: { h264: 'hevc_to_h264', av1: 'hevc_to_av1', hevc: 'same_quality' },
  av1:  { h264: 'av1_to_h264',  hevc: 'av1_to_hevc', av1: 'same_quality' },
};

const RESOLUTION_OPTIONS = [
  { value: null,  label: 'Original' },
  { value: 2160,  label: '4K (2160p)' },
  { value: 1440,  label: '1440p' },
  { value: 1080,  label: '1080p' },
  { value: 720,   label: '720p' },
  { value: 480,   label: '480p' },
];

export function ConvertMediaPanel({ isActive, media }: ConvertMediaPanelProps) {
  const { t } = useTranslation('common');
  const [codec, setCodec] = useState<'hevc' | 'h264' | 'av1'>('hevc');
  const [height, setHeight] = useState<number | null>(null);
  const [toneMap, setToneMap] = useState(false);
  const [selectedAudioTracks, setSelectedAudioTracks] = useState<number[] | null>(null);
  const createMutation = useCreateMediaConversion();
  const cancelMutation = useCancelMediaConversion();
  const clearMutation = useClearMediaConversions();

  useEffect(() => {
    if (isActive) { setCodec('hevc'); setHeight(null); setToneMap(false); setSelectedAudioTracks(null); }
  }, [isActive, media?.id]);


  const preview = useMediaConversionPreview(
    {
      service: media?.service ?? 'radarr',
      source_id: media?.source_id ?? null,
      codec,
      height,
      tone_map_hdr: toneMap,
    },
    {
      enabled: isActive && Boolean(media),
    }
  );

  const jobsQuery = useMediaConversions(
    {
      service: media?.service ?? 'radarr',
      source_id: media?.source_id ?? null,
    },
    {
      enabled: isActive && Boolean(media),
      refetchInterval: 2000,
    }
  );

  const jobs = jobsQuery.data?.jobs ?? [];

  const handleCreate = async () => {
    if (!media || createMutation.isPending) return;
    try {
      await createMutation.mutateAsync({
        service: media.service,
        source_id: media.source_id,
        target_codec: codec,
        target_height: height,
        tone_map_hdr: toneMap,
        audio_tracks: selectedAudioTracks,
      });
      toast.success(t('medias.convert.success', { title: media.title }));
      await jobsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('medias.convert.failed'));
    }
  };

  const validation = preview.data?.validation;
  const sourceHeight = validation?.source.height ?? null;
  const sourceWidth = validation?.source.width ?? null;
  const sourceHdr = validation?.source.hdr ?? false;
  const audioStreams = validation?.source.audio_streams_detail ?? [];

  // Reset tone-map when source has no HDR
  useEffect(() => {
    if (!sourceHdr) setToneMap(false);
  }, [sourceHdr]);

  const toggleAudioTrack = (index: number) => {
    setSelectedAudioTracks(prev => {
      const current = prev ?? audioStreams.map(s => s.index);
      if (current.includes(index)) {
        const next = current.filter(i => i !== index);
        return next.length === 0 ? null : next;
      }
      return [...current, index].sort((a, b) => a - b);
    });
  };

  const effectiveAudioTracks = selectedAudioTracks;

  const computeOutputDimensions = (targetHeight: number | null) => {
    if (!sourceWidth || !sourceHeight) return null;
    const h = targetHeight ?? sourceHeight;
    const w = Math.round((sourceWidth / sourceHeight) * h / 2) * 2; // divisible by 2 like ffmpeg -2
    return { w, h };
  };

  const availableResolutions = RESOLUTION_OPTIONS
    .filter(r => r.value === null || sourceHeight === null || r.value <= sourceHeight)
    .map(r => {
      const dims = computeOutputDimensions(r.value);
      if (!dims) return r;
      return { ...r, label: `${r.value ? `${r.value}p` : 'Original'} — ${dims.w}×${dims.h}` };
    });
  const isSupportedMedia = media?.service === 'radarr' && media.media_type === 'movie';

  return (
    <div className="space-y-6 pb-6">
      {!isSupportedMedia && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {t('medias.convert.unsupported')}
        </div>
      )}

      <div className="space-y-6">
        {/* Codec + Resolution Selectors */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] ml-1">
              Codec
            </label>
            <div className="relative">
              <select
                value={codec}
                onChange={e => setCodec(e.target.value as 'hevc' | 'h264' | 'av1')}
                disabled={!isSupportedMedia || createMutation.isPending}
                className="w-full appearance-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 disabled:opacity-50"
              >
                {CODEC_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <Settings2 size={16} />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] ml-1">
              Resolution
            </label>
            <div className="relative">
              <select
                value={height ?? ''}
                onChange={e => setHeight(e.target.value === '' ? null : Number(e.target.value))}
                disabled={!isSupportedMedia || createMutation.isPending}
                className="w-full appearance-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 disabled:opacity-50"
              >
                {availableResolutions.map(o => (
                  <option key={o.value ?? 'orig'} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <Settings2 size={16} />
              </div>
            </div>
          </div>
        </div>

        {/* HDR Tone-Mapping */}
        {sourceHdr && (
          <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-700/30 dark:bg-amber-900/10 p-4 cursor-pointer select-none">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={toneMap}
                onChange={e => setToneMap(e.target.checked)}
                disabled={!isSupportedMedia || createMutation.isPending}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-amber-500 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sun size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {t('medias.convert.toneMapLabel')}
                </span>
              </div>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                {toneMap ? t('medias.convert.toneMapEnabled') : t('medias.convert.toneMapDisabled')}
              </p>
            </div>
          </label>
        )}

        {/* Audio Track Selector */}
        {audioStreams.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 ml-1">
              <Music size={11} className="text-neutral-400" />
              <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">
                {t('medias.convert.audioTracks')}
              </label>
              {effectiveAudioTracks !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedAudioTracks(null)}
                  className="ml-auto text-[10px] font-bold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  {t('medias.convert.audioSelectAll')}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {audioStreams.map(stream => {
                const isSelected = effectiveAudioTracks === null || effectiveAudioTracks.includes(stream.index);
                return (
                  <label
                    key={stream.index}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
                      isSelected
                        ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-700/40 dark:bg-indigo-900/10'
                        : 'border-neutral-200 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-900/30 opacity-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAudioTrack(stream.index)}
                      disabled={!isSupportedMedia || createMutation.isPending}
                      className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-100">
                        {stream.language ? stream.language.toUpperCase() : `Track ${stream.index + 1}`}
                      </span>
                      {stream.title && (
                        <span className="text-[10px] text-neutral-500 truncate">{stream.title}</span>
                      )}
                      <span className="text-[10px] font-medium text-neutral-400 uppercase">
                        {stream.codec}{stream.channel_layout ? ` · ${stream.channel_layout}` : stream.channels ? ` · ${stream.channels}ch` : ''}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {preview.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/50 py-12 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/50">
            <LoaderCircle size={32} className="animate-spin text-indigo-500" />
            <p className="text-xs font-bold uppercase tracking-widest">{t('common.loading')}</p>
          </div>
        ) : validation ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Comparison Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                    Source
                  </span>
                  <FileVideo size={16} className="text-neutral-300" />
                </div>
                <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {validation.source.video_codec?.toUpperCase() ?? 'N/A'}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  {validation.source.width && validation.source.height && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                      <FileVideo size={12} />
                      {validation.source.width}×{validation.source.height}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                    <HardDrive size={12} />
                    {formatFileSize(validation.source.file_size_bytes)}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                    <Clock size={12} />
                    {formatDuration(validation.source.duration_seconds)}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Target
                  </span>
                  <Zap size={16} className="text-indigo-400" />
                </div>
                <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {CODEC_OPTIONS.find(o => o.value === codec)?.label ?? codec.toUpperCase()}
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                    {(() => {
                      const dims = computeOutputDimensions(height);
                      return dims ? `${dims.w}×${dims.h}` : height ? `${height}p` : 'Original';
                    })()}
                  </span>
                  {(() => {
                    const est = estimateOutputSize(validation.source, codec, height);
                    return est ? (
                      <span className="text-[11px] font-bold text-neutral-500 flex items-center gap-1">
                        <HardDrive size={11} />
                        ~{formatFileSize(est)}
                      </span>
                    ) : null;
                  })()}
                  {validation.source.video_codec && (() => {
                    const effectKey = CODEC_EFFECT_KEY[validation.source.video_codec]?.[codec];
                    return effectKey ? (
                      <span className="text-[11px] font-bold text-neutral-500 italic">
                        {t(`medias.convert.codecEffects.${effectKey}`)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1.5">
                        <span className="line-through opacity-60">{validation.source.video_codec.toUpperCase()}</span>
                        <ChevronRight size={10} />
                        <span>{codec.toUpperCase()}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Status & Validation */}
            <div
              className={cn(
                'rounded-2xl border p-4 flex gap-3',
                validation.can_convert
                  ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10 text-red-800 dark:text-red-300'
              )}
            >
              {validation.can_convert ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              )}
              <div>
                <p className="text-sm font-bold">
                  {validation.can_convert ? t('medias.convert.canConvert') : t('medias.convert.cannotConvert')}
                </p>
                {validation.reasons.length > 0 ? (
                  <ul className="text-[11px] font-medium opacity-80 mt-1 space-y-0.5">
                    {validation.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                ) : (
                  <p className="text-[11px] font-medium opacity-80 mt-1 break-all line-clamp-1">
                    {validation.input_path}
                  </p>
                )}
              </div>
            </div>

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 flex gap-3">
                <Info size={18} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider italic">{t('medias.convert.warnings')}</p>
                  <ul className="text-[11px] font-medium space-y-0.5 opacity-90">
                    {validation.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!isSupportedMedia || !validation?.can_convert || createMutation.isPending}
          >
            {createMutation.isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-700">
                <LoaderCircle size={20} className="animate-spin" />
              </div>
            )}
              {t('medias.convert.create')}
              <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      {/* Mini Queue (if jobs exist) */}
      {jobs.length > 0 && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Clapperboard size={14} className="text-neutral-400" />
            <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] flex-1">
              {t('medias.convert.queueTitle')}
            </h4>
            {jobs.some(j => j.status === 'completed' || j.status === 'failed') && media && (
              <button
                type="button"
                onClick={() => clearMutation.mutate({ service: media.service, source_id: media.source_id })}
                disabled={clearMutation.isPending}
                className="text-[10px] font-bold text-neutral-400 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <Trash2 size={11} />
                {t('medias.convert.clearFinished')}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {jobs.slice(0, 5).map(job => (
              <div
                key={job.id}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                    {formatPresetLabel(job.preset)}
                  </p>
                  <p className="text-[10px] font-medium text-neutral-500 mt-0.5">
                    {formatJobStatus(t, job)} • {Math.round(job.progress)}%
                  </p>
                </div>
                {job.status === 'running' && <LoaderCircle size={14} className="animate-spin text-indigo-500 shrink-0" />}
                {job.status === 'queued' && <LoaderCircle size={14} className="text-neutral-300 shrink-0" />}
                {job.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                {(job.status === 'completed' || job.status === 'failed') && (
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate(job.id)}
                    disabled={cancelMutation.isPending}
                    className="shrink-0 text-neutral-300 hover:text-red-500 transition-colors"
                    title={t('common.delete')}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {job.status === 'failed' && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
