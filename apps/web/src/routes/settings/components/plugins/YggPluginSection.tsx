import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUpdateYggPlugin, useYggPlugin } from '@hously/shared';
import { PluginSectionCard } from './PluginSectionCard';
import { PluginUrlInput } from './PluginUrlInput';

export function YggPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useYggPlugin();
  const saveMutation = useUpdateYggPlugin();

  const [flaresolverrUrl, setFlaresolverrUrl] = useState('');
  const [yggUrl, setYggUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setFlaresolverrUrl(data.plugin.flaresolverr_url || '');
    setYggUrl(data.plugin.ygg_url || '');
    setUsername(data.plugin.username || '');
    setPassword('');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      flaresolverrUrl !== (data.plugin.flaresolverr_url || '') ||
      yggUrl !== (data.plugin.ygg_url || '') ||
      username !== (data.plugin.username || '') ||
      password !== '' ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, flaresolverrUrl, yggUrl, username, password, enabled]);

  const handleCancel = () => {
    setFlaresolverrUrl(data?.plugin.flaresolverr_url || '');
    setYggUrl(data?.plugin.ygg_url || '');
    setUsername(data?.plugin.username || '');
    setPassword('');
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        flaresolverr_url: flaresolverrUrl,
        ygg_url: yggUrl,
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
      title="YGG"
      description={t('settings.plugins.ygg.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="/icons/ygg.svg"
    >
      <PluginUrlInput
        label={t('settings.plugins.ygg.flaresolverrUrl')}
        value={flaresolverrUrl}
        onChange={setFlaresolverrUrl}
        placeholder="http://192.168.50.30:8191"
      />

      <PluginUrlInput
        label={t('settings.plugins.ygg.yggUrl')}
        value={yggUrl}
        onChange={setYggUrl}
        placeholder="https://www.yggtorrent.org"
      />

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.ygg.username')}
        </label>
        <input
          type="text"
          value={username}
          onChange={event => setUsername(event.target.value)}
          placeholder="username"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.ygg.password')}
        </label>
        <input
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          placeholder={t('settings.plugins.ygg.passwordPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
