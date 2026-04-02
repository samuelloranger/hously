import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdguardPlugin, useUpdateAdguardPlugin } from '@/hooks/usePlugins';
import { toast } from 'sonner';
import { PluginSectionCard } from '@/pages/settings/_component/plugins/PluginSectionCard';
import { PluginUrlInput } from '@/pages/settings/_component/plugins/PluginUrlInput';

export function AdguardPluginSection() {
  const { data, isLoading } = useAdguardPlugin();
  return <AdguardPluginSectionImpl key={data?.plugin?.type ?? 'pending'} data={data} isLoading={isLoading} />;
}

function AdguardPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useAdguardPlugin>['data'];
  isLoading: boolean;
}) {
  const { t } = useTranslation('common');
  const saveMutation = useUpdateAdguardPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || '');
  const [username, setUsername] = useState(data?.plugin?.username || '');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || '') ||
      username !== (data.plugin.username || '') ||
      password !== '' ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, websiteUrl, username, password, enabled]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setUsername(data?.plugin.username || '');
    setPassword('');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        username,
        password: password.trim() ? password : undefined,
        enabled,
      })
      .then(() => {
        setPassword('');
        toast.success(t('settings.plugins.saveSuccess'));
      })
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="AdGuard Home"
      description={t('settings.plugins.adguard.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/adguard-home.png"
    >
      <PluginUrlInput
        label={t('settings.plugins.adguard.websiteUrl')}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="http://adguardhome:3000"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.adguard.username')}
        </label>
        <input
          type="text"
          value={username}
          onChange={event => setUsername(event.target.value)}
          placeholder="admin"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.adguard.password')}
        </label>
        <input
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          placeholder={t('settings.plugins.adguard.passwordPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
