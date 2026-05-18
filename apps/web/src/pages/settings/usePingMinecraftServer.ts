import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { MinecraftServerEntry } from "@hously/shared/types";

export function usePingMinecraftServer() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher<{ success: boolean; server: MinecraftServerEntry }>(
        `${INTEGRATION_ENDPOINTS.MINECRAFT_SERVERS}/${id}/ping`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.minecraft.servers(),
      });
    },
  });
}
