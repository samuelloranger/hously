import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTmdbPlugin, useUpdateTmdbPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

export function TmdbPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useTmdbPlugin();
  const saveMutation = useUpdateTmdbPlugin();

  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setApiKey(data.plugin.api_key || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return apiKey !== (data.plugin.api_key || '') || enabled !== Boolean(data.plugin.enabled);
  }, [data, apiKey, enabled]);

  const handleCancel = () => {
    setApiKey(data?.plugin.api_key || '');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ api_key: apiKey, enabled })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="TMDB"
      description={t('settings.plugins.tmdb.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/themoviedb.png"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.tmdb.apiKey')}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
          placeholder={t('settings.plugins.tmdb.apiKeyPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
