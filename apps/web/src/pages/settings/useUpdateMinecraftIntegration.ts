import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";

export function useUpdateMinecraftIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled: boolean }) =>
      fetcher<{ success: boolean }>(INTEGRATION_ENDPOINTS.MINECRAFT, {
        method: "PUT",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.minecraft.all,
      });
    },
  });
}
