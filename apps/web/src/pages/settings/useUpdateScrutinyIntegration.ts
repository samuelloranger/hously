import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { ScrutinyIntegrationUpdateResponse } from "@hously/shared/types";

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
