import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useHomeAssistantDiscoverEntities,
  useHomeAssistantIntegration,
  useUpdateHomeAssistantIntegration,
} from "@/pages/settings/useIntegrations";
import { type HomeAssistantDiscoverEntity } from "@hously/shared/types";
import { toast } from "sonner";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";

function sortIds(ids: string[]): string[] {
  return [...ids].sort();
}

export function HomeAssistantIntegrationSection() {
  const { data, isLoading } = useHomeAssistantIntegration();
  return (
    <HomeAssistantIntegrationSectionImpl
      key={data?.integration?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function HomeAssistantIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useHomeAssistantIntegration>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateHomeAssistantIntegration();
  const discoverMutation = useHomeAssistantDiscoverEntities();

  const [baseUrl, setBaseUrl] = useState(data?.integration?.base_url || "");
  const [accessToken, setAccessToken] = useState("");
  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(data?.integration?.enabled_entity_ids ?? []),
  );
  const [discovered, setDiscovered] = useState<
    HomeAssistantDiscoverEntity[] | null
  >(null);

  // Sync form state when server data updates (during-render update instead of an effect)
  const [prevData, setPrevData] = useState(data?.integration);
  if (data?.integration !== prevData) {
    setPrevData(data?.integration);
    setBaseUrl(data?.integration?.base_url || "");
    setEnabled(Boolean(data?.integration?.enabled));
    setSelectedIds(new Set(data?.integration?.enabled_entity_ids ?? []));
  }

  const toggleEntity = useCallback((entityId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(entityId);
      else next.delete(entityId);
      return next;
    });
  }, []);

  const isDirty = useMemo(() => {
    if (!data?.integration) return false;
    const origIds = sortIds(data.integration.enabled_entity_ids ?? []);
    const curIds = sortIds([...selectedIds]);
    return (
      baseUrl !== (data.integration.base_url || "") ||
      enabled !== Boolean(data.integration.enabled) ||
      accessToken.trim().length > 0 ||
      origIds.join("\n") !== curIds.join("\n")
    );
  }, [data, baseUrl, enabled, accessToken, selectedIds]);

  const handleCancel = () => {
    setBaseUrl(data?.integration.base_url || "");
    setAccessToken("");
    setEnabled(Boolean(data?.integration.enabled));
    setSelectedIds(new Set(data?.integration.enabled_entity_ids ?? []));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        base_url: baseUrl,
        access_token: accessToken,
        enabled_entity_ids: [...selectedIds],
        enabled,
      })
      .then(() => {
        setAccessToken("");
        toast.success(t("settings.integrations.saveSuccess"));
      })
      .catch(() => toast.error(t("settings.integrations.saveError")));
  };

  const handleLoadDevices = async () => {
    try {
      const res = await discoverMutation.mutateAsync();
      setDiscovered(res.entities);
      if (res.entities.length === 0) {
        toast.message(t("settings.integrations.homeAssistant.noDevicesFound"));
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : t("settings.integrations.saveError");
      toast.error(msg);
    }
  };

  const rows: HomeAssistantDiscoverEntity[] = useMemo(() => {
    if (discovered && discovered.length > 0) return discovered;
    const ids = [...selectedIds];
    if (ids.length === 0) return [];
    return ids.map((entity_id) => ({
      entity_id,
      friendly_name: entity_id,
      domain: entity_id.startsWith("light.")
        ? ("light" as const)
        : ("switch" as const),
    }));
  }, [discovered, selectedIds]);

  return (
    <IntegrationSectionCard
      title="Home Assistant"
      description={t("settings.integrations.homeAssistant.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="/icons/home-assistant.png"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.integrations.homeAssistant.baseUrl")}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t("settings.integrations.homeAssistant.baseUrlPlaceholder")}
            autoComplete="off"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t("settings.integrations.homeAssistant.accessToken")}
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={t(
              "settings.integrations.homeAssistant.accessTokenPlaceholder",
            )}
            autoComplete="off"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={discoverMutation.isPending || !enabled}
            onClick={() => void handleLoadDevices()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-600 disabled:opacity-50"
          >
            {discoverMutation.isPending
              ? t("settings.integrations.homeAssistant.loadingDevices")
              : t("settings.integrations.homeAssistant.loadDevices")}
          </button>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("settings.integrations.homeAssistant.devicesHint")}
        </p>

        {rows.length > 0 ? (
          <ul className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-600 divide-y divide-neutral-200 dark:divide-neutral-700">
            {rows.map((row) => (
              <li
                key={row.entity_id}
                className="flex items-start gap-3 px-3 py-2.5 bg-white dark:bg-neutral-900/50"
              >
                <input
                  type="checkbox"
                  id={`ha-entity-${row.entity_id}`}
                  checked={selectedIds.has(row.entity_id)}
                  onChange={(e) =>
                    toggleEntity(row.entity_id, e.target.checked)
                  }
                  className="mt-1 rounded border-neutral-300 dark:border-neutral-600"
                />
                <label
                  htmlFor={`ha-entity-${row.entity_id}`}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {row.friendly_name}
                  </span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">
                    {row.entity_id}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </IntegrationSectionCard>
  );
}
