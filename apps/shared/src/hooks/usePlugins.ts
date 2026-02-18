import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { PLUGIN_ENDPOINTS } from '../endpoints';
import type {
  ArrProfile,
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
  WeatherPlugin,
  WeatherPluginUpdateResponse,
  YggPlugin,
  YggPluginUpdateResponse,
} from '../types';

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

export function useYggPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.ygg(),
    queryFn: () => fetcher<{ plugin: YggPlugin }>(PLUGIN_ENDPOINTS.YGG),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useUpdateJellyfinPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; api_key: string; enabled: boolean }) =>
      fetcher<JellyfinPluginUpdateResponse>(PLUGIN_ENDPOINTS.JELLYFIN, {
        method: 'PUT',
        body: data,
      }),
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.jellyfin(), { plugin: result.plugin });
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.radarr(), { plugin: result.plugin });
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.sonarr(), { plugin: result.plugin });
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.qbittorrent(), { plugin: result.plugin });
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.scrutiny(), { plugin: result.plugin });
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.netdata(), { plugin: result.plugin });
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.weather(), { plugin: result.plugin });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.weather() });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.current() });
    },
  });
}

export function useUpdateYggPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
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
    onSuccess: result => {
      queryClient.setQueryData(queryKeys.plugins.ygg(), { plugin: result.plugin });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.ygg() });
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
