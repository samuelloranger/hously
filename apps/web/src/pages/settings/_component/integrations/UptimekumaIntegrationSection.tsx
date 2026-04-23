import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUptimekumaIntegration,
  useUpdateUptimekumaIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";

export function UptimekumaIntegrationSection() {
  const { data, isLoading } = useUptimekumaIntegration();
  return (
    <UptimekumaIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function UptimekumaIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useUptimekumaIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateUptimekumaIntegration();

  const [websiteUrl, setWebsiteUrl] = useState(data?.integration?.website_url || "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      apiKey !== "" ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, websiteUrl, apiKey, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration?.website_url || "");
    setApiKey("");
    setEnabled(Boolean(data?.integration?.enabled));
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
        toast.success(t("settings.integrations.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  const keyPlaceholder = data?.integration?.api_key_set
    ? t("settings.integrations.uptimekuma.apiKeyPlaceholderSet")
    : t("settings.integrations.uptimekuma.apiKeyPlaceholder");

  return (
    <IntegrationSectionCard
      title="UptimeKuma"
      description={t("settings.integrations.uptimekuma.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/uptime-kuma.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.uptimekuma.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://uptime.example.com"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.uptimekuma.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyPlaceholder}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </IntegrationSectionCard>
  );
}
