import { useTranslation } from "react-i18next";
import type { ExternalNotificationService } from "@hously/shared/types";
import { Switch } from "@/components/ui/switch";
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
      <Switch
        id={`notify-admins-only-${service.id}`}
        checked={service.notify_admins_only}
        onCheckedChange={onToggle}
        disabled={isLoading}
        aria-label={t("settings.externalNotifications.notifyAdminsOnly")}
      />
    </div>
  );
}
