import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useJellyfinPlugin,
  useUpdateJellyfinPlugin,
} from "@/pages/settings/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function JellyfinPluginSection() {
  const { data, isLoading } = useJellyfinPlugin();
  return (
    <JellyfinPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function JellyfinPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useJellyfinPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateJellyfinPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [apiKey, setApiKey] = useState(data?.plugin?.api_key || "");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      apiKey !== (data.plugin.api_key || "") ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, apiKey, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || "");
    setApiKey(data?.plugin.api_key || "");
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        enabled,
      })
      .then(() => toast.success(t("settings.plugins.saveSuccess")))
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="Jellyfin"
      description={t("settings.plugins.jellyfin.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyfin.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.jellyfin.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://jellyfin.example.com"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.jellyfin.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.plugins.jellyfin.apiKeyPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
