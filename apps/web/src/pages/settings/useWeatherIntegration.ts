import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { WeatherIntegration } from "@hously/shared/types";

export function useWeatherIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.weather(),
    queryFn: () =>
      fetcher<{ integration: WeatherIntegration }>(
        INTEGRATION_ENDPOINTS.WEATHER,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
