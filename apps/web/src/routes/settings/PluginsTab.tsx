import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pluginsApi } from '../../features/plugins/api';
import { queryKeys } from '../../lib/queryKeys';

export function PluginsTab() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.plugins.jellyfin(),
    queryFn: pluginsApi.getJellyfinPlugin,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setApiKey(data.plugin.api_key || '');
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: pluginsApi.updateJellyfinPlugin,
    onSuccess: async result => {
      if (result.queued) {
        toast.error(t('settings.plugins.saveError'));
        return;
      }

      queryClient.setQueryData(queryKeys.plugins.jellyfin(), { plugin: result.plugin });
      toast.success(t('settings.plugins.saveSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.plugins.jellyfin() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.jellyfinLatest() }),
      ]);
    },
    onError: () => {
      toast.error(t('settings.plugins.saveError'));
    },
  });

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="plugins-tab">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">{t('settings.plugins.title')}</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.plugins.description')}</p>

        <div className="rounded-2xl p-5 mb-6 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-cyan-50 dark:from-neutral-800 dark:to-cyan-950/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Jellyfin</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.plugins.jellyfin.help')}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={enabled}
                onChange={event => setEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              {t('settings.plugins.enabled')}
            </label>
          </div>
        </div>

        <div className="space-y-4">
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
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setWebsiteUrl(data?.plugin.website_url || '');
              setApiKey(data?.plugin.api_key || '');
              setEnabled(Boolean(data?.plugin.enabled));
            }}
            disabled={isLoading || saveMutation.isPending}
            className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() =>
              saveMutation.mutate({
                website_url: websiteUrl,
                api_key: apiKey,
                enabled,
              })
            }
            disabled={isLoading || saveMutation.isPending}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending ? t('common.loading') : t('settings.plugins.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
