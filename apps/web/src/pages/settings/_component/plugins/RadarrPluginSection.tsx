import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useRadarrPlugin,
  useRadarrProfiles,
  useUpdateRadarrPlugin,
} from "@/hooks/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function RadarrPluginSection() {
  const { data, isLoading } = useRadarrPlugin();
  return (
    <RadarrPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function RadarrPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useRadarrPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateRadarrPlugin();
  const fetchProfilesMutation = useRadarrProfiles();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [apiKey, setApiKey] = useState(data?.plugin?.api_key || "");
  const [rootFolderPath, setRootFolderPath] = useState(
    data?.plugin?.root_folder_path || "",
  );
  const [qualityProfileId, setQualityProfileId] = useState(
    String(data?.plugin?.quality_profile_id || 1),
  );
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));
  const [qualityProfiles, setQualityProfiles] = useState<
    Array<{ id: number; name: string }>
  >([]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      apiKey !== (data.plugin.api_key || "") ||
      rootFolderPath !== (data.plugin.root_folder_path || "") ||
      qualityProfileId !== String(data.plugin.quality_profile_id || 1) ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, apiKey, rootFolderPath, qualityProfileId, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || "");
    setApiKey(data?.plugin.api_key || "");
    setRootFolderPath(data?.plugin.root_folder_path || "");
    setQualityProfileId(String(data?.plugin.quality_profile_id || 1));
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        root_folder_path: rootFolderPath,
        quality_profile_id: Number(qualityProfileId || 0),
        enabled,
      })
      .then(() => toast.success(t("settings.plugins.saveSuccess")))
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  const handleApiKeyBlur = () => {
    const trimmedUrl = websiteUrl.trim();
    const trimmedApiKey = apiKey.trim();
    if (!trimmedUrl) return;

    fetchProfilesMutation
      .mutateAsync({ website_url: trimmedUrl, api_key: trimmedApiKey })
      .then((result) => {
        setQualityProfiles(result.quality_profiles || []);
        if (result.quality_profiles.length > 0) {
          const hasCurrent = result.quality_profiles.some(
            (profile) => String(profile.id) === qualityProfileId,
          );
          if (!hasCurrent) {
            setQualityProfileId(String(result.quality_profiles[0].id));
          }
        }
      })
      .catch(() => toast.error(t("settings.plugins.profileFetchError")));
  };

  return (
    <PluginSectionCard
      title="Radarr"
      description={t("settings.plugins.radarr.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/radarr.png"
      configuredValue={data?.plugin?.website_url || undefined}
    >
      <PluginUrlInput
        label={t("settings.plugins.radarr.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://radarr.example.com"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.radarr.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          onBlur={handleApiKeyBlur}
          placeholder={t("settings.plugins.radarr.apiKeyPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.radarr.rootFolderPath")}
        </label>
        <input
          type="text"
          value={rootFolderPath}
          onChange={(event) => setRootFolderPath(event.target.value)}
          placeholder="/movies"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.radarr.qualityProfileId")}
        </label>
        {qualityProfiles.length > 0 ? (
          <select
            value={qualityProfileId}
            onChange={(event) => setQualityProfileId(event.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          >
            {qualityProfiles.map((profile) => (
              <option key={profile.id} value={String(profile.id)}>
                {profile.name} (#{profile.id})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            min={1}
            step={1}
            value={qualityProfileId}
            onChange={(event) => setQualityProfileId(event.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          />
        )}
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {fetchProfilesMutation.isPending
            ? t("settings.plugins.profileFetchLoading")
            : t("settings.plugins.profileFetchHint")}
        </p>
      </div>
    </PluginSectionCard>
  );
}
