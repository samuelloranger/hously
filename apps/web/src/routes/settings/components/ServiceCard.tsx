import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ExternalNotificationService, NotificationTemplate } from '@hously/shared';
import { ServiceHeader } from './ServiceHeader';
import { ServiceDrawer } from './ServiceDrawer';

interface ServiceCardProps {
  service: ExternalNotificationService;
  templatesByEvent: Record<string, NotificationTemplate[]>;
  isLoading: boolean;
  togglingEventType: string | null;
  onToggleService: () => void;
  onRegenerateToken: () => void;
  onToggleNotifyAdminsOnly: () => void;
  onEditTemplate: (eventType: string) => void;
  onToggleTemplate: (eventType: string, enabled: boolean) => void;
}

export function ServiceCard({
  service,
  templatesByEvent,
  isLoading,
  togglingEventType,
  onToggleService,
  onRegenerateToken,
  onToggleNotifyAdminsOnly,
  onEditTemplate,
  onToggleTemplate,
}: ServiceCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="bg-white dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
    >
      <CollapsibleTrigger asChild>
        <button className="w-full text-left">
          <ServiceHeader service={service} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ServiceDrawer
          service={service}
          templatesByEvent={templatesByEvent}
          isLoading={isLoading}
          togglingEventType={togglingEventType}
          onToggleService={onToggleService}
          onRegenerateToken={onRegenerateToken}
          onToggleNotifyAdminsOnly={onToggleNotifyAdminsOnly}
          onEditTemplate={onEditTemplate}
          onToggleTemplate={onToggleTemplate}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
