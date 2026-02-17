import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { DASHBOARD_ENDPOINTS } from '../endpoints';
import { useFetcher } from './context';
import type { WeatherData } from '../types';

export function useAddressWeather(address: string) {
  const fetcher = useFetcher();
  const trimmedAddress = address.trim();

  return useQuery({
    queryKey: queryKeys.weather.byAddress(trimmedAddress),
    queryFn: () =>
      fetcher<WeatherData>(`${DASHBOARD_ENDPOINTS.WEATHER}?address=${encodeURIComponent(trimmedAddress)}`),
    enabled: Boolean(trimmedAddress),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
