import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useProwlarrIntegration,
  useProwlarrIndexers,
  useUpdateProwlarrIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";
import { RssIndexerSelector } from "@/pages/settings/_component/integrations/RssIndexerSelector";

export function ProwlarrIntegrationSection() {
  const { data, isLoading } = useProwlarrIntegration();
  return (
    <ProwlarrIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function ProwlarrIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useProwlarrIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateProwlarrIntegration();

  const [websiteUrl, setWebsiteUrl] = useState(
    data?.integration?.website_url || "",
  );
  const [apiKey, setApiKey] = useState(data?.integration?.api_key || "");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));
  const [rssIndexers, setRssIndexers] = useState<string[]>(
    data?.integration?.rss_indexers ?? [],
  );

  const canFetchIndexers = Boolean(
    enabled && (data?.integration?.website_url || websiteUrl),
  );
  const { data: indexersData, isLoading: indexersLoading } =
    useProwlarrIndexers(canFetchIndexers);

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    const savedRss = data.integration.rss_indexers ?? [];
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      apiKey !== (data.integration.api_key || "") ||
      enabled !== Boolean(data.integration.enabled) ||
      rssIndexers.length !== savedRss.length ||
      rssIndexers.some((s) => !savedRss.includes(s))
    );
  }, [apiKey, data, enabled, rssIndexers, websiteUrl]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setApiKey(data?.integration.api_key || "");
    setEnabled(Boolean(data?.integration.enabled));
    setRssIndexers(data?.integration.rss_indexers ?? []);
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        enabled,
        rss_indexers: rssIndexers,
      })
      .then(() => toast.success(t("settings.integrations.saveSuccess")))
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="Prowlarr"
      description={t("settings.integrations.prowlarr.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/prowlarr.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.prowlarr.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://prowlarr.example.com"
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("settings.integrations.prowlarr.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.integrations.prowlarr.apiKeyPlaceholder")}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 font-mono text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
        />
      </div>

      <RssIndexerSelector
        indexers={indexersData?.indexers}
        loading={canFetchIndexers && indexersLoading}
        selected={rssIndexers}
        onChange={setRssIndexers}
      />
    </IntegrationSectionCard>
  );
}
