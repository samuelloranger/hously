import { useTranslation } from "react-i18next";
import type { NotificationTemplate } from "../../../features/external-notifications/api";
import { ServiceTemplateItem } from "./ServiceTemplateItem";

interface ServiceTemplatesListProps {
  templatesByEvent: Record<string, NotificationTemplate[]>;
  onEditTemplate: (eventType: string) => void;
}

export function ServiceTemplatesList({
  templatesByEvent,
  onEditTemplate,
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
        const template = eventTemplates[0]; // Get first template for this event type
        return (
          <ServiceTemplateItem
            key={eventType}
            template={template}
            eventType={eventType}
            onEdit={() => onEditTemplate(eventType)}
          />
        );
      })}
    </div>
  );
}
