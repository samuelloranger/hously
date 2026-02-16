import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';
import type { ExternalNotificationService, NotificationTemplate } from '@hously/shared';
import { ServiceHeader } from './ServiceHeader';
import { ServiceDrawer } from './ServiceDrawer';

interface ServiceCardProps {
  service: ExternalNotificationService;
  templatesByEvent: Record<string, NotificationTemplate[]>;
  isLoading: boolean;
  onToggleService: () => void;
  onRegenerateToken: () => void;
  onToggleNotifyAdminsOnly: () => void;
  onEditTemplate: (eventType: string) => void;
}

export function ServiceCard({
  service,
  templatesByEvent,
  isLoading,
  onToggleService,
  onRegenerateToken,
  onToggleNotifyAdminsOnly,
  onEditTemplate,
}: ServiceCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600 overflow-hidden"
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
          onToggleService={onToggleService}
          onRegenerateToken={onRegenerateToken}
          onToggleNotifyAdminsOnly={onToggleNotifyAdminsOnly}
          onEditTemplate={onEditTemplate}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}
