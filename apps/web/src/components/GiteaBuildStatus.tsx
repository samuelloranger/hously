import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { type DashboardGiteaBuildResponse, DASHBOARD_ENDPOINTS, useDashboardGiteaBuilds } from '@hously/shared';
import { Hammer } from 'lucide-react';

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '--';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

type StatusDisplay = { label: string; dotClass: string; barClass: string };

const statusMap: Record<string, StatusDisplay> = {
  // Conclusions
  success: { label: 'Success', dotClass: 'bg-emerald-500', barClass: 'bg-emerald-500' },
  failure: { label: 'Failed', dotClass: 'bg-red-500', barClass: 'bg-red-500' },
  cancelled: { label: 'Cancelled', dotClass: 'bg-neutral-400', barClass: 'bg-neutral-400' },
  skipped: { label: 'Skipped', dotClass: 'bg-neutral-400', barClass: 'bg-neutral-400' },
  // Statuses
  running: { label: 'Running', dotClass: 'bg-amber-500 animate-pulse', barClass: 'bg-amber-500' },
  in_progress: { label: 'Running', dotClass: 'bg-amber-500 animate-pulse', barClass: 'bg-amber-500' },
  waiting: { label: 'Waiting', dotClass: 'bg-blue-400 animate-pulse', barClass: 'bg-blue-400' },
  queued: { label: 'Queued', dotClass: 'bg-blue-400 animate-pulse', barClass: 'bg-blue-400' },
  pending: { label: 'Pending', dotClass: 'bg-blue-400 animate-pulse', barClass: 'bg-blue-400' },
  completed: { label: 'Completed', dotClass: 'bg-emerald-500', barClass: 'bg-emerald-500' },
};

const getStatusDisplay = (status: string, conclusion: string | null): StatusDisplay => {
  if (conclusion && statusMap[conclusion]) return statusMap[conclusion];
  return statusMap[status] || { label: status.replace(/_/g, ' '), dotClass: 'bg-neutral-400', barClass: 'bg-neutral-400' };
};

export function GiteaBuildStatus() {
  const { t } = useTranslation('common');
  const { data: fallbackData } = useDashboardGiteaBuilds();
  const [liveData, setLiveData] = useState<DashboardGiteaBuildResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLiveData(fallbackData ?? null);
  }, [fallbackData]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(DASHBOARD_ENDPOINTS.GITEA.STREAM, { withCredentials: true });
    source.onmessage = (event) => {
      try {
        setLiveData(JSON.parse(event.data) as DashboardGiteaBuildResponse);
      } catch {}
    };

    return () => source.close();
  }, []);

  useEffect(() => {
    if (showLogs && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [liveData?.logs, showLogs]);

  const data = liveData;
  if (!data?.enabled || !data?.run) return null;

  const runStatus = getStatusDisplay(data.run.status, data.jobs?.[0]?.conclusion ?? null);
  const isRunning = data.building || data.run.status === 'running' || data.run.status === 'in_progress' || data.run.status === 'waiting' || data.run.status === 'queued' || data.run.status === 'pending';

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.04] hover:text-neutral-800 dark:hover:text-neutral-200 transition-all duration-150"
        >
          <div className="relative">
            <Hammer size={18} className={isRunning ? 'text-amber-500 dark:text-amber-400' : undefined} />
            <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${runStatus.dotClass}`} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <span className="truncate block">{t('dashboard.gitea.sidebarLabel', 'Build')}</span>
          </div>
          {isRunning && (
            <div className="w-12 h-1.5 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full animate-pulse ${runStatus.barClass}`} style={{ width: '66%' }} />
            </div>
          )}
          {!isRunning && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${runStatus.dotClass}`} />
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-[100] w-80 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 shadow-xl"
          side="right"
          sideOffset={12}
          align="end"
        >
          <div className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t('dashboard.gitea.title', 'Gitea Build')}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${runStatus.dotClass}`} />
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{runStatus.label}</span>
              </div>
            </div>

            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900/60 p-3 mb-3">
              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                {data.run.display_title}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                {data.run.head_sha.slice(0, 7)} on {data.run.head_branch}
              </p>
            </div>

            {data.jobs && data.jobs.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {data.jobs.map((job) => {
                  const display = getStatusDisplay(job.status, job.conclusion);
                  return (
                    <div key={job.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-neutral-50 dark:bg-neutral-900/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${display.dotClass}`} />
                        <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate">{job.name}</span>
                      </div>
                      <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
                        {formatDuration(job.duration_seconds)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {isRunning && (
              <div className="mb-3">
                <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div className={`h-full rounded-full animate-pulse ${runStatus.barClass}`} style={{ width: '66%' }} />
                </div>
              </div>
            )}

            {data.logs && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowLogs(!showLogs)}
                  className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline mb-2"
                >
                  {showLogs
                    ? t('dashboard.gitea.hideLogs', 'Hide logs')
                    : t('dashboard.gitea.showLogs', 'Show logs')}
                </button>
                {showLogs && (
                  <div
                    ref={logsRef}
                    className="max-h-40 overflow-auto rounded-lg bg-neutral-900 dark:bg-black p-2.5 font-mono text-[10px] leading-relaxed text-neutral-300 whitespace-pre-wrap break-all"
                  >
                    {data.logs}
                  </div>
                )}
              </div>
            )}
          </div>

          {data.error && (
            <div className="border-t border-neutral-200/60 dark:border-neutral-700/50 px-4 py-2">
              <p className="text-[11px] text-red-500">{data.error}</p>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
