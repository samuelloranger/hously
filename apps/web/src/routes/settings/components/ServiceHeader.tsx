import { useTranslation } from "react-i18next";
import type { ExternalNotificationService } from "../../../features/external-notifications/api";
import { ChevronDown } from "lucide-react";

interface ServiceHeaderProps {
  service: ExternalNotificationService;
  isOpen: boolean;
  onToggle: () => void;
}

export function ServiceHeader({
  service,
  isOpen,
  onToggle,
}: ServiceHeaderProps) {
  const { t } = useTranslation("common");

  const serviceDisplayName =
    t(`settings.externalNotifications.serviceNames.${service.service_name}`, {
      defaultValue: service.service_name,
    }) || service.service_name;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
            {serviceDisplayName}
          </h3>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              service.enabled
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
            }`}
          >
            {service.enabled
              ? t("settings.externalNotifications.enabled")
              : t("settings.externalNotifications.disabled")}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          aria-label={isOpen ? t("common.collapse") : t("common.expand")}
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
}
