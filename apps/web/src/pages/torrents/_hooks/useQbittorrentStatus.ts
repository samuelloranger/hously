import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { QBITTORRENT_ENDPOINTS } from "@/lib/endpoints";
import type { DashboardQbittorrentStatusResponse } from "@hously/shared/types";
/** Global qBittorrent status (connection, summary speeds, counts). Same data as the dashboard card. */
export function useQbittorrentStatus() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.qbittorrent.status(),
    queryFn: () =>
      fetcher<DashboardQbittorrentStatusResponse>(QBITTORRENT_ENDPOINTS.STATUS),
  });
}
