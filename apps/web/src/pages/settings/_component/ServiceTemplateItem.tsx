import { useTranslation } from "react-i18next";
import type { NotificationTemplate } from "@hously/shared/types";
interface ServiceTemplateItemProps {
  template: NotificationTemplate;
  eventType: string;
  isToggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

export function ServiceTemplateItem({
  template,
  eventType,
  isToggling,
  onEdit,
  onToggle,
}: ServiceTemplateItemProps) {
  const { t } = useTranslation("common");

  return (
    <div
      className={`border border-neutral-200 dark:border-neutral-600 rounded-lg p-4 transition-colors ${template.enabled ? "hover:bg-neutral-100 dark:hover:bg-neutral-700" : "opacity-50"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
          {t(`settings.externalNotifications.events.${eventType}`) || eventType}
        </h4>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={template.enabled}
            onChange={onToggle}
            disabled={isToggling}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600"></div>
        </label>
      </div>
      {template.enabled && (
        <div className="flex items-center justify-between">
          <div className="flex-1 text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <div>
              <strong>{t("settings.externalNotifications.titleLabel")}:</strong>{" "}
              {template.title_template}
            </div>
            <div>
              <strong>{t("settings.externalNotifications.bodyLabel")}:</strong>{" "}
              {template.body_template}
            </div>
          </div>
          <button
            onClick={onEdit}
            className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
          >
            {t("settings.externalNotifications.edit")}
          </button>
        </div>
      )}
    </div>
  );
}
