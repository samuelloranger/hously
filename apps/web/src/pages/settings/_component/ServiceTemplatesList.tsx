import { useTranslation } from "react-i18next";
import type { NotificationTemplate } from "@hously/shared";
import { ServiceTemplateItem } from "@/pages/settings/_component/ServiceTemplateItem";

interface ServiceTemplatesListProps {
  templatesByEvent: Record<string, NotificationTemplate[]>;
  togglingEventType: string | null;
  onEditTemplate: (eventType: string) => void;
  onToggleTemplate: (eventType: string, enabled: boolean) => void;
}

export function ServiceTemplatesList({
  templatesByEvent,
  togglingEventType,
  onEditTemplate,
  onToggleTemplate,
}: ServiceTemplatesListProps) {
  const { t } = useTranslation("common");
  const eventTypes = Object.keys(templatesByEvent).sort();

  if (eventTypes.length === 0) {
    return (
      <div className="text-center py-4 text-neutral-500 dark:text-neutral-400 text-sm">
        {t("settings.externalNotifications.noTemplates")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {eventTypes.map((eventType) => {
        const eventTemplates = templatesByEvent[eventType];
        const template = eventTemplates[0];
        return (
          <ServiceTemplateItem
            key={eventType}
            template={template}
            eventType={eventType}
            isToggling={togglingEventType === eventType}
            onEdit={() => onEditTemplate(eventType)}
            onToggle={() => onToggleTemplate(eventType, !template.enabled)}
          />
        );
      })}
    </div>
  );
}
