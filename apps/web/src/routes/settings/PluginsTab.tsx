import { useTranslation } from 'react-i18next';
import {
  JellyfinPluginSection,
  NetdataPluginSection,
  QbittorrentPluginSection,
  RadarrPluginSection,
  ScrutinyPluginSection,
  SonarrPluginSection,
} from './components/plugins';

export function PluginsTab() {
  const { t } = useTranslation('common');

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="plugins-tab">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">
          {t('settings.plugins.title')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.plugins.description')}</p>
        <JellyfinPluginSection />
        <RadarrPluginSection />
        <SonarrPluginSection />
        <QbittorrentPluginSection />
        <ScrutinyPluginSection />
        <NetdataPluginSection />
      </div>
    </div>
  );
}
