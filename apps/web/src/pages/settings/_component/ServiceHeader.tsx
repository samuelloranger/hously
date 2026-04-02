import { useTranslation } from 'react-i18next';
import type { ExternalNotificationService } from '@hously/shared';
import { ChevronDown } from 'lucide-react';

const SERVICE_ICON_SLUGS: Record<string, string> = {
  radarr: 'radarr',
  sonarr: 'sonarr',
  jellyfin: 'jellyfin',
  plex: 'plex',
  kopia: 'kopia',
  uptimekuma: 'uptime-kuma',
  beszel: 'beszel',
  prowlarr: 'prowlarr',
  'cross-seed': 'qbittorrent',
};

function getServiceIconUrl(serviceName: string): string | null {
  const slug = SERVICE_ICON_SLUGS[serviceName.toLowerCase()];
  if (!slug) return null;
  return `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${slug}.png`;
}

interface ServiceHeaderProps {
  service: ExternalNotificationService;
  isOpen: boolean;
  onToggle: () => void;
}

export function ServiceHeader({ service, isOpen, onToggle }: ServiceHeaderProps) {
  const { t } = useTranslation('common');
  const iconUrl = getServiceIconUrl(service.service_name);

  const serviceDisplayName =
    t(`settings.externalNotifications.serviceNames.${service.service_name}`, {
      defaultValue: service.service_name,
    }) || service.service_name;

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {iconUrl && (
            <img
              src={iconUrl}
              alt={serviceDisplayName}
              className="w-8 h-8 rounded-lg object-contain flex-shrink-0"
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 capitalize">
              {serviceDisplayName}
            </h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                service.enabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
              }`}
            >
              {service.enabled
                ? t('settings.externalNotifications.enabled')
                : t('settings.externalNotifications.disabled')}
            </span>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700"
          aria-label={isOpen ? t('common.collapse') : t('common.expand')}
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
