import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useTriggerAction,
  useScheduledJobs,
  useTestEmail,
  useTestEmailTemplates,
} from "../../features/admin/hooks";
import type { EmailTemplate } from "../../features/admin/api";
import { formatCronTrigger } from "../../lib/utils";
import {
  UnifiedTaskCard,
  type UnifiedTask,
} from "./components/UnifiedTaskCard";

type Action =
  | "check_reminders"
  | "check_all_day_events"
  | "cleanup_notifications";

interface ActionConfig {
  id: Action;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  funcName?: string; // Function name to match with scheduled jobs
}

const actions: ActionConfig[] = [
  {
    id: "check_reminders",
    labelKey: "settings.development.actions.checkReminders.label",
    descriptionKey: "settings.development.actions.checkReminders.description",
    icon: "⏰",
    funcName: "check_and_send_reminders",
  },
  {
    id: "check_all_day_events",
    labelKey: "settings.development.actions.checkAllDayEvents.label",
    descriptionKey:
      "settings.development.actions.checkAllDayEvents.description",
    icon: "📆",
    funcName: "check_and_send_all_day_custom_event_notifications",
  },
  {
    id: "cleanup_notifications",
    labelKey: "settings.development.actions.cleanupNotifications.label",
    descriptionKey:
      "settings.development.actions.cleanupNotifications.description",
    icon: "🧹",
    funcName: "cleanup_old_notifications",
  },
];

export function DevelopmentTab() {
  const { t, i18n } = useTranslation("common");
  const { mutateAsync: triggerAction } = useTriggerAction();
  const { mutateAsync: testEmail, isPending: isTestingEmail } = useTestEmail();
  const { data: templatesData, isLoading: isLoadingTemplates } =
    useTestEmailTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("test");
  const [executingAction, setExecutingAction] = useState<Action | null>(null);
  const { data: scheduledJobsData, isLoading: isLoadingJobs } =
    useScheduledJobs();
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
      toast.success(t("settings.development.actionSuccess"));
    } catch (error) {
      console.error("Error triggering action:", error);
      toast.error(t("settings.development.actionError"));
    } finally {
      setExecutingAction(null);
    }
  };

  const handleTestEmail = async () => {
    try {
      const result = await testEmail(selectedTemplateId);
      toast.success(
        result.message || t("settings.development.testEmail.success"),
      );
    } catch (error: any) {
      console.error("Error testing email:", error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        t("settings.development.testEmail.error");
      toast.error(errorMessage);
    }
  };

  // Create a map of function names to actions for matching scheduled jobs
  const funcToActionMap = new Map<string, ActionConfig>();
  actions.forEach((action) => {
    if (action.funcName) {
      funcToActionMap.set(action.funcName, action);
    }
  });

  // Merge scheduled jobs and actions into unified tasks
  const unifiedTasks: UnifiedTask[] = [];

  // Add scheduled jobs (matched with actions if possible)
  scheduledJobsData?.jobs.forEach((job) => {
    const matchedAction = funcToActionMap.get(job.func);
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
        icon: "⏱️",
        actionId: null,
        isScheduled: true,
        nextRunTime: job.next_run_time ? new Date(job.next_run_time) : null,
        trigger: job.trigger,
      });
    }
  });

  // Add actions that don't have scheduled jobs
  actions.forEach((action) => {
    const hasScheduledJob = scheduledJobsData?.jobs.some(
      (job) => job.func === action.funcName,
    );
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
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300"
      key="development-tab"
    >
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
          {t("settings.development.title")}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t("settings.development.description")}
        </p>

        {/* Tasks and Actions Section */}
        <div>
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
            {t("settings.development.scheduledJobs.title")}
          </h3>
          {isLoadingJobs ? (
            <div className="text-neutral-600 dark:text-neutral-400">
              {t("settings.development.scheduledJobs.loading")}
            </div>
          ) : (
            <>
              {scheduledJobsData?.scheduler_running === false && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    {scheduledJobsData.message ||
                      t("settings.development.scheduledJobs.notRunning")}
                  </p>
                </div>
              )}
              <div className="space-y-4">
                {unifiedTasks.map((task) => (
                  <UnifiedTaskCard
                    key={task.id}
                    task={task}
                    executingAction={executingAction}
                    currentTime={currentTime}
                    onTriggerAction={handleTriggerAction}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Email Testing Section */}
        <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold mb-4 text-neutral-900 dark:text-neutral-100">
            {t("settings.development.testEmail.title")}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {t("settings.development.testEmail.description")}
          </p>

          {/* Template Selector */}
          {isLoadingTemplates ? (
            <div className="text-neutral-600 dark:text-neutral-400 mb-4">
              {t("settings.development.testEmail.loadingTemplates")}
            </div>
          ) : (
            <div className="mb-4">
              <label
                htmlFor="email-template-select"
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
              >
                {t("settings.development.testEmail.selectTemplate")}
              </label>
              <select
                id="email-template-select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={isTestingEmail}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {templatesData?.templates.map((template: EmailTemplate) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.description}
                  </option>
                ))}
              </select>
              {templatesData?.templates.find(
                (t) => t.id === selectedTemplateId,
              ) && (
                <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-900 rounded-lg text-sm">
                  <div className="font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                    {
                      templatesData.templates.find(
                        (t) => t.id === selectedTemplateId,
                      )?.title
                    }
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                    {
                      templatesData.templates.find(
                        (t) => t.id === selectedTemplateId,
                      )?.body
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleTestEmail}
            disabled={isTestingEmail || isLoadingTemplates}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isTestingEmail ? (
              <>
                <span className="animate-spin">⏳</span>
                {t("settings.development.testEmail.sending")}
              </>
            ) : (
              <>
                <span>📧</span>
                {t("settings.development.testEmail.button")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
