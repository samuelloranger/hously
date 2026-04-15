import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useJackettPlugin,
  useUpdateJackettPlugin,
} from "@/pages/settings/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function JackettPluginSection() {
  const { data, isLoading } = useJackettPlugin();
  return (
    <JackettPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function JackettPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useJackettPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateJackettPlugin();

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
  }, [apiKey, data, enabled, websiteUrl]);

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
      title="Jackett"
      description={t("settings.plugins.jackett.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jackett.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.jackett.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://jackett.example.com"
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("settings.plugins.jackett.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.plugins.jackett.apiKeyPlaceholder")}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 font-mono text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
        />
      </div>
    </PluginSectionCard>
  );
}
