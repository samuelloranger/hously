import { useTranslation } from "react-i18next";
import { FolderTree } from "lucide-react";
import { HouseLoader } from "@/components/HouseLoader";
import { useMediaPostProcessingSettings } from "@/hooks/medias/useLibrary";
import { useQualityProfilesList } from "@/hooks/medias/useQualityProfiles";
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
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FolderTree className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {t("settings.mediaLibrary.title")}
          </h2>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
          {t("settings.mediaLibrary.description")}
        </p>
      </div>

      <MediaPostProcessingSettingsBody
        key={settings.updated_at}
        settings={settings}
        profilesData={profilesData}
      />
    </div>
  );
}
