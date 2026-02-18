import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@hously/shared';
import {
  JellyfinPluginSection,
  NetdataPluginSection,
  QbittorrentPluginSection,
  RadarrPluginSection,
  ScrutinyPluginSection,
  SonarrPluginSection,
  WeatherPluginSection,
  YggPluginSection,
} from './components/plugins';

export function PluginsTab() {
  const { t } = useTranslation('common');
  const { data: currentUser } = useCurrentUser();

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="plugins-tab">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6 space-y-6">
        <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
          {t('settings.plugins.title')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {currentUser?.is_admin
            ? t('settings.plugins.description')
            : 'Weather is available to all users. Other plugins require admin privileges.'}
        </p>
        <WeatherPluginSection />
        {currentUser?.is_admin ? (
          <>
            <JellyfinPluginSection />
            <RadarrPluginSection />
            <SonarrPluginSection />
            <QbittorrentPluginSection />
            <YggPluginSection />
            <ScrutinyPluginSection />
            <NetdataPluginSection />
          </>
        ) : null}
      </div>
    </div>
  );
}
