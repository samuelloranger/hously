import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type {
  DockerIntegrationUpdateResponse,
} from "@hously/shared/types";

interface UpdateDockerIntegrationPayload {
  enabled: boolean;
  socket_path: string;
  compose_project: string;
  icon_name_overrides: Record<string, string>;
}

export function useUpdateDockerIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateDockerIntegrationPayload) =>
      fetcher<DockerIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.DOCKER, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.docker(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.dockerSummary(),
      });
    },
  });
}
