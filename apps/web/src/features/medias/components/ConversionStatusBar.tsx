import { useTranslation } from 'react-i18next';
import { Zap, MoreVertical, XCircle, ExternalLink } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useConversionJobs, useCancelMediaConversion, type MediaConversionJob } from '@hously/shared';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

export function ConversionStatusBar() {
  const activeJobs = useConversionJobs();

  if (activeJobs.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeJobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}

function JobRow({ job }: { job: MediaConversionJob }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const cancelMutation = useCancelMediaConversion();
  
  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds <= 0) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isRunning = job.status === 'running';

  const handleViewMedia = () => {
    const mediaKey = `${job.service}:${job.source_id}`;
    navigate({ to: '/library', search: { scrollToMedia: mediaKey } });
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(job.id);
      toast.success(t('medias.convert.cancelSuccess') || 'Conversion cancelled');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel conversion');
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
          {/* Left: Icon & Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
              isRunning 
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" 
                : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
            )}>
              <Zap className={cn("w-4.5 h-4.5", isRunning && "animate-pulse")} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                  {job.source_title || 'Unknown Media'}
                </span>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                  isRunning 
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" 
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                )}>
                  {isRunning ? t('medias.convert.status.running') : t('medias.convert.status.queued')}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                {job.output_path.split('/').pop()}
              </p>
            </div>
          </div>

          {/* Mobile Actions - only visible on small screens */}
          <div className="sm:hidden">
            <JobActionsDropdown onViewMedia={handleViewMedia} onCancel={handleCancel} isCancelling={cancelMutation.isPending} />
          </div>
        </div>
        
        {/* Center: Progress */}
        <div className="flex-1 w-full sm:max-w-xs">
          <div className="flex items-center justify-between text-[11px] mb-2 font-bold tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-indigo-600 dark:text-indigo-400">{Math.round(job.progress)}%</span>
              {isRunning && job.speed && (
                <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter italic">
                  {job.speed}
                </span>
              )}
            </div>
            <span className="text-neutral-500 dark:text-neutral-500 font-medium italic">
              {job.eta_seconds ? `~${formatDuration(job.eta_seconds)} ${t('medias.convert.etaSuffix') || 'left'}` : isRunning ? t('common.loading') : t('medias.convert.status.queued')}
            </span>
          </div>
          <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                isRunning ? "bg-indigo-600 dark:bg-indigo-50" : "bg-amber-400 dark:bg-amber-600"
              )}
              style={{ width: `${Math.max(2, job.progress)}%` }}
            />
          </div>
        </div>

        {/* Desktop Right: Actions & Extra Info */}
        <div className="hidden sm:flex items-center gap-1">
          <div className="text-right hidden md:block mr-2">
            {job.fps && <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter italic">{Math.round(job.fps)} fps</p>}
          </div>
          <JobActionsDropdown onViewMedia={handleViewMedia} onCancel={handleCancel} isCancelling={cancelMutation.isPending} />
        </div>
      </div>
    </div>
  );
}

function JobActionsDropdown({ onViewMedia, onCancel, isCancelling }: { onViewMedia: () => void, onCancel: () => void, isCancelling: boolean }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-all active:scale-90">
          <MoreVertical size={18} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="min-w-[160px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1 z-50 animate-in fade-in zoom-in-95"
        >
          <DropdownMenu.Item 
            onSelect={onViewMedia}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg outline-none cursor-pointer"
          >
            <ExternalLink size={14} />
            View Media
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />
          <DropdownMenu.Item 
            onSelect={onCancel}
            disabled={isCancelling}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg outline-none cursor-pointer disabled:opacity-50"
          >
            <XCircle size={14} className={cn(isCancelling && "animate-spin")} />
            Cancel Job
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
