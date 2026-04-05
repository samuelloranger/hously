import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@hously/shared/endpoints";
import { useFetcher } from "@/lib/api/context";
import type { WeatherData } from "@hously/shared/types";
export function useDashboardWeather() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.weather.current(),
    queryFn: () => fetcher<WeatherData>(DASHBOARD_ENDPOINTS.WEATHER),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
