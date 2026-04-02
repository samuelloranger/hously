import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useHomeAssistantDiscoverEntities,
  useHomeAssistantPlugin,
  useUpdateHomeAssistantPlugin,
} from '@/hooks/usePlugins';
import { type HomeAssistantDiscoverEntity } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from '@/pages/settings/_component/plugins/PluginSectionCard';

function sortIds(ids: string[]): string[] {
  return [...ids].sort();
}

export function HomeAssistantPluginSection() {
  const { data, isLoading } = useHomeAssistantPlugin();
  return <HomeAssistantPluginSectionImpl key={data?.plugin?.type ?? 'pending'} data={data} isLoading={isLoading} />;
}

function HomeAssistantPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useHomeAssistantPlugin>['data'];
  isLoading: boolean;
}) {
  const { t } = useTranslation('common');
  const saveMutation = useUpdateHomeAssistantPlugin();
  const discoverMutation = useHomeAssistantDiscoverEntities();

  const [baseUrl, setBaseUrl] = useState(data?.plugin?.base_url || '');
  const [accessToken, setAccessToken] = useState('');
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(data?.plugin?.enabled_entity_ids ?? []));
  const [discovered, setDiscovered] = useState<HomeAssistantDiscoverEntity[] | null>(null);

  // Sync form state when server data updates (during-render update instead of an effect)
  const [prevPlugin, setPrevPlugin] = useState(data?.plugin);
  if (data?.plugin !== prevPlugin) {
    setPrevPlugin(data?.plugin);
    setBaseUrl(data?.plugin?.base_url || '');
    setEnabled(Boolean(data?.plugin?.enabled));
    setSelectedIds(new Set(data?.plugin?.enabled_entity_ids ?? []));
  }

  const toggleEntity = useCallback((entityId: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(entityId);
      else next.delete(entityId);
      return next;
    });
  }, []);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    const origIds = sortIds(data.plugin.enabled_entity_ids ?? []);
    const curIds = sortIds([...selectedIds]);
    return (
      baseUrl !== (data.plugin.base_url || '') ||
      enabled !== Boolean(data.plugin.enabled) ||
      accessToken.trim().length > 0 ||
      origIds.join('\n') !== curIds.join('\n')
    );
  }, [data, baseUrl, enabled, accessToken, selectedIds]);

  const handleCancel = () => {
    setBaseUrl(data?.plugin.base_url || '');
    setAccessToken('');
    setEnabled(Boolean(data?.plugin.enabled));
    setSelectedIds(new Set(data?.plugin.enabled_entity_ids ?? []));
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
        setAccessToken('');
        toast.success(t('settings.plugins.saveSuccess'));
      })
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  const handleLoadDevices = async () => {
    try {
      const res = await discoverMutation.mutateAsync();
      setDiscovered(res.entities);
      if (res.entities.length === 0) {
        toast.message(t('settings.plugins.homeAssistant.noDevicesFound'));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('settings.plugins.saveError');
      toast.error(msg);
    }
  };

  const rows: HomeAssistantDiscoverEntity[] = useMemo(() => {
    if (discovered && discovered.length > 0) return discovered;
    const ids = [...selectedIds];
    if (ids.length === 0) return [];
    return ids.map(entity_id => ({
      entity_id,
      friendly_name: entity_id,
      domain: entity_id.startsWith('light.') ? ('light' as const) : ('switch' as const),
    }));
  }, [discovered, selectedIds]);

  return (
    <PluginSectionCard
      title="Home Assistant"
      description={t('settings.plugins.homeAssistant.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://brands.home-assistant.io/_/logo.png"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('settings.plugins.homeAssistant.baseUrl')}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder={t('settings.plugins.homeAssistant.baseUrlPlaceholder')}
            autoComplete="off"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('settings.plugins.homeAssistant.accessToken')}
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={e => setAccessToken(e.target.value)}
            placeholder={t('settings.plugins.homeAssistant.accessTokenPlaceholder')}
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
              ? t('settings.plugins.homeAssistant.loadingDevices')
              : t('settings.plugins.homeAssistant.loadDevices')}
          </button>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {t('settings.plugins.homeAssistant.devicesHint')}
        </p>

        {rows.length > 0 ? (
          <ul className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-600 divide-y divide-neutral-200 dark:divide-neutral-700">
            {rows.map(row => (
              <li key={row.entity_id} className="flex items-start gap-3 px-3 py-2.5 bg-white dark:bg-neutral-900/50">
                <input
                  type="checkbox"
                  id={`ha-entity-${row.entity_id}`}
                  checked={selectedIds.has(row.entity_id)}
                  onChange={e => toggleEntity(row.entity_id, e.target.checked)}
                  className="mt-1 rounded border-neutral-300 dark:border-neutral-600"
                />
                <label htmlFor={`ha-entity-${row.entity_id}`} className="flex-1 min-w-0 cursor-pointer">
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
    </PluginSectionCard>
  );
}
