import type { ExternalNotificationService, NotificationTemplate } from '@hously/shared';
import { ServiceToggle } from './ServiceToggle';
import { ServiceCredentials } from './ServiceCredentials';
import { ServiceTemplatesList } from './ServiceTemplatesList';
import { ServiceNotifyAdminsOnly } from './ServiceNotifyAdminsOnly';

interface ServiceDrawerProps {
  service: ExternalNotificationService;
  templatesByEvent: Record<string, NotificationTemplate[]>;
  isLoading: boolean;
  togglingEventType: string | null;
  onToggleService: () => void;
  onRegenerateToken: () => void;
  onEditTemplate: (eventType: string) => void;
  onToggleNotifyAdminsOnly: () => void;
  onToggleTemplate: (eventType: string, enabled: boolean) => void;
}

export function ServiceDrawer({
  service,
  templatesByEvent,
  isLoading,
  togglingEventType,
  onToggleService,
  onRegenerateToken,
  onEditTemplate,
  onToggleNotifyAdminsOnly,
  onToggleTemplate,
}: ServiceDrawerProps) {
  return (
    <div className="border-t border-neutral-200 dark:border-neutral-600 px-6 py-4 space-y-4">
      {/* Switch at top of drawer */}
      <ServiceToggle service={service} isLoading={isLoading} onToggle={onToggleService} />

      {/* Token and Webhook URL - only if service is enabled */}
      <ServiceCredentials service={service} isLoading={isLoading} onRegenerateToken={onRegenerateToken} />

      {/* Notify Admins Only - only if service is enabled */}
      <ServiceNotifyAdminsOnly service={service} isLoading={isLoading} onToggle={onToggleNotifyAdminsOnly} />

      {/* Templates - only if service is enabled */}
      {service.enabled && (
        <ServiceTemplatesList
          templatesByEvent={templatesByEvent}
          togglingEventType={togglingEventType}
          onEditTemplate={onEditTemplate}
          onToggleTemplate={onToggleTemplate}
        />
      )}
    </div>
  );
}
