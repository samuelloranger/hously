import { useTranslation } from "react-i18next";
import { HouseLoader } from "@/components/HouseLoader";
import { useMediaPostProcessingSettings } from "@/features/medias/hooks/useMediaPostProcessingSettings";
import { useQualityProfilesList } from "@/pages/settings/useQualityProfiles";
import { MediaPostProcessingSettingsBody } from "./MediaPostProcessingSettingsBody";

export function MediaPostProcessingTab() {
  const { t } = useTranslation("common");
  const { data, isLoading, error } = useMediaPostProcessingSettings();
  const { data: profilesData } = useQualityProfilesList();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-500">
        <HouseLoader size="md" />
        <span className="text-sm">{t("settings.mediaLibrary.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {t("settings.mediaLibrary.loadError")}
      </p>
    );
  }

  const settings = data?.settings;
  if (!settings) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {t("settings.mediaLibrary.loadError")}
      </p>
    );
  }

  return (
    <MediaPostProcessingSettingsBody
      key={settings.updated_at}
      settings={settings}
      profilesData={profilesData}
    />
  );
}
