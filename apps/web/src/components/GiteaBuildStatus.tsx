import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { type DashboardGiteaBuildResponse, type GiteaStepSummary, DASHBOARD_ENDPOINTS, useDashboardGiteaBuilds } from '@hously/shared';
import { Check, Circle, Hammer, Loader2, X } from 'lucide-react';

const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '--';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

function useElapsed(startedAt: string | null | undefined) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0
  );

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    setElapsed(Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)));
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return elapsed;
}

function LiveElapsed({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsed(startedAt);
  return <>{formatDuration(elapsed)}</>;
}

type StatusDisplay = { label: string; dotClass: string; barClass: string };

const statusMap: Record<string, StatusDisplay> = {
  success: { label: 'Success', dotClass: 'bg-emerald-500', barClass: 'bg-emerald-500' },
  failure: { label: 'Failed', dotClass: 'bg-red-500', barClass: 'bg-red-500' },
  cancelled: { label: 'Cancelled', dotClass: 'bg-neutral-400', barClass: 'bg-neutral-400' },
  skipped: { label: 'Skipped', dotClass: 'bg-neutral-400', barClass: 'bg-neutral-400' },
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

function StepIcon({ status }: { status: GiteaStepSummary['status'] }) {
  switch (status) {
    case 'success':
      return <Check size={10} className="text-emerald-500" />;
    case 'failure':
      return <X size={10} className="text-red-500" />;
    case 'running':
      return <Loader2 size={10} className="text-amber-500 animate-spin" />;
    default:
      return <Circle size={8} className="text-neutral-300 dark:text-neutral-600" />;
  }
}

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

    let source: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource(DASHBOARD_ENDPOINTS.GITEA.STREAM, { withCredentials: true });
      source.onmessage = (event) => {
        try {
          setLiveData(JSON.parse(event.data) as DashboardGiteaBuildResponse);
        } catch {}
      };
      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      source?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  useEffect(() => {
    if (showLogs && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [liveData?.logs, showLogs]);

  const data = liveData;
  const isRunning = data?.building || data?.run?.status === 'running' || data?.run?.status === 'in_progress' || data?.run?.status === 'waiting' || data?.run?.status === 'queued' || data?.run?.status === 'pending';

  // Step-based progress
  const steps = data?.jobs?.[0]?.steps ?? [];
  const completedSteps = steps.filter(s => s.status === 'success' || s.status === 'failure').length;
  const totalSteps = steps.length;
  const stepProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Keep useElapsed hook call stable (before early return)
  const jobStartedAt = data?.jobs?.[0]?.started_at ?? data?.run?.created_at ?? null;
  useElapsed(isRunning ? jobStartedAt : null);

  if (!data?.enabled || !data?.run) return null;

  const runStatus = getStatusDisplay(data.run.status, data.run.conclusion ?? data.jobs?.[0]?.conclusion ?? null);

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
          {isRunning && totalSteps > 0 ? (
            <span className="text-[11px] tabular-nums text-amber-500 dark:text-amber-400 font-medium shrink-0">
              {completedSteps}/{totalSteps}
            </span>
          ) : isRunning ? (
            <Loader2 size={14} className="text-amber-500 animate-spin shrink-0" />
          ) : (
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
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {runStatus.label}{data.run.duration_seconds != null && !isRunning ? ` · ${formatDuration(data.run.duration_seconds)}` : ''}
                </span>
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
              <div className="space-y-2 mb-3">
                {data.jobs.map((job) => {
                  const display = getStatusDisplay(job.status, job.conclusion);
                  return (
                    <div key={job.id}>
                      {/* Job header */}
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-t-md bg-neutral-50 dark:bg-neutral-900/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${display.dotClass}`} />
                          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{job.name}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
                          {job.started_at && !job.completed_at
                            ? <LiveElapsed startedAt={job.started_at} />
                            : formatDuration(job.duration_seconds)}
                        </span>
                      </div>
                      {/* Steps inside job */}
                      {job.steps.length > 0 && (
                        <div className="border-x border-b border-neutral-100 dark:border-neutral-700/40 rounded-b-md px-2 py-1.5 space-y-1">
                          {job.steps.map((step, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="shrink-0 w-3.5 flex items-center justify-center">
                                <StepIcon status={step.status} />
                              </span>
                              <span className={`text-[11px] truncate ${
                                step.status === 'running' ? 'text-amber-600 dark:text-amber-400 font-medium' :
                                step.status === 'success' ? 'text-neutral-500 dark:text-neutral-400' :
                                step.status === 'failure' ? 'text-red-500' :
                                'text-neutral-400 dark:text-neutral-500'
                              }`}>
                                {step.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isRunning && totalSteps > 0 && (
              <div className="mb-3">
                <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${runStatus.barClass}`} style={{ width: `${stepProgress}%` }} />
                </div>
                <p className="text-[10px] text-neutral-400 mt-1 text-right tabular-nums">
                  {completedSteps}/{totalSteps}
                </p>
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
