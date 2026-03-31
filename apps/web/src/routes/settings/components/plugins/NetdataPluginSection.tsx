import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBeszelPlugin, useUpdateBeszelPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';
import { PluginUrlInput } from './PluginUrlInput';

export function BeszelPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useBeszelPlugin();
  const saveMutation = useUpdateBeszelPlugin();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || '') ||
      enabled !== Boolean(data.plugin.enabled) ||
      apiToken.trim().length > 0
    );
  }, [data, websiteUrl, enabled, apiToken]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setApiToken('');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    const payload: { website_url: string; enabled: boolean; api_token?: string } = {
      website_url: websiteUrl,
      enabled,
    };
    if (apiToken.trim()) payload.api_token = apiToken.trim();

    saveMutation
      .mutateAsync(payload)
      .then(() => {
        setApiToken('');
        toast.success(t('settings.plugins.saveSuccess'));
      })
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="Beszel"
      description={t('settings.plugins.beszel.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/beszel.png"
    >
      <PluginUrlInput
        label={t('settings.plugins.beszel.websiteUrl')}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://beszel:8090"
      />
      <PluginUrlInput
        label={t('settings.plugins.beszel.apiToken')}
        value={apiToken}
        onChange={setApiToken}
        placeholder={data?.plugin?.api_token_set ? t('settings.plugins.beszel.apiTokenSet') : ''}
      />
    </PluginSectionCard>
  );
}
