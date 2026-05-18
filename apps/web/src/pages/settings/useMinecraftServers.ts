import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { MinecraftServerEntry } from "@hously/shared/types";

export function useMinecraftServers() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.minecraft.servers(),
    queryFn: () =>
      fetcher<{ servers: MinecraftServerEntry[] }>(
        INTEGRATION_ENDPOINTS.MINECRAFT_SERVERS,
      ),
  });
}
