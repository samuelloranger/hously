import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { DASHBOARD_ENDPOINTS, PLUGIN_ENDPOINTS } from '../endpoints';
import type {
  ArrProfile,
  DashboardTrackerStatsResponse,
  HackernewsPlugin,
  HackernewsPluginUpdateResponse,
  RedditPlugin,
  RedditPluginUpdateResponse,
  RedditSubredditSearchResult,
  JellyfinPlugin,
  JellyfinPluginUpdateResponse,
  NetdataPlugin,
  NetdataPluginUpdateResponse,
  QbittorrentPlugin,
  QbittorrentPluginUpdateResponse,
  RadarrPlugin,
  RadarrPluginUpdateResponse,
  ScrutinyPlugin,
  ScrutinyPluginUpdateResponse,
  SonarrPlugin,
  SonarrPluginUpdateResponse,
  TmdbPlugin,
  TmdbPluginUpdateResponse,
  TrackerPlugin,
  TrackerPluginUpdateResponse,
  TrackerType,
  WeatherPlugin,
  WeatherPluginUpdateResponse,
  YggPlugin,
  YggPluginUpdateResponse,
} from '../types';

const TRACKER_PLUGIN_ENDPOINTS: Record<TrackerType, string> = {
  ygg: PLUGIN_ENDPOINTS.YGG,
  c411: PLUGIN_ENDPOINTS.C411,
  torr9: PLUGIN_ENDPOINTS.TORR9,
  g3mini: PLUGIN_ENDPOINTS.G3MINI,
  'la-cale': PLUGIN_ENDPOINTS.LA_CALE,
};

const TRACKER_DASHBOARD_ENDPOINTS: Record<TrackerType, string> = {
  ygg: DASHBOARD_ENDPOINTS.YGG.STATS,
  c411: DASHBOARD_ENDPOINTS.C411.STATS,
  torr9: DASHBOARD_ENDPOINTS.TORR9.STATS,
  g3mini: DASHBOARD_ENDPOINTS.G3MINI.STATS,
  'la-cale': DASHBOARD_ENDPOINTS.LA_CALE.STATS,
};

export function useTrackerPlugin<T extends TrackerType>(type: T) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.tracker(type),
    queryFn: () => fetcher<{ plugin: TrackerPlugin & { type: T } }>(TRACKER_PLUGIN_ENDPOINTS[type]),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useUpdateTrackerPlugin(type: TrackerType) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      flaresolverr_url: string;
      tracker_url: string;
      username: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<TrackerPluginUpdateResponse>(TRACKER_PLUGIN_ENDPOINTS[type], {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.tracker(type) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.trackerStats(type) });
    },
  });
}

export function useDashboardTrackerStats(type: TrackerType, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.dashboard.trackerStats(type),
    queryFn: () => fetcher<DashboardTrackerStatsResponse>(TRACKER_DASHBOARD_ENDPOINTS[type]),
    enabled: options?.enabled ?? true,
    // Stats are cached server-side for 24 h; avoid refetching on every mount.
    staleTime: 60 * 60 * 1000,
  });
}

export function useJellyfinPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.jellyfin(),
    queryFn: () => fetcher<{ plugin: JellyfinPlugin }>(PLUGIN_ENDPOINTS.JELLYFIN),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useRadarrPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.radarr(),
    queryFn: () => fetcher<{ plugin: RadarrPlugin }>(PLUGIN_ENDPOINTS.RADARR),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useSonarrPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.sonarr(),
    queryFn: () => fetcher<{ plugin: SonarrPlugin }>(PLUGIN_ENDPOINTS.SONARR),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useQbittorrentPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.qbittorrent(),
    queryFn: () => fetcher<{ plugin: QbittorrentPlugin }>(PLUGIN_ENDPOINTS.QBITTORRENT),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useScrutinyPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.scrutiny(),
    queryFn: () => fetcher<{ plugin: ScrutinyPlugin }>(PLUGIN_ENDPOINTS.SCRUTINY),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useNetdataPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.netdata(),
    queryFn: () => fetcher<{ plugin: NetdataPlugin }>(PLUGIN_ENDPOINTS.NETDATA),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useWeatherPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.weather(),
    queryFn: () => fetcher<{ plugin: WeatherPlugin }>(PLUGIN_ENDPOINTS.WEATHER),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useTmdbPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.tmdb(),
    queryFn: () => fetcher<{ plugin: TmdbPlugin }>(PLUGIN_ENDPOINTS.TMDB),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useYggPlugin() {
  const query = useTrackerPlugin('ygg');

  if (!query.data) return query as typeof query & { data: undefined };

  return {
    ...query,
    data: {
      plugin: {
        type: 'ygg' as const,
        enabled: query.data.plugin.enabled,
        flaresolverr_url: query.data.plugin.flaresolverr_url,
        ygg_url: query.data.plugin.tracker_url,
        username: query.data.plugin.username,
        password_set: query.data.plugin.password_set,
      } satisfies YggPlugin,
    },
  };
}

export const useC411Plugin = () => useTrackerPlugin('c411');
export const useTorr9Plugin = () => useTrackerPlugin('torr9');
export const useG3miniPlugin = () => useTrackerPlugin('g3mini');
export const useLaCalePlugin = () => useTrackerPlugin('la-cale');

export function useUpdateJellyfinPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; api_key: string; enabled: boolean }) =>
      fetcher<JellyfinPluginUpdateResponse>(PLUGIN_ENDPOINTS.JELLYFIN, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.jellyfin() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.jellyfinLatest() });
    },
  });
}

export function useUpdateRadarrPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      root_folder_path: string;
      quality_profile_id: number;
      enabled: boolean;
    }) =>
      fetcher<RadarrPluginUpdateResponse>(PLUGIN_ENDPOINTS.RADARR, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.radarr() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.upcoming() });
    },
  });
}

export function useUpdateSonarrPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      root_folder_path: string;
      quality_profile_id: number;
      language_profile_id: number;
      enabled: boolean;
    }) =>
      fetcher<SonarrPluginUpdateResponse>(PLUGIN_ENDPOINTS.SONARR, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.sonarr() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.upcoming() });
    },
  });
}

export function useUpdateQbittorrentPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      username: string;
      password?: string;
      poll_interval_seconds?: number;
      max_items?: number;
      enabled: boolean;
    }) =>
      fetcher<QbittorrentPluginUpdateResponse>(PLUGIN_ENDPOINTS.QBITTORRENT, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.qbittorrent() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.qbittorrentStatus() });
    },
  });
}

export function useUpdateScrutinyPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; enabled: boolean }) =>
      fetcher<ScrutinyPluginUpdateResponse>(PLUGIN_ENDPOINTS.SCRUTINY, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.scrutiny() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.scrutinySummary() });
    },
  });
}

export function useUpdateNetdataPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; enabled: boolean }) =>
      fetcher<NetdataPluginUpdateResponse>(PLUGIN_ENDPOINTS.NETDATA, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.netdata() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.netdataSummary() });
    },
  });
}

export function useUpdateWeatherPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { address: string; temperature_unit: 'fahrenheit' | 'celsius'; enabled: boolean }) =>
      fetcher<WeatherPluginUpdateResponse>(PLUGIN_ENDPOINTS.WEATHER, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.weather() });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.current() });
    },
  });
}

export function useUpdateTmdbPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { api_key: string; enabled: boolean }) =>
      fetcher<TmdbPluginUpdateResponse>(PLUGIN_ENDPOINTS.TMDB, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.tmdb() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.upcoming() });
    },
  });
}

export function useUpdateYggPlugin() {
  const queryClient = useQueryClient();
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (data: {
      flaresolverr_url: string;
      ygg_url: string;
      username: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<YggPluginUpdateResponse>(PLUGIN_ENDPOINTS.YGG, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.tracker('ygg') });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.trackerStats('ygg') });
    },
  });
}

export const useUpdateC411Plugin = () => useUpdateTrackerPlugin('c411');
export const useUpdateTorr9Plugin = () => useUpdateTrackerPlugin('torr9');
export const useUpdateG3miniPlugin = () => useUpdateTrackerPlugin('g3mini');
export const useUpdateLaCalePlugin = () => useUpdateTrackerPlugin('la-cale');

export const useDashboardC411Stats = (options?: { enabled?: boolean }) => useDashboardTrackerStats('c411', options);
export const useDashboardTorr9Stats = (options?: { enabled?: boolean }) => useDashboardTrackerStats('torr9', options);
export const useDashboardG3miniStats = (options?: { enabled?: boolean }) => useDashboardTrackerStats('g3mini', options);
export const useDashboardLaCaleStats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats('la-cale', options);

export function useHackernewsPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.hackernews(),
    queryFn: () => fetcher<{ plugin: HackernewsPlugin }>(PLUGIN_ENDPOINTS.HACKERNEWS),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useUpdateHackernewsPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { feed_type: string; story_count: number; enabled: boolean }) =>
      fetcher<HackernewsPluginUpdateResponse>(PLUGIN_ENDPOINTS.HACKERNEWS, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.hackernews() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.hackerNews() });
    },
  });
}

export function useRadarrProfiles() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (data: { website_url: string; api_key: string }) =>
      fetcher<{ quality_profiles: ArrProfile[] }>(PLUGIN_ENDPOINTS.RADARR_PROFILES, {
        method: 'POST',
        body: data,
      }),
  });
}

export function useSonarrProfiles() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (data: { website_url: string; api_key: string }) =>
      fetcher<{ quality_profiles: ArrProfile[]; language_profiles: ArrProfile[] }>(PLUGIN_ENDPOINTS.SONARR_PROFILES, {
        method: 'POST',
        body: data,
      }),
  });
}

export function useRedditPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.reddit(),
    queryFn: () => fetcher<{ plugin: RedditPlugin }>(PLUGIN_ENDPOINTS.REDDIT),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useUpdateRedditPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { subreddits: string[]; enabled: boolean }) =>
      fetcher<RedditPluginUpdateResponse>(PLUGIN_ENDPOINTS.REDDIT, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.reddit() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.reddit() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.redditInfinite() });
    },
  });
}

export function useSearchSubreddits(query: string) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: ['subreddit-search', query] as const,
    queryFn: () =>
      fetcher<{ results: RedditSubredditSearchResult[] }>(
        `${PLUGIN_ENDPOINTS.REDDIT_SEARCH}?q=${encodeURIComponent(query)}`
      ),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}
