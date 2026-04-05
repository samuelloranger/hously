import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  useDisableExternalNotificationService,
  useEnableExternalNotificationService,
  useRegenerateExternalNotificationToken,
  useUpdateExternalNotificationAdminsOnly,
  useToggleExternalNotificationTemplate,
} from "@/hooks/useExternalNotifications";
import { queryKeys } from "@/lib/queryKeys";
import { type ExternalNotificationService, type NotificationTemplate } from "@hously/shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { ServiceCard } from "@/pages/settings/_component/ServiceCard";

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
  const disableService = useDisableExternalNotificationService();
  const enableService = useEnableExternalNotificationService();
  const regenerateToken = useRegenerateExternalNotificationToken();
  const updateNotifyAdminsOnly = useUpdateExternalNotificationAdminsOnly();
  const toggleTemplate = useToggleExternalNotificationTemplate();

  const handleToggleTemplate = async (
    service: ExternalNotificationService,
    eventType: string,
    enabled: boolean,
  ) => {
    try {
      await toggleTemplate.mutateAsync({
        serviceId: service.id,
        eventType,
        enabled,
      });
    } catch (error: any) {
      toast.error(error?.message || t("settings.externalNotifications.error"));
    }
  };

  const handleToggleService = async (service: ExternalNotificationService) => {
    setLoadingServiceId(service.id);
    try {
      if (service.enabled) {
        await disableService.mutateAsync(service.id);
        toast.success(t("settings.externalNotifications.serviceDisabled"));
      } else {
        await enableService.mutateAsync(service.id);
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
    service: ExternalNotificationService,
  ) => {
    if (!confirm(t("settings.externalNotifications.regenerateTokenConfirm"))) {
      return;
    }

    setLoadingServiceId(service.id);
    try {
      await regenerateToken.mutateAsync(service.id);
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
    service: ExternalNotificationService,
  ) => {
    setLoadingServiceId(service.id);
    try {
      await updateNotifyAdminsOnly.mutateAsync({
        serviceId: service.id,
        notifyAdminsOnly: !service.notify_admins_only,
      });
      toast.success(
        t("settings.externalNotifications.notifyAdminsOnlyUpdated"),
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
    language: string,
  ): NotificationTemplate[] => {
    const templates = templatesByService[serviceId] || [];
    return templates.filter((t) => t.language === language);
  };

  const groupTemplatesByEventType = (
    templates: NotificationTemplate[],
  ): Record<string, NotificationTemplate[]> => {
    return templates.reduce(
      (acc, template) => {
        if (!acc[template.event_type]) {
          acc[template.event_type] = [];
        }
        acc[template.event_type].push(template);
        return acc;
      },
      {} as Record<string, NotificationTemplate[]>,
    );
  };

  // Group all templates by event type (for modal editing)
  const getAllTemplatesByEventType = (
    serviceId: number,
  ): Record<string, NotificationTemplate[]> => {
    const templates = templatesByService[serviceId] || [];
    return groupTemplatesByEventType(templates);
  };

  const sortedServices = [...services].sort((a, b) => {
    if (a.service_name === "generic") return -1;
    if (b.service_name === "generic") return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {sortedServices.map((service) => {
        const isLoading = loadingServiceId === service.id;
        const serviceTemplates = getTemplatesForService(
          service.id,
          currentLanguage,
        );
        const templatesByEvent = groupTemplatesByEventType(serviceTemplates);
        const allTemplatesByEvent = getAllTemplatesByEventType(service.id);

        return (
          <ServiceCard
            key={service.id}
            service={service}
            templatesByEvent={templatesByEvent}
            isLoading={isLoading}
            togglingEventType={
              toggleTemplate.isPending
                ? (toggleTemplate.variables?.eventType ?? null)
                : null
            }
            onToggleService={() => handleToggleService(service)}
            onRegenerateToken={() => handleRegenerateToken(service)}
            onToggleNotifyAdminsOnly={() =>
              handleToggleNotifyAdminsOnly(service)
            }
            onToggleTemplate={(eventType, enabled) =>
              handleToggleTemplate(service, eventType, enabled)
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
