import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRadarrPlugin, useRadarrProfiles, useUpdateRadarrPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

export function RadarrPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useRadarrPlugin();
  const saveMutation = useUpdateRadarrPlugin();
  const fetchProfilesMutation = useRadarrProfiles();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rootFolderPath, setRootFolderPath] = useState('');
  const [qualityProfileId, setQualityProfileId] = useState('1');
  const [enabled, setEnabled] = useState(false);
  const [qualityProfiles, setQualityProfiles] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    if (!data?.plugin) return;
    setWebsiteUrl(data.plugin.website_url || '');
    setApiKey(data.plugin.api_key || '');
    setRootFolderPath(data.plugin.root_folder_path || '');
    setQualityProfileId(String(data.plugin.quality_profile_id || 1));
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || '');
    setApiKey(data?.plugin.api_key || '');
    setRootFolderPath(data?.plugin.root_folder_path || '');
    setQualityProfileId(String(data?.plugin.quality_profile_id || 1));
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        root_folder_path: rootFolderPath,
        quality_profile_id: Number(qualityProfileId || 0),
        enabled,
      })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  const handleApiKeyBlur = () => {
    const trimmedUrl = websiteUrl.trim();
    const trimmedApiKey = apiKey.trim();
    if (!trimmedUrl || !trimmedApiKey) return;

    fetchProfilesMutation
      .mutateAsync({ website_url: trimmedUrl, api_key: trimmedApiKey })
      .then(result => {
        setQualityProfiles(result.quality_profiles || []);
        if (result.quality_profiles.length > 0) {
          const hasCurrent = result.quality_profiles.some(profile => String(profile.id) === qualityProfileId);
          if (!hasCurrent) {
            setQualityProfileId(String(result.quality_profiles[0].id));
          }
        }
      })
      .catch(() => toast.error(t('settings.plugins.profileFetchError')));
  };

  return (
    <PluginSectionCard
      title="Radarr"
      description={t('settings.plugins.radarr.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      className="bg-gradient-to-br from-neutral-50 to-rose-50 dark:from-neutral-800 dark:to-rose-950/20"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.radarr.websiteUrl')}
        </label>
        <input
          type="url"
          value={websiteUrl}
          onChange={event => setWebsiteUrl(event.target.value)}
          placeholder="https://radarr.example.com"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.radarr.apiKey')}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
          onBlur={handleApiKeyBlur}
          placeholder={t('settings.plugins.radarr.apiKeyPlaceholder')}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.radarr.rootFolderPath')}
        </label>
        <input
          type="text"
          value={rootFolderPath}
          onChange={event => setRootFolderPath(event.target.value)}
          placeholder="/movies"
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.radarr.qualityProfileId')}
        </label>
        {qualityProfiles.length > 0 ? (
          <select
            value={qualityProfileId}
            onChange={event => setQualityProfileId(event.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          >
            {qualityProfiles.map(profile => (
              <option key={profile.id} value={String(profile.id)}>
                {profile.name} (#{profile.id})
              </option>
            ))}
          </select>
        ) : (
          <input
            type="number"
            min={1}
            step={1}
            value={qualityProfileId}
            onChange={event => setQualityProfileId(event.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
          />
        )}
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {fetchProfilesMutation.isPending
            ? t('settings.plugins.profileFetchLoading')
            : t('settings.plugins.profileFetchHint')}
        </p>
      </div>
    </PluginSectionCard>
  );
}
