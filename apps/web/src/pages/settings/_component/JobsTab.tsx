import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useScheduledJobs,
  useTriggerAction,
  useJobHistory,
  useRetryJob,
  useRetryFailed,
  useCleanQueue,
} from "@/pages/settings/useAdmin";
import { useCurrentUser } from "@/lib/auth/useAuth";
import { formatCronTrigger } from "@/lib/utils/format";
import { LoadingState } from "@/components/LoadingState";
import {
  ChevronDown,
  ChevronRight,
  Play,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Timer,
} from "lucide-react";
import type { QueueStat, QueueJob } from "@hously/shared/types";
import { ADMIN_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

// ---------------------------------------------------------------------------
// Job action config
// ---------------------------------------------------------------------------

type JobAction =
  | "check_reminders"
  | "check_all_day_events"
  | "check_habit_reminders"
  | "cleanup_notifications"
  | "fetch_c411_stats"
  | "fetch_torr9_stats"
  | "fetch_la_cale_stats"
  | "refresh_upcoming"
  | "refresh_habits_streaks"
  | "check_movie_release_reminders"
  | "check_library_movie_releases"
  | "check_library_episode_releases"
  | "sync_library_show_episodes"
  | "check_library_download_completion";

type JobConfig = {
  action: JobAction;
  jobNames: string[];
  icon: string;
  labelKey: string;
  descriptionKey: string;
};

const JOBS: JobConfig[] = [
  {
    action: "check_reminders",
    jobNames: ["check-reminders"],
    icon: "⏰",
    labelKey: "settings.jobs.actions.checkReminders.label",
    descriptionKey: "settings.jobs.actions.checkReminders.description",
  },
  {
    action: "check_all_day_events",
    jobNames: ["check-all-day-events"],
    icon: "📆",
    labelKey: "settings.jobs.actions.checkAllDayEvents.label",
    descriptionKey: "settings.jobs.actions.checkAllDayEvents.description",
  },
  {
    action: "check_habit_reminders",
    jobNames: ["check-habit-reminders"],
    icon: "🧘",
    labelKey: "settings.jobs.actions.checkHabitReminders.label",
    descriptionKey: "settings.jobs.actions.checkHabitReminders.description",
  },
  {
    action: "cleanup_notifications",
    jobNames: ["cleanup-notifications"],
    icon: "🧹",
    labelKey: "settings.jobs.actions.cleanupNotifications.label",
    descriptionKey: "settings.jobs.actions.cleanupNotifications.description",
  },
  {
    action: "fetch_c411_stats",
    jobNames: ["fetch-c411-stats"],
    icon: "🧾",
    labelKey: "settings.jobs.actions.fetchC411Stats.label",
    descriptionKey: "settings.jobs.actions.fetchC411Stats.description",
  },
  {
    action: "fetch_torr9_stats",
    jobNames: ["fetch-torr9-stats"],
    icon: "🧾",
    labelKey: "settings.jobs.actions.fetchTorr9Stats.label",
    descriptionKey: "settings.jobs.actions.fetchTorr9Stats.description",
  },
  {
    action: "fetch_la_cale_stats",
    jobNames: ["fetch-la-cale-stats"],
    icon: "🧾",
    labelKey: "settings.jobs.actions.fetchLaCaleStats.label",
    descriptionKey: "settings.jobs.actions.fetchLaCaleStats.description",
  },
  {
    action: "refresh_upcoming",
    jobNames: ["refresh-upcoming"],
    icon: "🎥",
    labelKey: "settings.jobs.actions.refreshUpcoming.label",
    descriptionKey: "settings.jobs.actions.refreshUpcoming.description",
  },
  {
    action: "refresh_habits_streaks",
    jobNames: ["refresh-habits-streaks"],
    icon: "🔥",
    labelKey: "settings.jobs.actions.refreshHabitsStreaks.label",
    descriptionKey: "settings.jobs.actions.refreshHabitsStreaks.description",
  },
  {
    action: "check_movie_release_reminders",
    jobNames: ["check-movie-release-reminders"],
    icon: "🎬",
    labelKey: "settings.jobs.actions.checkMovieReleaseReminders.label",
    descriptionKey:
      "settings.jobs.actions.checkMovieReleaseReminders.description",
  },
  {
    action: "check_library_movie_releases",
    jobNames: ["check-library-movie-releases"],
    icon: "🎞️",
    labelKey: "settings.jobs.actions.checkLibraryMovieReleases.label",
    descriptionKey:
      "settings.jobs.actions.checkLibraryMovieReleases.description",
  },
  {
    action: "check_library_episode_releases",
    jobNames: ["check-library-episode-releases"],
    icon: "📺",
    labelKey: "settings.jobs.actions.checkLibraryEpisodeReleases.label",
    descriptionKey:
      "settings.jobs.actions.checkLibraryEpisodeReleases.description",
  },
  {
    action: "sync_library_show_episodes",
    jobNames: ["sync-library-show-episodes"],
    icon: "🔄",
    labelKey: "settings.jobs.actions.syncLibraryShowEpisodes.label",
    descriptionKey: "settings.jobs.actions.syncLibraryShowEpisodes.description",
  },
  {
    action: "check_library_download_completion",
    jobNames: ["check-library-download-completion"],
    icon: "⬇️",
    labelKey: "settings.jobs.actions.checkLibraryDownloadCompletion.label",
    descriptionKey:
      "settings.jobs.actions.checkLibraryDownloadCompletion.description",
  },
];

// ---------------------------------------------------------------------------
// Queue name display mapping
// ---------------------------------------------------------------------------

const QUEUE_DISPLAY_NAMES: Record<string, string> = {
  "Scheduled Tasks": "scheduled-tasks",
  Notifications: "notifications",
  "Activity Logs": "activity-logs",
  Default: "default",
  "Library Migrate": "library-migrate",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getStatusColor = (status: string | null) => {
  switch (status) {
    case "active":
      return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
    case "waiting":
      return "text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30";
    case "failed":
      return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30";
    case "completed":
      return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
    default:
      return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30";
  }
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ---------------------------------------------------------------------------
// Queue Card with inline accordion
// ---------------------------------------------------------------------------

function QueueCard({
  stat,
  t,
}: {
  stat: QueueStat;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const fetcher = useFetcher();
  const [expanded, setExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("failed");
  const queueSlug = QUEUE_DISPLAY_NAMES[stat.name] ?? stat.name;

  const { mutateAsync: retryFailed, isPending: retryingAll } = useRetryFailed();
  const { mutateAsync: cleanQueue, isPending: cleaning } = useCleanQueue();
  const { mutateAsync: retryJob } = useRetryJob();

  const {
    data: queueJobs,
    isLoading: jobsLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.admin.queueJobs(queueSlug, statusFilter),
    queryFn: () =>
      fetcher<QueueJob[]>(
        `${ADMIN_ENDPOINTS.QUEUE_JOBS(queueSlug)}?status=${statusFilter}&limit=30`,
      ),
    enabled: expanded,
    refetchInterval: expanded ? 5000 : false,
  });

  const handleRetryAll = async () => {
    if (
      !confirm(t("settings.jobs.queues.retryAllConfirm", { queue: stat.name }))
    )
      return;
    try {
      const result = await retryFailed(queueSlug);
      toast.success(
        t("settings.jobs.queues.retrySuccess", { count: result.retried }),
      );
    } catch {
      toast.error(t("settings.jobs.error"));
    }
  };

  const handleClean = async (status: "completed" | "failed") => {
    if (
      !confirm(
        t("settings.jobs.queues.cleanConfirm", {
          status,
          queue: stat.name,
        }),
      )
    )
      return;
    try {
      const result = await cleanQueue({ queue: queueSlug, status });
      toast.success(
        t("settings.jobs.queues.cleanSuccess", { count: result.cleaned }),
      );
    } catch {
      toast.error(t("settings.jobs.error"));
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob({ queue: queueSlug, jobId });
      toast.success(t("settings.jobs.queues.retryJobSuccess"));
      refetch();
    } catch {
      toast.error(t("settings.jobs.error"));
    }
  };

  const total =
    stat.waiting + stat.active + stat.completed + stat.failed + stat.delayed;

  const statusFilters = [
    { key: "failed", label: t("settings.jobs.queues.filterFailed") },
    { key: "active", label: t("settings.jobs.queues.filterActive") },
    { key: "waiting", label: t("settings.jobs.queues.filterWaiting") },
    { key: "completed", label: t("settings.jobs.queues.filterCompleted") },
  ];

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="size-4 text-neutral-500" />
          ) : (
            <ChevronRight className="size-4 text-neutral-500" />
          )}
          <div>
            <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
              {stat.name}
            </h4>
            <p className="text-xs text-neutral-500 mt-0.5">
              {t("settings.jobs.queues.totalJobs", { count: total })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stat.active > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Loader2 className="size-3 animate-spin" />
              {stat.active}
            </span>
          )}
          {stat.waiting > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Clock className="size-3" />
              {stat.waiting}
            </span>
          )}
          {stat.failed > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="size-3" />
              {stat.failed}
            </span>
          )}
          {stat.completed > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-3" />
              {stat.completed}
            </span>
          )}
          {stat.delayed > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
              <Timer className="size-3" />
              {stat.delayed}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {stat.failed > 0 && (
              <button
                onClick={handleRetryAll}
                disabled={retryingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="size-3" />
                {t("settings.jobs.queues.retryAll")}
              </button>
            )}
            {stat.completed > 0 && (
              <button
                onClick={() => handleClean("completed")}
                disabled={cleaning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="size-3" />
                {t("settings.jobs.queues.cleanCompleted")}
              </button>
            )}
            {stat.failed > 0 && (
              <button
                onClick={() => handleClean("failed")}
                disabled={cleaning}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="size-3" />
                {t("settings.jobs.queues.cleanFailed")}
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                  statusFilter === f.key
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Job list */}
          {jobsLoading ? (
            <div className="py-4 text-center text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin mx-auto mb-1" />
            </div>
          ) : !queueJobs?.length ? (
            <p className="py-3 text-center text-xs text-neutral-500">
              {t("settings.jobs.queues.noJobs")}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {queueJobs.map((job) => (
                <QueueJobRow
                  key={job.id}
                  job={job}
                  onRetry={handleRetryJob}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue Job Row
// ---------------------------------------------------------------------------

function QueueJobRow({
  job,
  onRetry,
  t,
}: {
  job: QueueJob;
  onRetry: (jobId: string) => void;
  t: (key: string) => string;
}) {
  const [showTrace, setShowTrace] = useState(false);
  const duration =
    job.finishedOn && job.processedOn
      ? new Date(job.finishedOn).getTime() - new Date(job.processedOn).getTime()
      : null;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-md p-3 bg-white dark:bg-neutral-800/50 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
              {job.name}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${getStatusColor(job.status)}`}
            >
              {job.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-neutral-500 dark:text-neutral-400">
            {job.timestamp && (
              <span>
                {timeAgo(job.timestamp)} {t("settings.jobs.history.ago")}
              </span>
            )}
            {duration !== null && (
              <span>
                {t("settings.jobs.queues.duration")} {formatDuration(duration)}
              </span>
            )}
            {job.attemptsMade > 0 && (
              <span>
                {t("settings.jobs.queues.attempts")} {job.attemptsMade}
              </span>
            )}
          </div>
          {job.failedReason && (
            <div className="mt-1.5">
              <p className="text-red-600 dark:text-red-400 break-all">
                {t("settings.jobs.queues.failedReason")} {job.failedReason}
              </p>
              {job.stacktrace?.length > 0 && (
                <button
                  onClick={() => setShowTrace(!showTrace)}
                  className="mt-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 underline"
                >
                  {t("settings.jobs.queues.stacktrace")}
                </button>
              )}
              {showTrace && (
                <pre className="mt-1 p-2 bg-neutral-100 dark:bg-neutral-900 rounded text-[10px] overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {job.stacktrace.join("\n")}
                </pre>
              )}
            </div>
          )}
        </div>
        {job.status === "failed" && (
          <button
            onClick={() => onRetry(job.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors shrink-0"
          >
            <RotateCcw className="size-3" />
            {t("settings.jobs.queues.retryJob")}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main JobsTab
// ---------------------------------------------------------------------------

export function JobsTab() {
  const { t, i18n } = useTranslation("common");
  const { data: currentUser } = useCurrentUser();
  const { data: scheduledJobsData, isLoading, error } = useScheduledJobs();
  const { data: historyData } = useJobHistory(50);
  const { mutateAsync: triggerAction } = useTriggerAction();
  const [executing, setExecuting] = useState<JobAction | null>(null);

  const jobsByName = useMemo(() => {
    const map = new Map<string, JobConfig>();
    JOBS.forEach((job) => {
      job.jobNames.forEach((name) => map.set(name, job));
    });
    return map;
  }, []);

  const handleRun = async (action: JobAction) => {
    setExecuting(action);
    try {
      const result = await triggerAction(action);
      toast.success(result.message || t("settings.jobs.success"));
    } catch (err: unknown) {
      console.error("Error running job:", err);
      toast.error(
        err instanceof Error ? err.message : t("settings.jobs.error"),
      );
    } finally {
      setExecuting(null);
    }
  };

  if (!currentUser?.is_admin) return null;

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6"
      key="jobs-tab"
    >
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
          {t("settings.jobs.title")}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t("settings.jobs.description")}
        </p>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">
            {t("settings.jobs.loadError")}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Queue Overview */}
            {scheduledJobsData?.queues && (
              <section>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  {t("settings.jobs.queues.title")}
                </h3>
                <div className="space-y-2">
                  {scheduledJobsData.queues.map((stat) => (
                    <QueueCard key={stat.name} stat={stat} t={t} />
                  ))}
                </div>
              </section>
            )}

            {/* Scheduled Jobs */}
            {scheduledJobsData?.jobs?.length ? (
              <section>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Scheduled Jobs
                </h3>
                <div className="space-y-3">
                  {scheduledJobsData.jobs.map((job) => {
                    const config = jobsByName.get(job.name);
                    const action = config?.action ?? null;
                    const icon = config?.icon ?? "⏱️";
                    const title = config ? t(config.labelKey) : job.name;
                    const description = config
                      ? t(config.descriptionKey)
                      : formatCronTrigger(job.trigger, i18n.language);

                    const isRunning =
                      (action !== null && executing === action) ||
                      job.status === "active";

                    return (
                      <div
                        key={job.id}
                        className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-neutral-50 dark:bg-neutral-900/50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xl">{icon}</span>
                              <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                                {title}
                              </h4>
                              {job.status && (
                                <span
                                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${getStatusColor(job.status)}`}
                                >
                                  {job.status}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">
                              {description}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                              <span className="flex items-center gap-1.5">
                                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                  {t("settings.jobs.schedule")}
                                </span>
                                {formatCronTrigger(job.trigger, i18n.language)}
                              </span>
                              {job.next_run_time && (
                                <span className="flex items-center gap-1.5">
                                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                                    {t("settings.jobs.next")}
                                  </span>
                                  {new Date(job.next_run_time).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => action && handleRun(action)}
                            disabled={
                              !action ||
                              executing !== null ||
                              job.status === "active"
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-sm shrink-0"
                          >
                            {isRunning ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Play className="size-3.5" />
                            )}
                            {isRunning
                              ? t("settings.jobs.running")
                              : t("settings.jobs.run")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="text-neutral-600 dark:text-neutral-400">
                {t("settings.jobs.noJobs")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Job History */}
      {historyData?.jobs && historyData.jobs.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            {t("settings.jobs.history.title")}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
            {t("settings.jobs.history.description")}
          </p>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {historyData.jobs.map((entry) => (
              <div
                key={`${entry.queue}-${entry.id}`}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-neutral-50 dark:bg-neutral-900/50 text-xs"
              >
                {entry.status === "completed" ? (
                  <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="size-3.5 text-red-500 shrink-0" />
                )}
                <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate min-w-0 flex-1">
                  {entry.name}
                </span>
                <span className="text-neutral-400 shrink-0">{entry.queue}</span>
                {entry.duration !== null && (
                  <span
                    className={`shrink-0 font-mono ${
                      entry.duration > 5000
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-neutral-500"
                    }`}
                  >
                    {formatDuration(entry.duration)}
                  </span>
                )}
                {entry.finished_on && (
                  <span className="text-neutral-400 shrink-0">
                    {timeAgo(entry.finished_on)}
                  </span>
                )}
                {entry.failed_reason && (
                  <span
                    className="text-red-500 truncate max-w-40 shrink-0"
                    title={entry.failed_reason}
                  >
                    {entry.failed_reason}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
