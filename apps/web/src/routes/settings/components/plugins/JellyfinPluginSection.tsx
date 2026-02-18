import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJellyfinPlugin, useUpdateJellyfinPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

export function JellyfinPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useJellyfinPlugin();
  const saveMutation = useUpdateJellyfinPlugin();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setApiKey(data.plugin.api_key || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

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
      title="Jellyfin"
      description={t('settings.plugins.jellyfin.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      className="bg-gradient-to-br from-neutral-50 to-cyan-50 dark:from-neutral-800 dark:to-cyan-950/20"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.jellyfin.websiteUrl')}
        </label>
        <input
          type="url"
          value={websiteUrl}
          onChange={event => setWebsiteUrl(event.target.value)}
          placeholder="https://jellyfin.example.com"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.jellyfin.apiKey')}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
          placeholder={t('settings.plugins.jellyfin.apiKeyPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
