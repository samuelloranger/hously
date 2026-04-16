import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUptimekumaPlugin,
  useUpdateUptimekumaPlugin,
} from "@/pages/settings/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function UptimekumaPluginSection() {
  const { data, isLoading } = useUptimekumaPlugin();
  return (
    <UptimekumaPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function UptimekumaPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useUptimekumaPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateUptimekumaPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      apiKey !== "" ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, apiKey, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin?.website_url || "");
    setApiKey("");
    setEnabled(Boolean(data?.plugin?.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey.trim() ? apiKey : undefined,
        enabled,
      })
      .then(() => {
        setApiKey("");
        toast.success(t("settings.plugins.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  const keyPlaceholder = data?.plugin?.api_key_set
    ? t("settings.plugins.uptimekuma.apiKeyPlaceholderSet")
    : t("settings.plugins.uptimekuma.apiKeyPlaceholder");

  return (
    <PluginSectionCard
      title="UptimeKuma"
      description={t("settings.plugins.uptimekuma.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/uptime-kuma.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.uptimekuma.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://uptime.example.com"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.uptimekuma.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyPlaceholder}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
