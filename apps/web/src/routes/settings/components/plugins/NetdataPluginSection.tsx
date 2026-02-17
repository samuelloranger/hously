import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNetdataPlugin, useUpdateNetdataPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

export function NetdataPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useNetdataPlugin();
  const saveMutation = useUpdateNetdataPlugin();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        enabled,
      })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="Netdata"
      description={t('settings.plugins.netdata.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      className="mt-8 bg-gradient-to-br from-neutral-50 to-cyan-50 dark:from-neutral-800 dark:to-cyan-950/20"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.netdata.websiteUrl')}
        </label>
        <input
          type="url"
          value={websiteUrl}
          onChange={event => setWebsiteUrl(event.target.value)}
          placeholder="http://netdata:19999"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>
    </PluginSectionCard>
  );
}
