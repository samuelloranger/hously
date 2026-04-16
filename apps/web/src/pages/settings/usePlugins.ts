import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS, PLUGIN_ENDPOINTS } from "@/lib/endpoints";
import type {
  AdguardPlugin,
  AdguardProtectionUpdateResponse,
  AdguardPluginUpdateResponse,
  DashboardTrackerStatsResponse,
  DashboardTrackersStatsResponse,
  JellyfinPlugin,
  JellyfinPluginUpdateResponse,
  BeszelPlugin,
  BeszelPluginUpdateResponse,
  ProwlarrPlugin,
  ProwlarrPluginUpdateResponse,
  JackettPlugin,
  JackettPluginUpdateResponse,
  QbittorrentPlugin,
  QbittorrentPluginUpdateResponse,
  ScrutinyPlugin,
  ScrutinyPluginUpdateResponse,
  TmdbPlugin,
  TmdbPluginUpdateResponse,
  TrackerPlugin,
  TrackerPluginUpdateResponse,
  TrackerType,
  WeatherPlugin,
  WeatherPluginUpdateResponse,
  HomeAssistantPlugin,
  HomeAssistantPluginUpdateResponse,
  UptimekumaPlugin,
  UptimekumaPluginUpdateResponse,
  HomeAssistantDiscoverResponse,
} from "@hously/shared/types";
const TRACKER_PLUGIN_ENDPOINTS: Record<TrackerType, string> = {
  c411: PLUGIN_ENDPOINTS.C411,
  torr9: PLUGIN_ENDPOINTS.TORR9,
  "la-cale": PLUGIN_ENDPOINTS.LA_CALE,
};

const getDashboardTrackersStatsQuery = (
  fetcher: ReturnType<typeof useFetcher>,
  enabled = true,
) => ({
  queryKey: queryKeys.dashboard.trackersStats(),
  queryFn: () =>
    fetcher<DashboardTrackersStatsResponse>(DASHBOARD_ENDPOINTS.TRACKERS.STATS),
  enabled,
  staleTime: 60 * 60 * 1000,
});

function useTrackerPlugin<T extends TrackerType>(type: T) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.tracker(type),
    queryFn: () =>
      fetcher<{ plugin: TrackerPlugin & { type: T } }>(
        TRACKER_PLUGIN_ENDPOINTS[type],
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

function useUpdateTrackerPlugin(type: TrackerType) {
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
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.tracker(type),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.trackersStats(),
      });
    },
  });
}

function useDashboardTrackerStats(
  type: TrackerType,
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  return useQuery({
    ...getDashboardTrackersStatsQuery(fetcher, options?.enabled ?? true),
    select: (data) => data[type] satisfies DashboardTrackerStatsResponse,
  });
}

export function useJellyfinPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.jellyfin(),
    queryFn: () =>
      fetcher<{ plugin: JellyfinPlugin }>(PLUGIN_ENDPOINTS.JELLYFIN),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useProwlarrPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.prowlarr(),
    queryFn: () =>
      fetcher<{ plugin: ProwlarrPlugin }>(PLUGIN_ENDPOINTS.PROWLARR),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useJackettPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.jackett(),
    queryFn: () => fetcher<{ plugin: JackettPlugin }>(PLUGIN_ENDPOINTS.JACKETT),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useQbittorrentPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.qbittorrent(),
    queryFn: () =>
      fetcher<{ plugin: QbittorrentPlugin }>(PLUGIN_ENDPOINTS.QBITTORRENT),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useScrutinyPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.scrutiny(),
    queryFn: () =>
      fetcher<{ plugin: ScrutinyPlugin }>(PLUGIN_ENDPOINTS.SCRUTINY),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useBeszelPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.beszel(),
    queryFn: () => fetcher<{ plugin: BeszelPlugin }>(PLUGIN_ENDPOINTS.BESZEL),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useAdguardPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.adguard(),
    queryFn: () => fetcher<{ plugin: AdguardPlugin }>(PLUGIN_ENDPOINTS.ADGUARD),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useWeatherPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.weather(),
    queryFn: () => fetcher<{ plugin: WeatherPlugin }>(PLUGIN_ENDPOINTS.WEATHER),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useHomeAssistantPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.homeAssistant(),
    queryFn: () =>
      fetcher<{ plugin: HomeAssistantPlugin }>(PLUGIN_ENDPOINTS.HOME_ASSISTANT),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useUpdateHomeAssistantPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      base_url: string;
      access_token: string;
      enabled_entity_ids: string[];
      enabled: boolean;
    }) =>
      fetcher<HomeAssistantPluginUpdateResponse>(
        PLUGIN_ENDPOINTS.HOME_ASSISTANT,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.homeAssistant(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.homeAssistantWidget(),
      });
    },
  });
}

export function useHomeAssistantDiscoverEntities() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: () =>
      fetcher<HomeAssistantDiscoverResponse>(
        PLUGIN_ENDPOINTS.HOME_ASSISTANT_ENTITIES,
      ),
  });
}

export function useTmdbPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.tmdb(),
    queryFn: () => fetcher<{ plugin: TmdbPlugin }>(PLUGIN_ENDPOINTS.TMDB),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export const useC411Plugin = () => useTrackerPlugin("c411");
export const useTorr9Plugin = () => useTrackerPlugin("torr9");
export const useLaCalePlugin = () => useTrackerPlugin("la-cale");

export function useUpdateJellyfinPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<JellyfinPluginUpdateResponse>(PLUGIN_ENDPOINTS.JELLYFIN, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.jellyfin() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.jellyfinLatest(),
      });
    },
  });
}

export function useUpdateProwlarrPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<ProwlarrPluginUpdateResponse>(PLUGIN_ENDPOINTS.PROWLARR, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.prowlarr() });
    },
  });
}

export function useUpdateJackettPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<JackettPluginUpdateResponse>(PLUGIN_ENDPOINTS.JACKETT, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.jackett() });
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
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.qbittorrent(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.qbittorrent.status(),
      });
    },
  });
}

export function useUpdateScrutinyPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; enabled: boolean }) =>
      fetcher<ScrutinyPluginUpdateResponse>(PLUGIN_ENDPOINTS.SCRUTINY, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.scrutiny() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.scrutinySummary(),
      });
    },
  });
}

export function useUpdateBeszelPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      email: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<BeszelPluginUpdateResponse>(PLUGIN_ENDPOINTS.BESZEL, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.beszel() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.systemSummary(),
      });
    },
  });
}

export function useUpdateAdguardPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      username: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<AdguardPluginUpdateResponse>(PLUGIN_ENDPOINTS.ADGUARD, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.adguard() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.adguardSummary(),
      });
    },
  });
}

export function useSetAdguardProtection() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled: boolean }) =>
      fetcher<AdguardProtectionUpdateResponse>(
        PLUGIN_ENDPOINTS.ADGUARD_PROTECTION,
        {
          method: "POST",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.adguard() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.adguardSummary(),
      });
    },
  });
}

export function useUpdateWeatherPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      address: string;
      temperature_unit: "fahrenheit" | "celsius";
      enabled: boolean;
    }) =>
      fetcher<WeatherPluginUpdateResponse>(PLUGIN_ENDPOINTS.WEATHER, {
        method: "PUT",
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
    mutationFn: (data: {
      api_key: string;
      enabled: boolean;
      popularity_threshold?: number;
    }) =>
      fetcher<TmdbPluginUpdateResponse>(PLUGIN_ENDPOINTS.TMDB, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.tmdb() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.upcoming(),
      });
    },
  });
}

export const useUpdateC411Plugin = () => useUpdateTrackerPlugin("c411");
export const useUpdateTorr9Plugin = () => useUpdateTrackerPlugin("torr9");
export const useUpdateLaCalePlugin = () => useUpdateTrackerPlugin("la-cale");

export const useDashboardC411Stats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("c411", options);
export const useDashboardTorr9Stats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("torr9", options);
export const useDashboardLaCaleStats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("la-cale", options);

export function useUptimekumaPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.uptimekuma(),
    queryFn: () =>
      fetcher<{ plugin: UptimekumaPlugin }>(PLUGIN_ENDPOINTS.UPTIMEKUMA),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useUpdateUptimekumaPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key?: string;
      enabled: boolean;
    }) =>
      fetcher<UptimekumaPluginUpdateResponse>(PLUGIN_ENDPOINTS.UPTIMEKUMA, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.uptimekuma(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.plugins.uptimekumaMonitors(),
      });
    },
  });
}
