import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ExternalNotificationService,
  NotificationTemplate,
} from "../../../features/external-notifications/api";
import { externalNotificationsApi } from "../../../features/external-notifications/api";
import { queryKeys } from "../../../lib/queryKeys";
import { ServiceCard } from "./ServiceCard";

interface ServiceListProps {
  services: ExternalNotificationService[];
  templatesByService: Record<number, NotificationTemplate[]>;
  isLoading?: boolean;
  onEditTemplate: (template: NotificationTemplate) => void;
}

export function ServiceList({
  services,
  templatesByService,
  isLoading,
  onEditTemplate,
}: ServiceListProps) {
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();
  const [loadingServiceId, setLoadingServiceId] = useState<number | null>(null);
  const currentLanguage = i18n.language.split("-")[0] || "en";

  const handleToggleService = async (service: ExternalNotificationService) => {
    setLoadingServiceId(service.id);
    try {
      if (service.enabled) {
        await externalNotificationsApi.disableService(service.id);
        toast.success(t("settings.externalNotifications.serviceDisabled"));
      } else {
        await externalNotificationsApi.enableService(service.id);
        toast.success(t("settings.externalNotifications.serviceEnabled"));
      }
      // Refetch services
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalNotifications.services(),
      });
    } catch (error: any) {
      toast.error(error?.message || t("settings.externalNotifications.error"));
    } finally {
      setLoadingServiceId(null);
    }
  };

  const handleRegenerateToken = async (
    service: ExternalNotificationService
  ) => {
    if (!confirm(t("settings.externalNotifications.regenerateTokenConfirm"))) {
      return;
    }

    setLoadingServiceId(service.id);
    try {
      await externalNotificationsApi.regenerateToken(service.id);
      toast.success(t("settings.externalNotifications.tokenRegenerated"));
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalNotifications.services(),
      });
    } catch (error: any) {
      toast.error(error?.message || t("settings.externalNotifications.error"));
    } finally {
      setLoadingServiceId(null);
    }
  };

  const handleToggleNotifyAdminsOnly = async (
    service: ExternalNotificationService
  ) => {
    setLoadingServiceId(service.id);
    try {
      await externalNotificationsApi.updateNotifyAdminsOnly(
        service.id,
        !service.notify_admins_only
      );
      toast.success(
        t("settings.externalNotifications.notifyAdminsOnlyUpdated")
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalNotifications.services(),
      });
    } catch (error: any) {
      toast.error(error?.message || t("settings.externalNotifications.error"));
    } finally {
      setLoadingServiceId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t("common.loading")}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
        {t("settings.externalNotifications.noServices")}
      </div>
    );
  }

  const getTemplatesForService = (
    serviceId: number,
    language: string
  ): NotificationTemplate[] => {
    const templates = templatesByService[serviceId] || [];
    return templates.filter((t) => t.language === language);
  };

  const groupTemplatesByEventType = (
    templates: NotificationTemplate[]
  ): Record<string, NotificationTemplate[]> => {
    return templates.reduce((acc, template) => {
      if (!acc[template.event_type]) {
        acc[template.event_type] = [];
      }
      acc[template.event_type].push(template);
      return acc;
    }, {} as Record<string, NotificationTemplate[]>);
  };

  // Group all templates by event type (for modal editing)
  const getAllTemplatesByEventType = (
    serviceId: number
  ): Record<string, NotificationTemplate[]> => {
    const templates = templatesByService[serviceId] || [];
    return groupTemplatesByEventType(templates);
  };

  return (
    <div className="space-y-4">
      {services.map((service) => {
        const isLoading = loadingServiceId === service.id;
        const serviceTemplates = getTemplatesForService(
          service.id,
          currentLanguage
        );
        const templatesByEvent = groupTemplatesByEventType(serviceTemplates);
        const allTemplatesByEvent = getAllTemplatesByEventType(service.id);

        return (
          <ServiceCard
            key={service.id}
            service={service}
            templatesByEvent={templatesByEvent}
            isLoading={isLoading}
            onToggleService={() => handleToggleService(service)}
            onRegenerateToken={() => handleRegenerateToken(service)}
            onToggleNotifyAdminsOnly={() =>
              handleToggleNotifyAdminsOnly(service)
            }
            onEditTemplate={(eventType) => {
              const templates = allTemplatesByEvent[eventType] || [];
              // Find template for current language or fallback to first available
              const template =
                templates.find((t) => t.language === currentLanguage) ||
                templates[0];
              if (template) {
                onEditTemplate(template);
              }
            }}
          />
        );
      })}
    </div>
  );
}
