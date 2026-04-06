import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useQbittorrentPlugin,
  useUpdateQbittorrentPlugin,
} from "@/hooks/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function QbittorrentPluginSection() {
  const { data, isLoading } = useQbittorrentPlugin();
  return (
    <QbittorrentPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function QbittorrentPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useQbittorrentPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateQbittorrentPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [username, setUsername] = useState(data?.plugin?.username || "");
  const [password, setPassword] = useState("");
  const [pollInterval, setPollInterval] = useState(
    String(data?.plugin?.poll_interval_seconds || 1),
  );
  const [maxItems, setMaxItems] = useState(
    String(data?.plugin?.max_items || 8),
  );
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      username !== (data.plugin.username || "") ||
      password !== "" ||
      pollInterval !== String(data.plugin.poll_interval_seconds || 1) ||
      maxItems !== String(data.plugin.max_items || 8) ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, username, password, pollInterval, maxItems, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || "");
    setUsername(data?.plugin.username || "");
    setPassword("");
    setPollInterval(String(data?.plugin.poll_interval_seconds || 1));
    setMaxItems(String(data?.plugin.max_items || 8));
    setEnabled(Boolean(data?.plugin.enabled));
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
        toast.success(t("settings.plugins.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="qBittorrent"
      description={t("settings.plugins.qbittorrent.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/qbittorrent.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.qbittorrent.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://qbittorrent:8080"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.qbittorrent.username")}
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
          {t("settings.plugins.qbittorrent.password")}
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t("settings.plugins.qbittorrent.passwordPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.plugins.qbittorrent.pollInterval")}
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
            {t("settings.plugins.qbittorrent.maxItems")}
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
    </PluginSectionCard>
  );
}
