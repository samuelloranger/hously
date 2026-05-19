import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { MinecraftDashboardResponse } from "@hously/shared/types";

export function useMinecraftWidget() {
  const fetcher = useFetcher();
  const query = useQuery({
    queryKey: queryKeys.dashboard.minecraft(),
    queryFn: () =>
      fetcher<MinecraftDashboardResponse>(DASHBOARD_ENDPOINTS.MINECRAFT),
    refetchInterval: 60_000,
  });

  return {
    ...query,
    servers: query.data?.servers ?? [],
  };
}
