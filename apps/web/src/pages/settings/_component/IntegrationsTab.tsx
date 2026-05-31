import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plug2 } from "lucide-react";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { SettingsPageHeader } from "@/pages/settings/_component/SettingsPageHeader";
import {
  AdguardIntegrationSection,
  JellyfinIntegrationSection,
  BeszelIntegrationSection,
  ProwlarrIntegrationSection,
  JackettIntegrationSection,
  QbittorrentIntegrationSection,
  ScrutinyIntegrationSection,
  TmdbIntegrationSection,
  TrackersIntegrationSection,
  WeatherIntegrationSection,
  HomeAssistantIntegrationSection,
  UptimekumaIntegrationSection,
  MinecraftIntegrationSection,
  LocalAiIntegrationSection,
} from "@/pages/settings/_component/integrations";

type SubTab = "integrations" | "trackers";

export function IntegrationsTab() {
  const { t } = useTranslation("common");
  const [subTab, setSubTab] = useState<SubTab>("integrations");

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6"
      key="integrations-tab"
    >
      <SettingsPageHeader
        icon={Plug2}
        title={t("settings.integrations.title")}
        description={t("settings.integrations.description")}
      />

      <SegmentedTabs
        items={[
          {
            id: "integrations",
            label: t("settings.integrations.tabs.integrations"),
          },
          { id: "trackers", label: t("settings.integrations.tabs.trackers") },
        ]}
        value={subTab}
        onChange={setSubTab}
      />

      {subTab === "integrations" ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-1">
              {t("settings.integrations.groups.media")}
            </h3>
            <div className="space-y-3">
              <JellyfinIntegrationSection />
              <TmdbIntegrationSection />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-1">
              {t("settings.integrations.indexers")}
            </h3>
            <div className="space-y-3">
              <ProwlarrIntegrationSection />
              <JackettIntegrationSection />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-1">
              {t("settings.integrations.groups.infrastructure")}
            </h3>
            <div className="space-y-3">
              <QbittorrentIntegrationSection />
              <ScrutinyIntegrationSection />
              <BeszelIntegrationSection />
              <AdguardIntegrationSection />
              <UptimekumaIntegrationSection />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-1">
              {t("settings.integrations.groups.other")}
            </h3>
            <div className="space-y-3">
              <WeatherIntegrationSection />
              <HomeAssistantIntegrationSection />
              <MinecraftIntegrationSection />
              <LocalAiIntegrationSection />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          <TrackersIntegrationSection />
        </div>
      )}
    </div>
  );
}
