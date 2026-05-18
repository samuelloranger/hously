import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { MinecraftServerEntry, MinecraftUpdateServerRequest } from "@hously/shared/types";

export function useUpdateMinecraftServer() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: MinecraftUpdateServerRequest;
    }) =>
      fetcher<{ success: boolean; server: MinecraftServerEntry }>(
        `${INTEGRATION_ENDPOINTS.MINECRAFT_SERVERS}/${id}`,
        { method: "PUT", body },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.minecraft.servers(),
      });
    },
  });
}
