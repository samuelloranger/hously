import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type NotificationTemplate } from "@hously/shared/types";
import { ServiceList } from "@/pages/settings/_component/ServiceList";
import { ServicesLogsList } from "@/pages/settings/_component/ServicesLogsList";
import { TemplateEditorModal } from "@/pages/settings/_component/TemplateEditorModal";
import { useExternalNotificationServices } from "@/hooks/useExternalNotifications";

interface EditingTemplateData {
  templates: NotificationTemplate[];
  eventType: string;
}

export function ExternalNotificationsTab() {
  const { t } = useTranslation("common");
  const [editingTemplateData, setEditingTemplateData] =
    useState<EditingTemplateData | null>(null);

  const { data: servicesData, isLoading: servicesLoading } =
    useExternalNotificationServices();

  const services = servicesData?.services || [];

  // Group templates by service_id (templates are now included in services)
  const templatesByService = services.reduce(
    (acc, service) => {
      acc[service.id] = service.templates || [];
      return acc;
    },
    {} as Record<number, NotificationTemplate[]>,
  );

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300"
      key="external-notifications-tab"
    >
      <div className="space-y-6">
        {/* Services Section */}
        <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
          {t("settings.externalNotifications.services")}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t("settings.externalNotifications.servicesDescription")}
        </p>
        <ServiceList
          services={services}
          templatesByService={templatesByService}
          isLoading={servicesLoading}
          onEditTemplate={(template: NotificationTemplate) => {
            // Find all templates for this event type and service
            const serviceId = template.service_id;
            const eventType = template.event_type;
            const service = services.find((s) => s.id === serviceId);
            const allTemplatesForEvent =
              service?.templates.filter((t) => t.event_type === eventType) ||
              [];
            if (allTemplatesForEvent.length > 0) {
              setEditingTemplateData({
                templates: allTemplatesForEvent,
                eventType,
              });
            }
          }}
        />

        {/* Logs Section */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
            {t("settings.externalNotifications.logs.title")}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t("settings.externalNotifications.logs.description")}
          </p>
          <ServicesLogsList />
        </div>
      </div>

      {editingTemplateData && (
        <TemplateEditorModal
          isOpen={!!editingTemplateData}
          templates={editingTemplateData.templates}
          eventType={editingTemplateData.eventType}
          onClose={() => setEditingTemplateData(null)}
        />
      )}
    </div>
  );
}
