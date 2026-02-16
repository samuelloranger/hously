import { useTranslation } from 'react-i18next';
import type { NotificationTemplate } from '@hously/shared';

interface ServiceTemplateItemProps {
  template: NotificationTemplate;
  eventType: string;
  onEdit: () => void;
}

export function ServiceTemplateItem({ template, eventType, onEdit }: ServiceTemplateItemProps) {
  const { t } = useTranslation('common');

  return (
    <div className="border border-neutral-200 dark:border-neutral-600 rounded-lg p-4 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            {t(`settings.externalNotifications.events.${eventType}`) || eventType}
          </h4>
          <div className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <div>
              <strong>{t('settings.externalNotifications.titleLabel')}:</strong> {template.title_template}
            </div>
            <div>
              <strong>{t('settings.externalNotifications.bodyLabel')}:</strong> {template.body_template}
            </div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          {t('settings.externalNotifications.edit')}
        </button>
      </div>
    </div>
  );
}
