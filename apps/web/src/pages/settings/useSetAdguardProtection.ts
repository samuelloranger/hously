import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { AdguardProtectionUpdateResponse } from "@hously/shared/types";

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
