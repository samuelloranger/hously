import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { MinecraftCreateServerRequest, MinecraftServerEntry } from "@hously/shared/types";

export function useCreateMinecraftServer() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MinecraftCreateServerRequest) =>
      fetcher<{ success: boolean; server: MinecraftServerEntry }>(
        INTEGRATION_ENDPOINTS.MINECRAFT_SERVERS,
        { method: "POST", body },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.minecraft.servers(),
      });
    },
  });
}
