import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { formatCronTrigger, useScheduledJobs, useTriggerAction, useCurrentUser } from '@hously/shared';
import { LoadingState } from '@/components/LoadingState';

type JobAction =
  | 'check_reminders'
  | 'check_all_day_events'
  | 'cleanup_notifications'
  | 'fetch_c411_stats'
  | 'fetch_torr9_stats'
  | 'fetch_la_cale_stats'
  | 'refresh_upcoming'
  | 'refresh_habits_streaks';

type JobConfig = {
  action: JobAction;
  jobNames: string[];
  icon: string;
  labelKey: string;
  descriptionKey: string;
};

const JOBS: JobConfig[] = [
  {
    action: 'check_reminders',
    jobNames: ['check-reminders'],
    icon: '⏰',
    labelKey: 'settings.jobs.actions.checkReminders.label',
    descriptionKey: 'settings.jobs.actions.checkReminders.description',
  },
  {
    action: 'check_all_day_events',
    jobNames: ['check-all-day-events'],
    icon: '📆',
    labelKey: 'settings.jobs.actions.checkAllDayEvents.label',
    descriptionKey: 'settings.jobs.actions.checkAllDayEvents.description',
  },
  {
    action: 'cleanup_notifications',
    jobNames: ['cleanup-notifications'],
    icon: '🧹',
    labelKey: 'settings.jobs.actions.cleanupNotifications.label',
    descriptionKey: 'settings.jobs.actions.cleanupNotifications.description',
  },
  {
    action: 'fetch_c411_stats',
    jobNames: ['fetch-c411-stats'],
    icon: '🧾',
    labelKey: 'settings.jobs.actions.fetchC411Stats.label',
    descriptionKey: 'settings.jobs.actions.fetchC411Stats.description',
  },
  {
    action: 'fetch_torr9_stats',
    jobNames: ['fetch-torr9-stats'],
    icon: '🧾',
    labelKey: 'settings.jobs.actions.fetchTorr9Stats.label',
    descriptionKey: 'settings.jobs.actions.fetchTorr9Stats.description',
  },
  {
    action: 'fetch_la_cale_stats',
    jobNames: ['fetch-la-cale-stats'],
    icon: '🧾',
    labelKey: 'settings.jobs.actions.fetchLaCaleStats.label',
    descriptionKey: 'settings.jobs.actions.fetchLaCaleStats.description',
  },
  {
    action: 'refresh_upcoming',
    jobNames: ['refresh-upcoming'],
    icon: '🎥',
    labelKey: 'settings.jobs.actions.refreshUpcoming.label',
    descriptionKey: 'settings.jobs.actions.refreshUpcoming.description',
  },
  {
    action: 'refresh_habits_streaks',
    jobNames: ['refresh-habits-streaks'],
    icon: '🔥',
    labelKey: 'settings.jobs.actions.refreshHabitsStreaks.label',
    descriptionKey: 'settings.jobs.actions.refreshHabitsStreaks.description',
  },
];

const getStatusColor = (status: string | null) => {
  switch (status) {
    case 'active': return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30';
    case 'waiting': return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
    case 'failed': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    case 'completed': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
  }
};

export function JobsTab() {
  const { t, i18n } = useTranslation('common');
  const { data: currentUser } = useCurrentUser();
  const { data: scheduledJobsData, isLoading, error } = useScheduledJobs();
  const { mutateAsync: triggerAction } = useTriggerAction();
  const [executing, setExecuting] = useState<JobAction | null>(null);

  const jobsByName = useMemo(() => {
    const map = new Map<string, JobConfig>();
    JOBS.forEach(job => {
      job.jobNames.forEach(name => map.set(name, job));
    });
    return map;
  }, []);

  const handleRun = async (action: JobAction) => {
    setExecuting(action);
    try {
      const result = await triggerAction(action);
      toast.success(result.message || t('settings.jobs.success'));
    } catch (err: any) {
      console.error('Error running job:', err);
      toast.error(err?.message || t('settings.jobs.error'));
    } finally {
      setExecuting(null);
    }
  };

  if (!currentUser?.is_admin) return null;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="jobs-tab">
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
        <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
          {t('settings.jobs.title')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.jobs.description')}</p>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">{t('settings.jobs.loadError')}</div>
        ) : scheduledJobsData?.jobs?.length ? (
          <div className="space-y-4">
            {scheduledJobsData.jobs.map(job => {
              const config = jobsByName.get(job.name);
              const action = config?.action ?? null;
              const icon = config?.icon ?? '⏱️';
              const title = config ? t(config.labelKey) : job.name;
              const description = config ? t(config.descriptionKey) : formatCronTrigger(job.trigger, i18n.language);

              return (
                <div
                  key={job.id}
                  className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-neutral-50 dark:bg-neutral-900/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{icon}</span>
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{title}</h3>
                        {job.status && (
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ml-2 ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1.5">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Schedule:</span>
                          {formatCronTrigger(job.trigger, i18n.language)}
                        </span>
                        {job.next_run_time && (
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300">Next:</span>
                            {new Date(job.next_run_time).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => action && handleRun(action)}
                        disabled={!action || executing !== null || job.status === 'active'}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {executing === action || job.status === 'active' ? t('settings.jobs.running') : t('settings.jobs.run')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-neutral-600 dark:text-neutral-400">{t('settings.jobs.noJobs')}</div>
        )}
      </div>
    </div>
  );
}
