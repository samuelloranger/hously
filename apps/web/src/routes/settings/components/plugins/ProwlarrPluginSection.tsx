import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProwlarrPlugin, useUpdateProwlarrPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';
import { PluginUrlInput } from './PluginUrlInput';

export function ProwlarrPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useProwlarrPlugin();
  const saveMutation = useUpdateProwlarrPlugin();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setApiKey(data.plugin.api_key || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || '') ||
      apiKey !== (data.plugin.api_key || '') ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [apiKey, data, enabled, websiteUrl]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setApiKey(data?.plugin.api_key || '');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        enabled,
      })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="Prowlarr"
      description={t('settings.plugins.prowlarr.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/prowlarr.png"
    >
      <PluginUrlInput
        label={t('settings.plugins.prowlarr.websiteUrl')}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://prowlarr.example.com"
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('settings.plugins.prowlarr.apiKey')}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
          placeholder={t('settings.plugins.prowlarr.apiKeyPlaceholder')}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 font-mono text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
        />
      </div>
    </PluginSectionCard>
  );
}
