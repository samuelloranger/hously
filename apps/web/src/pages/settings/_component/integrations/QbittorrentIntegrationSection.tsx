import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useQbittorrentIntegration,
  useUpdateQbittorrentIntegration,
} from "@/pages/settings/useIntegrations";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import { IntegrationUrlInput } from "@/pages/settings/_component/integrations/IntegrationUrlInput";

export function QbittorrentIntegrationSection() {
  const { data, isLoading } = useQbittorrentIntegration();
  return (
    <QbittorrentIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function QbittorrentIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useQbittorrentIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateQbittorrentIntegration();

  const [websiteUrl, setWebsiteUrl] = useState(
    data?.integration?.website_url || "",
  );
  const [username, setUsername] = useState(data?.integration?.username || "");
  const [password, setPassword] = useState("");
  const [pollInterval, setPollInterval] = useState(
    String(data?.integration?.poll_interval_seconds || 1),
  );
  const [maxItems, setMaxItems] = useState(
    String(data?.integration?.max_items || 8),
  );
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      username !== (data.integration.username || "") ||
      password !== "" ||
      pollInterval !== String(data.integration.poll_interval_seconds || 1) ||
      maxItems !== String(data.integration.max_items || 8) ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, websiteUrl, username, password, pollInterval, maxItems, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setUsername(data?.integration.username || "");
    setPassword("");
    setPollInterval(String(data?.integration.poll_interval_seconds || 1));
    setMaxItems(String(data?.integration.max_items || 8));
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        username,
        password: password.trim() ? password : undefined,
        poll_interval_seconds: Number(pollInterval || 1),
        max_items: Number(maxItems || 8),
        enabled,
      })
      .then(() => {
        setPassword("");
        toast.success(t("settings.integrations.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  return (
    <IntegrationSectionCard
      title="qBittorrent"
      description={t("settings.integrations.qbittorrent.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/qbittorrent.png"
    >
      <IntegrationUrlInput
        label={t("settings.integrations.qbittorrent.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://qbittorrent:8080"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.qbittorrent.username")}
        </label>
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="admin"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.integrations.qbittorrent.password")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t(
            "settings.integrations.qbittorrent.passwordPlaceholder",
          )}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.integrations.qbittorrent.pollInterval")}
          </label>
          <input
            type="number"
            min={1}
            max={30}
            step={1}
            value={pollInterval}
            onChange={(event) => setPollInterval(event.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.integrations.qbittorrent.maxItems")}
          </label>
          <input
            type="number"
            min={3}
            max={30}
            step={1}
            value={maxItems}
            onChange={(event) => setMaxItems(event.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          />
        </div>
      </div>

      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
        {t("settings.integrations.qbittorrent.setupNote")}{" "}
        <a
          href="https://github.com/samuelloranger/hously/blob/main/docs/QBITTORRENT_SETUP.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          {t("settings.integrations.qbittorrent.setupLink")} →
        </a>
      </div>
    </IntegrationSectionCard>
  );
}
