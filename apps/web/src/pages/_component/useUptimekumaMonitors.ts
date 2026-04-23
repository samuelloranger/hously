import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { UptimekumaMonitorsResponse } from "@hously/shared/types";

export function useUptimekumaMonitors(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.uptimekumaMonitors(),
    queryFn: () =>
      fetcher<UptimekumaMonitorsResponse>(INTEGRATION_ENDPOINTS.UPTIMEKUMA_MONITORS),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
    retry: false,
  });
}
