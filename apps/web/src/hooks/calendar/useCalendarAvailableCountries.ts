import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CALENDAR_ENDPOINTS } from "@/lib/endpoints";
import type { CalendarAvailableCountriesResponse } from "@hously/shared/types";

export function useCalendarAvailableCountries() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.calendar.availableCountries(),
    queryFn: () =>
      fetcher<CalendarAvailableCountriesResponse>(
        CALENDAR_ENDPOINTS.AVAILABLE_COUNTRIES,
      ),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
