import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { DockerIntegration } from "@hously/shared/types";

export function useDockerIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.docker(),
    queryFn: () =>
      fetcher<{ integration: DockerIntegration }>(INTEGRATION_ENDPOINTS.DOCKER),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
