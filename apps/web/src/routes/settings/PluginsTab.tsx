import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import {
  JellyfinPluginSection,
  NetdataPluginSection,
  ProwlarrPluginSection,
  QbittorrentPluginSection,
  RadarrPluginSection,
  ScrutinyPluginSection,
  SonarrPluginSection,
  TmdbPluginSection,
  TrackersPluginSection,
  WeatherPluginSection,
} from './components/plugins';

type SubTab = 'plugins' | 'trackers';

export function PluginsTab() {
  const { t } = useTranslation('common');
  const [subTab, setSubTab] = useState<SubTab>('plugins');

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4" key="plugins-tab">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('settings.plugins.title')}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.plugins.description')}</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('plugins')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
            subTab === 'plugins'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          )}
        >
          {t('settings.plugins.tabs.plugins')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('trackers')}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150',
            subTab === 'trackers'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          )}
        >
          {t('settings.plugins.tabs.trackers')}
        </button>
      </div>

      {subTab === 'plugins' ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <WeatherPluginSection />
          <TmdbPluginSection />
          <JellyfinPluginSection />
          <ProwlarrPluginSection />
          <RadarrPluginSection />
          <SonarrPluginSection />
          <QbittorrentPluginSection />
          <ScrutinyPluginSection />
          <NetdataPluginSection />
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          <TrackersPluginSection />
        </div>
      )}
    </div>
  );
}
