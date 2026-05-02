import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CALENDAR_ENDPOINTS } from "@/lib/endpoints";
import type { CalendarHolidaySubdivisionsResponse } from "@hously/shared/types";

export function useHolidaySubdivisions(countryCode: string | undefined) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.calendar.holidaySubdivisions(countryCode),
    queryFn: () =>
      fetcher<CalendarHolidaySubdivisionsResponse>(
        CALENDAR_ENDPOINTS.HOLIDAY_SUBDIVISIONS(countryCode!),
      ),
    enabled: Boolean(countryCode && /^[A-Za-z]{2}$/.test(countryCode)),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
