import { useTranslation } from 'react-i18next';
import type { ExternalNotificationService } from '@hously/shared';

interface ServiceToggleProps {
  service: ExternalNotificationService;
  isLoading: boolean;
  onToggle: () => void;
}

export function ServiceToggle({ service, isLoading, onToggle }: ServiceToggleProps) {
  const { t } = useTranslation('common');

  return (
    <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-600">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('settings.externalNotifications.enableService')}
      </label>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={service.enabled}
          onChange={onToggle}
          disabled={isLoading}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}
