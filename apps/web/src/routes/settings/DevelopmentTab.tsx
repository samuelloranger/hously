import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useTriggerAction,
  useScheduledJobs,
  useTestEmail,
  useTestEmailTemplates,
  formatCronTrigger,
} from '@hously/shared';
import { UnifiedTaskCard, type UnifiedTask } from './components/UnifiedTaskCard';

type Action = 'check_reminders' | 'check_all_day_events' | 'cleanup_notifications';

interface ActionConfig {
  id: Action;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  jobName?: string; // Job name to match with BullMQ scheduled jobs
}

const actions: ActionConfig[] = [
  {
    id: 'check_reminders',
    labelKey: 'settings.development.actions.checkReminders.label',
    descriptionKey: 'settings.development.actions.checkReminders.description',
    icon: '⏰',
    jobName: 'check-reminders',
  },
  {
    id: 'check_all_day_events',
    labelKey: 'settings.development.actions.checkAllDayEvents.label',
    descriptionKey: 'settings.development.actions.checkAllDayEvents.description',
    icon: '📆',
    jobName: 'check-all-day-events',
  },
  {
    id: 'cleanup_notifications',
    labelKey: 'settings.development.actions.cleanupNotifications.label',
    descriptionKey: 'settings.development.actions.cleanupNotifications.description',
    icon: '🧹',
    jobName: 'cleanup-notifications',
  },
];

export function DevelopmentTab() {
  const { t, i18n } = useTranslation('common');
  const { mutateAsync: triggerAction } = useTriggerAction();
  const { mutateAsync: testEmail, isPending: isTestingEmail } = useTestEmail();
  const { data: templatesData, isLoading: isLoadingTemplates } = useTestEmailTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('test');
  const [executingAction, setExecutingAction] = useState<Action | null>(null);
  const { data: scheduledJobsData, isLoading: isLoadingJobs } = useScheduledJobs();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second to refresh the countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTriggerAction = async (action: Action) => {
    setExecutingAction(action);
    try {
      await triggerAction(action);
      toast.success(t('settings.development.actionSuccess'));
    } catch (error) {
      console.error('Error triggering action:', error);
      toast.error(t('settings.development.actionError'));
    } finally {
      setExecutingAction(null);
    }
  };

  const handleTestEmail = async () => {
    try {
      const result = await testEmail(selectedTemplateId);
      toast.success(result.message || t('settings.development.testEmail.success'));
    } catch (error: any) {
      console.error('Error testing email:', error);
      const errorMessage = error?.response?.data?.error || error?.message || t('settings.development.testEmail.error');
      toast.error(errorMessage);
    }
  };

  // Create a map of job names to actions for matching scheduled jobs
  const jobToActionMap = new Map<string, ActionConfig>();
  actions.forEach(action => {
    if (action.jobName) {
      jobToActionMap.set(action.jobName, action);
    }
  });

  // Merge scheduled jobs and actions into unified tasks
  const unifiedTasks: UnifiedTask[] = [];

  // Add scheduled jobs (matched with actions if possible)
  scheduledJobsData?.jobs.forEach(job => {
    const matchedAction = jobToActionMap.get(job.name);
    if (matchedAction) {
      // Job matches an action - use action's icon and label
      unifiedTasks.push({
        id: job.id,
        name: t(matchedAction.labelKey),
        description: t(matchedAction.descriptionKey),
        icon: matchedAction.icon,
        actionId: matchedAction.id,
        isScheduled: true,
        nextRunTime: job.next_run_time ? new Date(job.next_run_time) : null,
        trigger: job.trigger,
      });
    } else {
      // Job doesn't match an action - use job's own info
      unifiedTasks.push({
        id: job.id,
        name: job.name,
        description: formatCronTrigger(job.trigger, i18n.language),
        icon: '⏱️',
        actionId: null,
        isScheduled: true,
        nextRunTime: job.next_run_time ? new Date(job.next_run_time) : null,
        trigger: job.trigger,
      });
    }
  });

  // Add actions that don't have scheduled jobs
  actions.forEach(action => {
    const hasScheduledJob = scheduledJobsData?.jobs.some(job => job.name === action.jobName);
    if (!hasScheduledJob) {
      unifiedTasks.push({
        id: action.id,
        name: t(action.labelKey),
        description: t(action.descriptionKey),
        icon: action.icon,
        actionId: action.id,
        isScheduled: false,
        nextRunTime: null,
        trigger: null,
      });
    }
  });

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="development-tab">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
            {t('settings.development.actions.title')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t('settings.development.actions.subtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoadingJobs ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
              ))
            ) : (
              unifiedTasks.map(task => (
                <UnifiedTaskCard
                  key={task.id}
                  task={task}
                  currentTime={currentTime}
                  executingAction={executingAction}
                  onTriggerAction={handleTriggerAction}
                />
              ))
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">
            {t('settings.development.testEmail.title')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t('settings.development.testEmail.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoadingTemplates || isTestingEmail}
            >
              <option value="test">{t('settings.development.testEmail.defaultTemplate')}</option>
              {templatesData?.templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.id})
                </option>
              ))}
            </select>
            <button
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap"
            >
              {isTestingEmail ? t('settings.development.testEmail.sending') : t('settings.development.testEmail.button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
