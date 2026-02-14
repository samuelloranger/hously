import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pluginsApi } from '../../features/plugins/api';
import { queryKeys } from '../../lib/queryKeys';

export function PluginsTab() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();

  const { data: jellyfinData, isLoading: jellyfinLoading } = useQuery({
    queryKey: queryKeys.plugins.jellyfin(),
    queryFn: pluginsApi.getJellyfinPlugin,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: radarrData, isLoading: radarrLoading } = useQuery({
    queryKey: queryKeys.plugins.radarr(),
    queryFn: pluginsApi.getRadarrPlugin,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: sonarrData, isLoading: sonarrLoading } = useQuery({
    queryKey: queryKeys.plugins.sonarr(),
    queryFn: pluginsApi.getSonarrPlugin,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const { data: qbittorrentData, isLoading: qbittorrentLoading } = useQuery({
    queryKey: queryKeys.plugins.qbittorrent(),
    queryFn: pluginsApi.getQbittorrentPlugin,
    refetchOnMount: 'always',
    staleTime: 0,
  });

  const [jellyfinWebsiteUrl, setJellyfinWebsiteUrl] = useState('');
  const [jellyfinApiKey, setJellyfinApiKey] = useState('');
  const [jellyfinEnabled, setJellyfinEnabled] = useState(false);

  const [radarrWebsiteUrl, setRadarrWebsiteUrl] = useState('');
  const [radarrApiKey, setRadarrApiKey] = useState('');
  const [radarrRootFolderPath, setRadarrRootFolderPath] = useState('');
  const [radarrQualityProfileId, setRadarrQualityProfileId] = useState('1');
  const [radarrEnabled, setRadarrEnabled] = useState(false);
  const [radarrQualityProfiles, setRadarrQualityProfiles] = useState<Array<{ id: number; name: string }>>([]);

  const [sonarrWebsiteUrl, setSonarrWebsiteUrl] = useState('');
  const [sonarrApiKey, setSonarrApiKey] = useState('');
  const [sonarrRootFolderPath, setSonarrRootFolderPath] = useState('');
  const [sonarrQualityProfileId, setSonarrQualityProfileId] = useState('1');
  const [sonarrLanguageProfileId, setSonarrLanguageProfileId] = useState('1');
  const [sonarrEnabled, setSonarrEnabled] = useState(false);
  const [sonarrQualityProfiles, setSonarrQualityProfiles] = useState<Array<{ id: number; name: string }>>([]);
  const [sonarrLanguageProfiles, setSonarrLanguageProfiles] = useState<Array<{ id: number; name: string }>>([]);

  const [qbittorrentWebsiteUrl, setQbittorrentWebsiteUrl] = useState('');
  const [qbittorrentUsername, setQbittorrentUsername] = useState('');
  const [qbittorrentPassword, setQbittorrentPassword] = useState('');
  const [qbittorrentPollInterval, setQbittorrentPollInterval] = useState('2');
  const [qbittorrentMaxItems, setQbittorrentMaxItems] = useState('8');
  const [qbittorrentEnabled, setQbittorrentEnabled] = useState(false);

  const filterDeprecatedProfiles = (profiles: Array<{ id: number; name: string }>) =>
    profiles.filter(profile => !/\bdeprecated\b/i.test(profile.name));

  useEffect(() => {
    if (!jellyfinData?.plugin) return;
    setJellyfinWebsiteUrl(jellyfinData.plugin.website_url || '');
    setJellyfinApiKey(jellyfinData.plugin.api_key || '');
    setJellyfinEnabled(Boolean(jellyfinData.plugin.enabled));
  }, [jellyfinData]);

  useEffect(() => {
    if (!radarrData?.plugin) return;
    setRadarrWebsiteUrl(radarrData.plugin.website_url || '');
    setRadarrApiKey(radarrData.plugin.api_key || '');
    setRadarrRootFolderPath(radarrData.plugin.root_folder_path || '');
    setRadarrQualityProfileId(String(radarrData.plugin.quality_profile_id || 1));
    setRadarrEnabled(Boolean(radarrData.plugin.enabled));
  }, [radarrData]);

  useEffect(() => {
    if (!sonarrData?.plugin) return;
    setSonarrWebsiteUrl(sonarrData.plugin.website_url || '');
    setSonarrApiKey(sonarrData.plugin.api_key || '');
    setSonarrRootFolderPath(sonarrData.plugin.root_folder_path || '');
    setSonarrQualityProfileId(String(sonarrData.plugin.quality_profile_id || 1));
    setSonarrLanguageProfileId(String(sonarrData.plugin.language_profile_id || 1));
    setSonarrEnabled(Boolean(sonarrData.plugin.enabled));
  }, [sonarrData]);

  useEffect(() => {
    if (!qbittorrentData?.plugin) return;
    setQbittorrentWebsiteUrl(qbittorrentData.plugin.website_url || '');
    setQbittorrentUsername(qbittorrentData.plugin.username || '');
    setQbittorrentPassword('');
    setQbittorrentPollInterval(String(qbittorrentData.plugin.poll_interval_seconds || 2));
    setQbittorrentMaxItems(String(qbittorrentData.plugin.max_items || 8));
    setQbittorrentEnabled(Boolean(qbittorrentData.plugin.enabled));
  }, [qbittorrentData]);

  const jellyfinSaveMutation = useMutation({
    mutationFn: pluginsApi.updateJellyfinPlugin,
    onSuccess: async result => {
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

  const radarrSaveMutation = useMutation({
    mutationFn: pluginsApi.updateRadarrPlugin,
    onSuccess: async result => {
      queryClient.setQueryData(queryKeys.plugins.radarr(), { plugin: result.plugin });
      toast.success(t('settings.plugins.saveSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.plugins.radarr() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.upcoming() }),
      ]);
    },
    onError: () => {
      toast.error(t('settings.plugins.saveError'));
    },
  });

  const sonarrSaveMutation = useMutation({
    mutationFn: pluginsApi.updateSonarrPlugin,
    onSuccess: async result => {
      queryClient.setQueryData(queryKeys.plugins.sonarr(), { plugin: result.plugin });
      toast.success(t('settings.plugins.saveSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.plugins.sonarr() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.upcoming() }),
      ]);
    },
    onError: () => {
      toast.error(t('settings.plugins.saveError'));
    },
  });

  const qbittorrentSaveMutation = useMutation({
    mutationFn: pluginsApi.updateQbittorrentPlugin,
    onSuccess: async result => {
      queryClient.setQueryData(queryKeys.plugins.qbittorrent(), { plugin: result.plugin });
      setQbittorrentPassword('');
      toast.success(t('settings.plugins.saveSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.plugins.qbittorrent() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.qbittorrentStatus() }),
      ]);
    },
    onError: () => {
      toast.error(t('settings.plugins.saveError'));
    },
  });

  const fetchRadarrProfilesMutation = useMutation({
    mutationFn: pluginsApi.getRadarrProfiles,
    onSuccess: result => {
      setRadarrQualityProfiles(result.quality_profiles || []);
      if (result.quality_profiles.length > 0) {
        const hasCurrent = result.quality_profiles.some(profile => String(profile.id) === radarrQualityProfileId);
        if (!hasCurrent) {
          setRadarrQualityProfileId(String(result.quality_profiles[0].id));
        }
      }
    },
    onError: () => {
      toast.error(t('settings.plugins.profileFetchError'));
    },
  });

  const fetchSonarrProfilesMutation = useMutation({
    mutationFn: pluginsApi.getSonarrProfiles,
    onSuccess: result => {
      const filteredLanguageProfiles = filterDeprecatedProfiles(result.language_profiles || []);
      setSonarrQualityProfiles(result.quality_profiles || []);
      setSonarrLanguageProfiles(filteredLanguageProfiles);

      if (result.quality_profiles.length > 0) {
        const hasCurrentQuality = result.quality_profiles.some(profile => String(profile.id) === sonarrQualityProfileId);
        if (!hasCurrentQuality) {
          setSonarrQualityProfileId(String(result.quality_profiles[0].id));
        }
      }

      if (filteredLanguageProfiles.length > 0) {
        const hasCurrentLanguage = filteredLanguageProfiles.some(profile => String(profile.id) === sonarrLanguageProfileId);
        if (!hasCurrentLanguage) {
          setSonarrLanguageProfileId(String(filteredLanguageProfiles[0].id));
        }
      }
    },
    onError: () => {
      toast.error(t('settings.plugins.profileFetchError'));
    },
  });

  const isAnyLoading = jellyfinLoading || radarrLoading || sonarrLoading || qbittorrentLoading;
  const isAnySaving =
    jellyfinSaveMutation.isPending ||
    radarrSaveMutation.isPending ||
    sonarrSaveMutation.isPending ||
    qbittorrentSaveMutation.isPending;

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300" key="plugins-tab">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2 text-neutral-900 dark:text-neutral-100">{t('settings.plugins.title')}</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('settings.plugins.description')}</p>

        <div className="rounded-2xl p-5 mb-8 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-cyan-50 dark:from-neutral-800 dark:to-cyan-950/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Jellyfin</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.plugins.jellyfin.help')}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={jellyfinEnabled}
                onChange={event => setJellyfinEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              {t('settings.plugins.enabled')}
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.jellyfin.websiteUrl')}
              </label>
              <input
                type="url"
                value={jellyfinWebsiteUrl}
                onChange={event => setJellyfinWebsiteUrl(event.target.value)}
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
                value={jellyfinApiKey}
                onChange={event => setJellyfinApiKey(event.target.value)}
                placeholder={t('settings.plugins.jellyfin.apiKeyPlaceholder')}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setJellyfinWebsiteUrl(jellyfinData?.plugin.website_url || '');
                setJellyfinApiKey(jellyfinData?.plugin.api_key || '');
                setJellyfinEnabled(Boolean(jellyfinData?.plugin.enabled));
              }}
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() =>
                jellyfinSaveMutation.mutate({
                  website_url: jellyfinWebsiteUrl,
                  api_key: jellyfinApiKey,
                  enabled: jellyfinEnabled,
                })
              }
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {jellyfinSaveMutation.isPending ? t('common.loading') : t('settings.plugins.save')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl p-5 mb-8 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-rose-50 dark:from-neutral-800 dark:to-rose-950/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Radarr</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.plugins.radarr.help')}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={radarrEnabled}
                onChange={event => setRadarrEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              {t('settings.plugins.enabled')}
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.radarr.websiteUrl')}
              </label>
              <input
                type="url"
                value={radarrWebsiteUrl}
                onChange={event => setRadarrWebsiteUrl(event.target.value)}
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
                value={radarrApiKey}
                onChange={event => setRadarrApiKey(event.target.value)}
                onBlur={() => {
                  const websiteUrl = radarrWebsiteUrl.trim();
                  const apiKey = radarrApiKey.trim();
                  if (!websiteUrl || !apiKey) return;
                  fetchRadarrProfilesMutation.mutate({ website_url: websiteUrl, api_key: apiKey });
                }}
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
                value={radarrRootFolderPath}
                onChange={event => setRadarrRootFolderPath(event.target.value)}
                placeholder="/movies"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.radarr.qualityProfileId')}
              </label>
              {radarrQualityProfiles.length > 0 ? (
                <select
                  value={radarrQualityProfileId}
                  onChange={event => setRadarrQualityProfileId(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  {radarrQualityProfiles.map(profile => (
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
                  value={radarrQualityProfileId}
                  onChange={event => setRadarrQualityProfileId(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              )}
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {fetchRadarrProfilesMutation.isPending
                  ? t('settings.plugins.profileFetchLoading')
                  : t('settings.plugins.profileFetchHint')}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setRadarrWebsiteUrl(radarrData?.plugin.website_url || '');
                setRadarrApiKey(radarrData?.plugin.api_key || '');
                setRadarrRootFolderPath(radarrData?.plugin.root_folder_path || '');
                setRadarrQualityProfileId(String(radarrData?.plugin.quality_profile_id || 1));
                setRadarrEnabled(Boolean(radarrData?.plugin.enabled));
              }}
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() =>
                radarrSaveMutation.mutate({
                  website_url: radarrWebsiteUrl,
                  api_key: radarrApiKey,
                  root_folder_path: radarrRootFolderPath,
                  quality_profile_id: Number(radarrQualityProfileId || 0),
                  enabled: radarrEnabled,
                })
              }
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {radarrSaveMutation.isPending ? t('common.loading') : t('settings.plugins.save')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-blue-50 dark:from-neutral-800 dark:to-blue-950/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sonarr</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{t('settings.plugins.sonarr.help')}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={sonarrEnabled}
                onChange={event => setSonarrEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              {t('settings.plugins.enabled')}
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.sonarr.websiteUrl')}
              </label>
              <input
                type="url"
                value={sonarrWebsiteUrl}
                onChange={event => setSonarrWebsiteUrl(event.target.value)}
                placeholder="https://sonarr.example.com"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.sonarr.apiKey')}
              </label>
              <input
                type="password"
                value={sonarrApiKey}
                onChange={event => setSonarrApiKey(event.target.value)}
                onBlur={() => {
                  const websiteUrl = sonarrWebsiteUrl.trim();
                  const apiKey = sonarrApiKey.trim();
                  if (!websiteUrl || !apiKey) return;
                  fetchSonarrProfilesMutation.mutate({ website_url: websiteUrl, api_key: apiKey });
                }}
                placeholder={t('settings.plugins.sonarr.apiKeyPlaceholder')}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.sonarr.rootFolderPath')}
              </label>
              <input
                type="text"
                value={sonarrRootFolderPath}
                onChange={event => setSonarrRootFolderPath(event.target.value)}
                placeholder="/tv"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.sonarr.qualityProfileId')}
              </label>
              {sonarrQualityProfiles.length > 0 ? (
                <select
                  value={sonarrQualityProfileId}
                  onChange={event => setSonarrQualityProfileId(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  {sonarrQualityProfiles.map(profile => (
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
                  value={sonarrQualityProfileId}
                  onChange={event => setSonarrQualityProfileId(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.sonarr.languageProfileId')}
              </label>
              {sonarrLanguageProfiles.length > 0 ? (
                <select
                  value={sonarrLanguageProfileId}
                  onChange={event => setSonarrLanguageProfileId(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  {sonarrLanguageProfiles.map(profile => (
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
                  value={sonarrLanguageProfileId}
                  onChange={event => setSonarrLanguageProfileId(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              )}
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {fetchSonarrProfilesMutation.isPending
                  ? t('settings.plugins.profileFetchLoading')
                  : t('settings.plugins.profileFetchHint')}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setSonarrWebsiteUrl(sonarrData?.plugin.website_url || '');
                setSonarrApiKey(sonarrData?.plugin.api_key || '');
                setSonarrRootFolderPath(sonarrData?.plugin.root_folder_path || '');
                setSonarrQualityProfileId(String(sonarrData?.plugin.quality_profile_id || 1));
                setSonarrLanguageProfileId(String(sonarrData?.plugin.language_profile_id || 1));
                setSonarrEnabled(Boolean(sonarrData?.plugin.enabled));
              }}
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() =>
                sonarrSaveMutation.mutate({
                  website_url: sonarrWebsiteUrl,
                  api_key: sonarrApiKey,
                  root_folder_path: sonarrRootFolderPath,
                  quality_profile_id: Number(sonarrQualityProfileId || 0),
                  language_profile_id: Number(sonarrLanguageProfileId || 0),
                  enabled: sonarrEnabled,
                })
              }
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sonarrSaveMutation.isPending ? t('common.loading') : t('settings.plugins.save')}
            </button>
          </div>
        </div>

        <div className="rounded-2xl p-5 mt-8 border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-neutral-50 to-amber-50 dark:from-neutral-800 dark:to-amber-950/20">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">qBittorrent</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {t('settings.plugins.qbittorrent.help')}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={qbittorrentEnabled}
                onChange={event => setQbittorrentEnabled(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              {t('settings.plugins.enabled')}
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.qbittorrent.websiteUrl')}
              </label>
              <input
                type="url"
                value={qbittorrentWebsiteUrl}
                onChange={event => setQbittorrentWebsiteUrl(event.target.value)}
                placeholder="http://qbittorrent:8080"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.qbittorrent.username')}
              </label>
              <input
                type="text"
                value={qbittorrentUsername}
                onChange={event => setQbittorrentUsername(event.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                {t('settings.plugins.qbittorrent.password')}
              </label>
              <input
                type="password"
                value={qbittorrentPassword}
                onChange={event => setQbittorrentPassword(event.target.value)}
                placeholder={t('settings.plugins.qbittorrent.passwordPlaceholder')}
                className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('settings.plugins.qbittorrent.pollInterval')}
                </label>
                <input
                  type="number"
                  min={2}
                  max={30}
                  step={1}
                  value={qbittorrentPollInterval}
                  onChange={event => setQbittorrentPollInterval(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {t('settings.plugins.qbittorrent.maxItems')}
                </label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  step={1}
                  value={qbittorrentMaxItems}
                  onChange={event => setQbittorrentMaxItems(event.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setQbittorrentWebsiteUrl(qbittorrentData?.plugin.website_url || '');
                setQbittorrentUsername(qbittorrentData?.plugin.username || '');
                setQbittorrentPassword('');
                setQbittorrentPollInterval(String(qbittorrentData?.plugin.poll_interval_seconds || 2));
                setQbittorrentMaxItems(String(qbittorrentData?.plugin.max_items || 8));
                setQbittorrentEnabled(Boolean(qbittorrentData?.plugin.enabled));
              }}
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() =>
                qbittorrentSaveMutation.mutate({
                  website_url: qbittorrentWebsiteUrl,
                  username: qbittorrentUsername,
                  password: qbittorrentPassword.trim() ? qbittorrentPassword : undefined,
                  poll_interval_seconds: Number(qbittorrentPollInterval || 2),
                  max_items: Number(qbittorrentMaxItems || 8),
                  enabled: qbittorrentEnabled,
                })
              }
              disabled={isAnyLoading || isAnySaving}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {qbittorrentSaveMutation.isPending ? t('common.loading') : t('settings.plugins.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
