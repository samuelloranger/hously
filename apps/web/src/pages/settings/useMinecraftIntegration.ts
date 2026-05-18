import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { MinecraftIntegration } from "@hously/shared/types";

export function useMinecraftIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.minecraft.integration(),
    queryFn: () =>
      fetcher<{ integration: MinecraftIntegration }>(
        INTEGRATION_ENDPOINTS.MINECRAFT,
      ),
  });
}
