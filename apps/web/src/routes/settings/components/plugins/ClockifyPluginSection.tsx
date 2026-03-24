import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClockifyPlugin, useUpdateClockifyPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';
import { useTheme } from '@/hooks/useTheme';

export function ClockifyPluginSection() {
  const { isDark } = useTheme();

  const { t } = useTranslation('common');
  const { data, isLoading } = useClockifyPlugin();
  const saveMutation = useUpdateClockifyPlugin();

  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    if (!data?.plugin) return;
    setApiKey(data.plugin.api_key || '');
    setEnabled(Boolean(data.plugin.enabled));
    setWorkspaceId(data.plugin.workspace_id || '');
    setUserId(data.plugin.user_id || '')
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      apiKey !== (data.plugin.api_key || '') ||
      enabled !== Boolean(data.plugin.enabled) ||
      workspaceId !== (data.plugin.workspace_id ?? '') ||
      userId !== (data.plugin.user_id ?? '')
    );
  }, [data, apiKey, enabled, workspaceId, userId]);

  const handleCancel = () => {
    setApiKey(data?.plugin.api_key || '');
    setEnabled(Boolean(data?.plugin.enabled));
    setWorkspaceId(data?.plugin.workspace_id || '');
    setUserId(data?.plugin.user_id || '')
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ api_key: apiKey, enabled, workspace_id: workspaceId, user_id: userId })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="Clockify"
      description={t('settings.plugins.clockify.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl={isDark ? "https://app.clockify.me/assets/clockify-logo-dark.svg" : "https://app.clockify.me/assets/clockify-logo.svg"}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.clockify.apiKey')}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
          placeholder={t('settings.plugins.clockify.apiKeyPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.clockify.workspaceId')}
        </label>
        <input
          value={workspaceId}
          onChange={event => setWorkspaceId(event.target.value)}
          placeholder={t('settings.plugins.clockify.workspaceIdPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.clockify.userId')}
        </label>
        <input
          value={userId}
          onChange={event => setUserId(event.target.value)}
          placeholder={t('settings.plugins.clockify.userIdPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>
    </PluginSectionCard>
  );
}
