import { useTranslation } from 'react-i18next';
import { formatCronTrigger, formatTimeUntil } from '@hously/shared';

type Action = 'check_reminders' | 'check_all_day_events' | 'cleanup_notifications';

export interface UnifiedTask {
  id: string;
  name: string;
  description: string;
  icon: string;
  actionId: Action | null;
  isScheduled: boolean;
  nextRunTime: Date | null;
  trigger: string | null;
}

interface UnifiedTaskCardProps {
  task: UnifiedTask;
  executingAction: Action | null;
  currentTime: Date;
  onTriggerAction: (action: Action) => void;
}

export function UnifiedTaskCard({ task, executingAction, currentTime, onTriggerAction }: UnifiedTaskCardProps) {
  const { t, i18n } = useTranslation('common');

  const nextRun = task.nextRunTime;
  const timeUntilNext = nextRun ? Math.max(0, Math.floor((nextRun.getTime() - currentTime.getTime()) / 1000)) : null;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 bg-neutral-50 dark:bg-neutral-900/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{task.icon}</span>
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">{task.name}</h3>
          </div>
          <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
            <div className="flex-1 text-sm">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{task.description}</p>
              {task.isScheduled && task.trigger && task.actionId && (
                <p className=" text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  {formatCronTrigger(task.trigger, i18n.language)}
                </p>
              )}
              {nextRun && (
                <>
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {t('settings.development.scheduledJobs.nextRun')}:{' '}
                  </span>
                  <span className="font-mono text-neutral-900 dark:text-neutral-100">
                    {nextRun.toLocaleString().replace(/ /g, '\u00A0')}{' '}
                  </span>
                  {timeUntilNext !== null && timeUntilNext > 0 && (
                    <span className=" text-neutral-500 dark:text-neutral-400">({formatTimeUntil(timeUntilNext)})</span>
                  )}
                </>
              )}
            </div>
            {task.actionId && (
              <div className="w-full md:w-auto flex justify-end">
                <button
                  onClick={() => onTriggerAction(task.actionId!)}
                  disabled={executingAction !== null}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap ml-4"
                >
                  {executingAction === task.actionId
                    ? t('settings.development.executing')
                    : t('settings.development.execute')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
