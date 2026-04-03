import { useTranslation } from "react-i18next";
import type { ExternalNotificationService } from "@hously/shared";

interface ServiceNotifyAdminsOnlyProps {
  service: ExternalNotificationService;
  isLoading: boolean;
  onToggle: () => void;
}

export function ServiceNotifyAdminsOnly({
  service,
  isLoading,
  onToggle,
}: ServiceNotifyAdminsOnlyProps) {
  const { t } = useTranslation("common");

  if (!service.enabled) {
    return null;
  }

  return (
    <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
      <div className="flex-1">
        <label
          htmlFor={`notify-admins-only-${service.id}`}
          className="text-sm font-medium text-neutral-900 dark:text-neutral-100 cursor-pointer"
        >
          {t("settings.externalNotifications.notifyAdminsOnly")}
        </label>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {t("settings.externalNotifications.notifyAdminsOnlyDescription")}
        </p>
      </div>
      <button
        id={`notify-admins-only-${service.id}`}
        type="button"
        onClick={onToggle}
        disabled={isLoading}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          service.notify_admins_only
            ? "bg-primary-600"
            : "bg-neutral-200 dark:bg-neutral-700"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        role="switch"
        aria-checked={service.notify_admins_only}
        aria-label={t("settings.externalNotifications.notifyAdminsOnly")}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            service.notify_admins_only ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
