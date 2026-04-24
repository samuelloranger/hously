import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS, INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type {
  AdguardIntegration,
  AdguardProtectionUpdateResponse,
  AdguardIntegrationUpdateResponse,
  DashboardTrackerStatsResponse,
  DashboardTrackersStatsResponse,
  JellyfinIntegration,
  JellyfinIntegrationUpdateResponse,
  BeszelIntegration,
  BeszelIntegrationUpdateResponse,
  ProwlarrIntegration,
  ProwlarrIntegrationUpdateResponse,
  JackettIntegration,
  JackettIntegrationUpdateResponse,
  QbittorrentIntegration,
  QbittorrentIntegrationUpdateResponse,
  ScrutinyIntegration,
  ScrutinyIntegrationUpdateResponse,
  TmdbIntegration,
  TmdbIntegrationUpdateResponse,
  TrackerIntegration,
  TrackerIntegrationUpdateResponse,
  TrackerType,
  WeatherIntegration,
  WeatherIntegrationUpdateResponse,
  HomeAssistantIntegration,
  HomeAssistantIntegrationUpdateResponse,
  UptimekumaIntegration,
  UptimekumaIntegrationUpdateResponse,
  HomeAssistantDiscoverResponse,
} from "@hously/shared/types";
const TRACKER_INTEGRATION_ENDPOINTS: Record<TrackerType, string> = {
  c411: INTEGRATION_ENDPOINTS.C411,
  torr9: INTEGRATION_ENDPOINTS.TORR9,
  "la-cale": INTEGRATION_ENDPOINTS.LA_CALE,
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

function useTrackerIntegration<T extends TrackerType>(type: T) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.tracker(type),
    queryFn: () =>
      fetcher<{ integration: TrackerIntegration & { type: T } }>(
        TRACKER_INTEGRATION_ENDPOINTS[type],
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

function useUpdateTrackerIntegration(type: TrackerType) {
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
      fetcher<TrackerIntegrationUpdateResponse>(
        TRACKER_INTEGRATION_ENDPOINTS[type],
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.tracker(type),
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

export function useJellyfinIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.jellyfin(),
    queryFn: () =>
      fetcher<{ integration: JellyfinIntegration }>(
        INTEGRATION_ENDPOINTS.JELLYFIN,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useProwlarrIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.prowlarr(),
    queryFn: () =>
      fetcher<{ integration: ProwlarrIntegration }>(
        INTEGRATION_ENDPOINTS.PROWLARR,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useJackettIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.jackett(),
    queryFn: () =>
      fetcher<{ integration: JackettIntegration }>(
        INTEGRATION_ENDPOINTS.JACKETT,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useQbittorrentIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.qbittorrent(),
    queryFn: () =>
      fetcher<{ integration: QbittorrentIntegration }>(
        INTEGRATION_ENDPOINTS.QBITTORRENT,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useScrutinyIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.scrutiny(),
    queryFn: () =>
      fetcher<{ integration: ScrutinyIntegration }>(
        INTEGRATION_ENDPOINTS.SCRUTINY,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useBeszelIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.beszel(),
    queryFn: () =>
      fetcher<{ integration: BeszelIntegration }>(INTEGRATION_ENDPOINTS.BESZEL),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useAdguardIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.adguard(),
    queryFn: () =>
      fetcher<{ integration: AdguardIntegration }>(
        INTEGRATION_ENDPOINTS.ADGUARD,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useWeatherIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.weather(),
    queryFn: () =>
      fetcher<{ integration: WeatherIntegration }>(
        INTEGRATION_ENDPOINTS.WEATHER,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useHomeAssistantIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.homeAssistant(),
    queryFn: () =>
      fetcher<{ integration: HomeAssistantIntegration }>(
        INTEGRATION_ENDPOINTS.HOME_ASSISTANT,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useUpdateHomeAssistantIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      base_url: string;
      access_token: string;
      enabled_entity_ids: string[];
      enabled: boolean;
    }) =>
      fetcher<HomeAssistantIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.HOME_ASSISTANT,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.homeAssistant(),
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
        INTEGRATION_ENDPOINTS.HOME_ASSISTANT_ENTITIES,
      ),
  });
}

export function useTmdbIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.tmdb(),
    queryFn: () =>
      fetcher<{ integration: TmdbIntegration }>(INTEGRATION_ENDPOINTS.TMDB),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export const useC411Integration = () => useTrackerIntegration("c411");
export const useTorr9Integration = () => useTrackerIntegration("torr9");
export const useLaCaleIntegration = () => useTrackerIntegration("la-cale");

export function useUpdateJellyfinIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<JellyfinIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.JELLYFIN,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.jellyfin(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.jellyfinLatest(),
      });
    },
  });
}

export function useUpdateProwlarrIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<ProwlarrIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.PROWLARR,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.prowlarr(),
      });
    },
  });
}

export function useUpdateJackettIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<JackettIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.JACKETT, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.jackett(),
      });
    },
  });
}

export function useUpdateQbittorrentIntegration() {
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
      fetcher<QbittorrentIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.QBITTORRENT,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.qbittorrent(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.qbittorrent.status(),
      });
    },
  });
}

export function useUpdateScrutinyIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { website_url: string; enabled: boolean }) =>
      fetcher<ScrutinyIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.SCRUTINY,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.scrutiny(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.scrutinySummary(),
      });
    },
  });
}

export function useUpdateBeszelIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      email: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<BeszelIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.BESZEL, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.beszel(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.systemSummary(),
      });
    },
  });
}

export function useUpdateAdguardIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      username: string;
      password?: string;
      enabled: boolean;
    }) =>
      fetcher<AdguardIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.ADGUARD, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.adguard(),
      });
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
        INTEGRATION_ENDPOINTS.ADGUARD_PROTECTION,
        {
          method: "POST",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.adguard(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.adguardSummary(),
      });
    },
  });
}

export function useUpdateWeatherIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      address: string;
      temperature_unit: "fahrenheit" | "celsius";
      enabled: boolean;
    }) =>
      fetcher<WeatherIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.WEATHER, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.weather(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.current() });
    },
  });
}

export function useUpdateTmdbIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      api_key: string;
      enabled: boolean;
      popularity_threshold?: number;
    }) =>
      fetcher<TmdbIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.TMDB, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.tmdb(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.upcoming(),
      });
    },
  });
}

export const useUpdateC411Integration = () =>
  useUpdateTrackerIntegration("c411");
export const useUpdateTorr9Integration = () =>
  useUpdateTrackerIntegration("torr9");
export const useUpdateLaCaleIntegration = () =>
  useUpdateTrackerIntegration("la-cale");

export const useDashboardC411Stats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("c411", options);
export const useDashboardTorr9Stats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("torr9", options);
export const useDashboardLaCaleStats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("la-cale", options);

export function useUptimekumaIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.uptimekuma(),
    queryFn: () =>
      fetcher<{ integration: UptimekumaIntegration }>(
        INTEGRATION_ENDPOINTS.UPTIMEKUMA,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useUpdateUptimekumaIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key?: string;
      enabled: boolean;
    }) =>
      fetcher<UptimekumaIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.UPTIMEKUMA,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.uptimekuma(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.uptimekumaMonitors(),
      });
    },
  });
}
