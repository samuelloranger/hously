import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTmdbPlugin, useUpdateTmdbPlugin } from "@/pages/settings/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";

export function TmdbPluginSection() {
  const { data, isLoading } = useTmdbPlugin();
  return (
    <TmdbPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function TmdbPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useTmdbPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateTmdbPlugin();

  const [apiKey, setApiKey] = useState(data?.plugin?.api_key || "");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));
  const [popularityThreshold, setPopularityThreshold] = useState(
    data?.plugin?.popularity_threshold ?? 15,
  );

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      apiKey !== (data.plugin.api_key || "") ||
      enabled !== Boolean(data.plugin.enabled) ||
      popularityThreshold !== (data.plugin.popularity_threshold ?? 15)
    );
  }, [data, apiKey, enabled, popularityThreshold]);

  const handleCancel = () => {
    setApiKey(data?.plugin.api_key || "");
    setEnabled(Boolean(data?.plugin.enabled));
    setPopularityThreshold(data?.plugin.popularity_threshold ?? 15);
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        api_key: apiKey,
        enabled,
        popularity_threshold: popularityThreshold,
      })
      .then(() => toast.success(t("settings.plugins.saveSuccess")))
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="TMDB"
      description={t("settings.plugins.tmdb.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.tmdb.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.plugins.tmdb.apiKeyPlaceholder")}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t("settings.plugins.tmdb.popularityThreshold")}
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={popularityThreshold}
          onChange={(event) =>
            setPopularityThreshold(
              Math.max(0, Math.min(100, Number(event.target.value) || 0)),
            )
          }
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t("settings.plugins.tmdb.popularityThresholdHelp")}
        </p>
      </div>
    </PluginSectionCard>
  );
}
