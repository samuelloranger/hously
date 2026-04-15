import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  AdguardPluginSection,
  JellyfinPluginSection,
  BeszelPluginSection,
  ProwlarrPluginSection,
  JackettPluginSection,
  QbittorrentPluginSection,
  ScrutinyPluginSection,
  TmdbPluginSection,
  TrackersPluginSection,
  WeatherPluginSection,
  HomeAssistantPluginSection,
} from "@/pages/settings/_component/plugins";

type SubTab = "plugins" | "trackers";

export function PluginsTab() {
  const { t } = useTranslation("common");
  const [subTab, setSubTab] = useState<SubTab>("plugins");

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4"
      key="plugins-tab"
    >
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {t("settings.plugins.title")}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          {t("settings.plugins.description")}
        </p>
      </div>

      <SegmentedTabs
        items={[
          { id: "plugins", label: t("settings.plugins.tabs.plugins") },
          { id: "trackers", label: t("settings.plugins.tabs.trackers") },
        ]}
        value={subTab}
        onChange={setSubTab}
      />

      {subTab === "plugins" ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1">
              {t("settings.plugins.groups.media")}
            </h3>
            <div className="space-y-3">
              <JellyfinPluginSection />
              <TmdbPluginSection />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1">
              {t("settings.plugins.indexers")}
            </h3>
            <div className="space-y-3">
              <ProwlarrPluginSection />
              <JackettPluginSection />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1">
              {t("settings.plugins.groups.infrastructure")}
            </h3>
            <div className="space-y-3">
              <QbittorrentPluginSection />
              <ScrutinyPluginSection />
              <BeszelPluginSection />
              <AdguardPluginSection />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1">
              {t("settings.plugins.groups.other")}
            </h3>
            <div className="space-y-3">
              <WeatherPluginSection />
              <HomeAssistantPluginSection />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          <TrackersPluginSection />
        </div>
      )}
    </div>
  );
}
