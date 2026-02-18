import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScrutinyPlugin, useUpdateScrutinyPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';
import { PluginUrlInput } from './PluginUrlInput';

export function ScrutinyPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useScrutinyPlugin();
  const saveMutation = useUpdateScrutinyPlugin();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return websiteUrl !== (data.plugin.website_url || '') || enabled !== Boolean(data.plugin.enabled);
  }, [data, websiteUrl, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ website_url: websiteUrl, enabled })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="Scrutiny"
      description={t('settings.plugins.scrutiny.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/scrutiny.png"
    >
      <PluginUrlInput
        label={t('settings.plugins.scrutiny.websiteUrl')}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://scrutiny:8080"
      />
    </PluginSectionCard>
  );
}
