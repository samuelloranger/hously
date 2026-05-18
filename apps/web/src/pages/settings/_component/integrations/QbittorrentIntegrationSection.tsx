import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQbittorrentIntegration } from "@/pages/settings/useQbittorrentIntegration";
import { useUpdateQbittorrentIntegration } from "@/pages/settings/useUpdateQbittorrentIntegration";
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
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    return (
      websiteUrl !== (data.integration.website_url || "") ||
      username !== (data.integration.username || "") ||
      password !== "" ||
      enabled !== Boolean(data.integration.enabled)
    );
  }, [data, websiteUrl, username, password, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.integration.website_url || "");
    setUsername(data?.integration.username || "");
    setPassword("");
    setEnabled(Boolean(data?.integration.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        username,
        password: password.trim() ? password : undefined,
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
