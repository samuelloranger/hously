import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@hously/shared/endpoints";
import { useFetcher } from "@/lib/api/context";
import type { WeatherData, WeatherForecastData } from "@hously/shared/types";

export function useDashboardWeather() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.weather.current(),
    queryFn: () => fetcher<WeatherData>(DASHBOARD_ENDPOINTS.WEATHER),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useDashboardWeatherForecast(enabled: boolean) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.weather.forecast(),
    queryFn: () =>
      fetcher<WeatherForecastData>(DASHBOARD_ENDPOINTS.WEATHER_FORECAST),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    enabled,
  });
}
