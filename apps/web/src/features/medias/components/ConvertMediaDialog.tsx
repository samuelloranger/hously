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
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/dialog';
import {
  useCreateMediaConversion,
  useMediaConversionPreview,
  useMediaConversions,
  type MediaConversionJob,
  type MediaItem,
} from '@hously/shared';
import { cn } from '@/lib/utils';

interface ConvertMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
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

export function ConvertMediaDialog({ isOpen, onClose, media }: ConvertMediaDialogProps) {
  const { t } = useTranslation('common');
  const [preset, setPreset] = useState('hevc_1080p');
  const createMutation = useCreateMediaConversion();

  useEffect(() => {
    if (isOpen) setPreset('hevc_1080p');
  }, [isOpen, media?.id]);

  const preview = useMediaConversionPreview(
    {
      service: media?.service ?? 'radarr',
      source_id: media?.source_id ?? null,
      preset,
    },
    {
      enabled: isOpen && Boolean(media),
    },
  );

  const jobsQuery = useMediaConversions(
    {
      service: media?.service ?? 'radarr',
      source_id: media?.source_id ?? null,
    },
    {
      enabled: isOpen && Boolean(media),
      refetchInterval: 2000,
    },
  );

  const jobs = jobsQuery.data?.jobs ?? [];

  const handleCreate = async () => {
    if (!media || createMutation.isPending) return;
    try {
      await createMutation.mutateAsync({
        service: media.service,
        source_id: media.source_id,
        preset,
      });
      toast.success(t('medias.convert.success', { title: media.title }));
      await jobsQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('medias.convert.failed'));
    }
  };

  const validation = preview.data?.validation;
  const availablePresets = preview.data?.available_presets ?? [];
  const isSupportedMedia = media?.service === 'radarr' && media.media_type === 'movie';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!createMutation.isPending) onClose();
      }}
      title={t('medias.convert.title')}
      panelClassName="max-w-2xl rounded-[32px]"
    >
      <div className="space-y-6">
        {!isSupportedMedia && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            {t('medias.convert.unsupported')}
          </div>
        )}

        <div className="space-y-6">
          {/* Preset Selector */}
          <div className="space-y-2.5">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] ml-1">
              {t('medias.convert.presetLabel')}
            </label>
            <div className="relative group">
              <select
                value={preset}
                onChange={(event) => setPreset(event.target.value)}
                disabled={!isSupportedMedia || createMutation.isPending}
                className="w-full appearance-none rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-3.5 text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 disabled:opacity-50"
              >
                {(availablePresets.length > 0 ? availablePresets : [{ key: preset, label: preset, description: '' }]).map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <Settings2 size={18} />
              </div>
            </div>
          </div>

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
                    <span className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Source</span>
                    <FileVideo size={16} className="text-neutral-300" />
                  </div>
                  <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{validation.source.video_codec?.toUpperCase() ?? 'N/A'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
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
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Target</span>
                    <Zap size={16} className="text-indigo-400" />
                  </div>
                  <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {availablePresets.find(p => p.key === preset)?.label ?? 'Custom'}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                      H.265 / HEVC
                    </span>
                    <span className="text-[11px] font-bold text-neutral-500 italic">
                      ~ {t('medias.convert.estimation')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status & Validation */}
              <div className={cn(
                "rounded-2xl border p-4 flex gap-3",
                validation.can_convert
                  ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-red-100 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10 text-red-800 dark:text-red-300'
              )}>
                {validation.can_convert ? (
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <p className="text-sm font-bold">
                    {validation.can_convert ? t('medias.convert.canConvert') : t('medias.convert.cannotConvert')}
                  </p>
                  <p className="text-[11px] font-medium opacity-80 mt-1 break-all line-clamp-1">
                    {validation.input_path}
                  </p>
                </div>
              </div>

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-300 flex gap-3">
                  <Info size={18} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider italic">{t('medias.convert.warnings')}</p>
                    <ul className="text-[11px] font-medium space-y-0.5 opacity-90">
                      {validation.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!isSupportedMedia || !validation?.can_convert || createMutation.isPending}
              className="group relative w-full h-14 rounded-2xl bg-indigo-600 overflow-hidden shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {createMutation.isPending && (
                <div className="absolute inset-0 flex items-center justify-center bg-indigo-700">
                  <LoaderCircle size={20} className="animate-spin" />
                </div>
              )}
              <span className={cn(
                "relative z-10 text-white font-bold uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3",
                createMutation.isPending && "opacity-0"
              )}>
                {t('medias.convert.create')}
                <ChevronRight size={18} />
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-3 py-3 text-xs font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>

        {/* Mini Queue (if jobs exist) */}
        {jobs.length > 0 && (
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
               <Clapperboard size={14} className="text-neutral-400" />
               <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{t('medias.convert.queueTitle')}</h4>
            </div>
            <div className="space-y-2">
              {jobs.slice(0, 3).map(job => (
                <div key={job.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                      {availablePresets.find(p => p.key === job.preset)?.label ?? job.preset}
                    </p>
                    <p className="text-[10px] font-medium text-neutral-500 mt-0.5">
                      {formatJobStatus(t, job)} • {Math.round(job.progress)}%
                    </p>
                  </div>
                  {job.status === 'running' && <LoaderCircle size={14} className="animate-spin text-indigo-500" />}
                  {job.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {job.status === 'failed' && <AlertTriangle size={14} className="text-red-500" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
