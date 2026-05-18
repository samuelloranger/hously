import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { BeszelIntegrationUpdateResponse } from "@hously/shared/types";

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
