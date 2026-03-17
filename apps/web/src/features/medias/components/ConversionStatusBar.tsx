import { useTranslation } from 'react-i18next';
import { Zap, MoreVertical, XCircle, ExternalLink } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useActiveMediaConversions, type MediaConversionJob } from '@hously/shared';
import { cn } from '@/lib/utils';

export function ConversionStatusBar() {
  const { data } = useActiveMediaConversions({ enabled: true, refetchInterval: 2000 });
  const activeJobs = data?.jobs ?? [];

  if (activeJobs.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {activeJobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}

function JobRow({ job }: { job: MediaConversionJob }) {
  const { t } = useTranslation('common');
  
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

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
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
        
        {/* Center: Progress */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="flex items-center justify-between text-[11px] mb-2 font-bold tabular-nums">
            <span className="text-indigo-600 dark:text-indigo-400">{Math.round(job.progress)}%</span>
            <span className="text-neutral-500 dark:text-neutral-500 font-medium italic">
              {job.eta_seconds ? `~${formatDuration(job.eta_seconds)} ${t('medias.convert.etaSuffix') || 'left'}` : isRunning ? t('common.loading') : t('medias.convert.status.queued')}
            </span>
          </div>
          <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-out",
                isRunning ? "bg-indigo-600 dark:bg-indigo-500" : "bg-amber-400 dark:bg-amber-600"
              )}
              style={{ width: `${Math.max(2, job.progress)}%` }}
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <div className="text-right hidden md:block mr-2">
            {job.speed && <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter italic">{job.speed} speed</p>}
            {job.fps && <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tighter italic">{Math.round(job.fps)} fps</p>}
          </div>

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
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg outline-none cursor-pointer">
                  <ExternalLink size={14} />
                  View Media
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-neutral-100 dark:bg-neutral-800 my-1" />
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg outline-none cursor-pointer">
                  <XCircle size={14} />
                  Cancel Job
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
}
