import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { WeatherIntegrationUpdateResponse } from "@hously/shared/types";

export function useUpdateWeatherIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      address: string;
      temperature_unit: "fahrenheit" | "celsius";
      enabled: boolean;
    }) =>
      fetcher<WeatherIntegrationUpdateResponse>(INTEGRATION_ENDPOINTS.WEATHER, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.weather(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather.current() });
    },
  });
}
