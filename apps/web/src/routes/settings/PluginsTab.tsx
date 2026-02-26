import { useTranslation } from 'react-i18next';
import {
  HackernewsPluginSection,
  RedditPluginSection,
  JellyfinPluginSection,
  NetdataPluginSection,
  QbittorrentPluginSection,
  RadarrPluginSection,
  ScrutinyPluginSection,
  SonarrPluginSection,
  TmdbPluginSection,
  TrackersPluginSection,
  WeatherPluginSection,
} from './components/plugins';

export function PluginsTab() {
  const { t } = useTranslation('common');

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4" key="plugins-tab">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('settings.plugins.title')}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.plugins.description')}</p>
      </div>
      <WeatherPluginSection />
      <HackernewsPluginSection />
      <RedditPluginSection />
      <TmdbPluginSection />
      <JellyfinPluginSection />
      <RadarrPluginSection />
      <SonarrPluginSection />
      <QbittorrentPluginSection />
      <TrackersPluginSection />
      <ScrutinyPluginSection />
      <NetdataPluginSection />
    </div>
  );
}
