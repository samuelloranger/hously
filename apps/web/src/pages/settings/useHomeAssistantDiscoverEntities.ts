import { useMutation } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { HomeAssistantDiscoverResponse } from "@hously/shared/types";

export function useHomeAssistantDiscoverEntities() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: () =>
      fetcher<HomeAssistantDiscoverResponse>(
        INTEGRATION_ENDPOINTS.HOME_ASSISTANT_ENTITIES,
      ),
  });
}
