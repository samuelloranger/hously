import { useTranslation } from "react-i18next";
import type { ExternalNotificationService } from "@hously/shared/types";
import { Switch } from "@/components/ui/switch";
interface ServiceToggleProps {
  service: ExternalNotificationService;
  isLoading: boolean;
  onToggle: () => void;
}

export function ServiceToggle({
  service,
  isLoading,
  onToggle,
}: ServiceToggleProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-600">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t("settings.externalNotifications.enableService")}
      </label>
      <Switch
        checked={service.enabled}
        onCheckedChange={onToggle}
        disabled={isLoading}
      />
    </div>
  );
}
