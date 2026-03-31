import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { DASHBOARD_ENDPOINTS, PLUGIN_ENDPOINTS } from '../endpoints';
import type {
  AdguardPlugin,
  AdguardProtectionUpdateResponse,
  AdguardPluginUpdateResponse,
  ArrProfile,
  DashboardTrackerStatsResponse,
  DashboardTrackersStatsResponse,
  JellyfinPlugin,
  JellyfinPluginUpdateResponse,
  BeszelPlugin,
  BeszelPluginUpdateResponse,
  ProwlarrPlugin,
  ProwlarrPluginUpdateResponse,
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
  ClockifyPlugin,
  ClockifyPluginUpdateResponse,
  TrackerPlugin,
  TrackerPluginUpdateResponse,
  TrackerType,
  WeatherPlugin,
  WeatherPluginUpdateResponse,
} from '../types';

const TRACKER_PLUGIN_ENDPOINTS: Record<TrackerType, string> = {
  c411: PLUGIN_ENDPOINTS.C411,
  torr9: PLUGIN_ENDPOINTS.TORR9,
  'la-cale': PLUGIN_ENDPOINTS.LA_CALE,
};

const getDashboardTrackersStatsQuery = (fetcher: ReturnType<typeof useFetcher>, enabled = true) => ({
  queryKey: queryKeys.dashboard.trackersStats(),
  queryFn: () => fetcher<DashboardTrackersStatsResponse>(DASHBOARD_ENDPOINTS.TRACKERS.STATS),
  enabled,
  staleTime: 60 * 60 * 1000,
});

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
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.trackersStats() });
    },
  });
}

export function useDashboardTrackersStats(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery(getDashboardTrackersStatsQuery(fetcher, options?.enabled ?? true));
}

export function useDashboardTrackerStats(type: TrackerType, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    ...getDashboardTrackersStatsQuery(fetcher, options?.enabled ?? true),
    select: data => data[type] satisfies DashboardTrackerStatsResponse,
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

export function useProwlarrPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.prowlarr(),
    queryFn: () => fetcher<{ plugin: ProwlarrPlugin }>(PLUGIN_ENDPOINTS.PROWLARR),
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

export function useBeszelPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.beszel(),
    queryFn: () => fetcher<{ plugin: BeszelPlugin }>(PLUGIN_ENDPOINTS.BESZEL),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useAdguardPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.adguard(),
    queryFn: () => fetcher<{ plugin: AdguardPlugin }>(PLUGIN_ENDPOINTS.ADGUARD),
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

export function useClockifyPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.clockify(),
    queryFn: () => fetcher<{ plugin: ClockifyPlugin }>(PLUGIN_ENDPOINTS.CLOCKIFY),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export const useC411Plugin = () => useTrackerPlugin('c411');
export const useTorr9Plugin = () => useTrackerPlugin('torr9');
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

export function useUpdateProwlarrPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; api_key: string; enabled: boolean }) =>
      fetcher<ProwlarrPluginUpdateResponse>(PLUGIN_ENDPOINTS.PROWLARR, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.prowlarr() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.qbittorrent.status() });
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

export function useUpdateBeszelPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; email: string; password?: string; enabled: boolean }) =>
      fetcher<BeszelPluginUpdateResponse>(PLUGIN_ENDPOINTS.BESZEL, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.beszel() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.beszelSummary() });
    },
  });
}

export function useUpdateAdguardPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; username: string; password?: string; enabled: boolean }) =>
      fetcher<AdguardPluginUpdateResponse>(PLUGIN_ENDPOINTS.ADGUARD, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.adguard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.adguardSummary() });
    },
  });
}

export function useSetAdguardProtection() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled: boolean }) =>
      fetcher<AdguardProtectionUpdateResponse>(PLUGIN_ENDPOINTS.ADGUARD_PROTECTION, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.adguard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.adguardSummary() });
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
    mutationFn: (data: { api_key: string; enabled: boolean; popularity_threshold?: number }) =>
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

export function useUpdateClockifyPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { api_key: string; enabled: boolean; workspace_id: string; user_id: string; }) =>
      fetcher<ClockifyPluginUpdateResponse>(PLUGIN_ENDPOINTS.CLOCKIFY, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.clockify() });
    },
  });
}

export const useUpdateC411Plugin = () => useUpdateTrackerPlugin('c411');
export const useUpdateTorr9Plugin = () => useUpdateTrackerPlugin('torr9');
export const useUpdateLaCalePlugin = () => useUpdateTrackerPlugin('la-cale');

export const useDashboardC411Stats = (options?: { enabled?: boolean }) => useDashboardTrackerStats('c411', options);
export const useDashboardTorr9Stats = (options?: { enabled?: boolean }) => useDashboardTrackerStats('torr9', options);
export const useDashboardLaCaleStats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats('la-cale', options);

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
