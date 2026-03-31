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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setEmail(data.plugin.email || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || '') ||
      email !== (data.plugin.email || '') ||
      enabled !== Boolean(data.plugin.enabled) ||
      password.trim().length > 0
    );
  }, [data, websiteUrl, email, enabled, password]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setEmail(data?.plugin.email || '');
    setPassword('');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    const payload: { website_url: string; email: string; enabled: boolean; password?: string } = {
      website_url: websiteUrl,
      email,
      enabled,
    };
    if (password.trim()) payload.password = password.trim();

    saveMutation
      .mutateAsync(payload)
      .then(() => {
        setPassword('');
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
        label={t('settings.plugins.beszel.email')}
        value={email}
        onChange={setEmail}
        placeholder="admin@example.com"
      />
      <PluginUrlInput
        label={t('settings.plugins.beszel.password')}
        value={password}
        onChange={setPassword}
        placeholder={data?.plugin?.password_set ? t('settings.plugins.beszel.passwordSet') : ''}
      />
    </PluginSectionCard>
  );
}
