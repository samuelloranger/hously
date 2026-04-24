import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useJackettIntegration,
  useUpdateJackettIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";

export function JackettIntegrationSection() {
  const { data, isLoading } = useJackettIntegration();
  return (
    <JackettIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function JackettIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useJackettIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateJackettIntegration();

  const [websiteUrl, setWebsiteUrl] = useState(
    data?.integration?.website_url || "",
  );
  const [apiKey, setApiKey] = useState(data?.integration?.api_key || "");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      apiKey !== (data.integration.api_key || "") ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [apiKey, data, enabled, websiteUrl]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setApiKey(data?.integration.api_key || "");
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        enabled,
      })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Jackett"
      description={t("settings.integrations.jackett.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jackett.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.jackett.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://jackett.example.com"
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("settings.integrations.jackett.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.integrations.jackett.apiKeyPlaceholder")}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 font-mono text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
        />
      </div>
    </IntegrationSectionCard>
  );
}
