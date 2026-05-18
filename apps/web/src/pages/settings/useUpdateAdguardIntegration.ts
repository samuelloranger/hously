import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { AdguardIntegrationUpdateResponse } from "@hously/shared/types";

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
