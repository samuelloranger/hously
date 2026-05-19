import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { QuickLinksResponse, QuickLink } from "@hously/shared/types";

export function useQuickLinks() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.dashboard.quickLinks(),
    queryFn: () => fetcher<QuickLinksResponse>(DASHBOARD_ENDPOINTS.QUICK_LINKS),
    staleTime: 60_000,
  });
}

export function useUpdateQuickLinks() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quick_links: QuickLink[]) =>
      fetcher<QuickLinksResponse>(DASHBOARD_ENDPOINTS.QUICK_LINKS, {
        method: "PUT",
        body: JSON.stringify({ quick_links }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.dashboard.quickLinks(), data);
    },
  });
}
