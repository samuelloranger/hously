import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CALENDAR_ENDPOINTS } from "@hously/shared/endpoints";
import type { CalendarEventsResponse, CustomEvent, CreateCustomEventRequest, UpdateCustomEventRequest, ICalTokenResponse, ICalTokenGenerateResponse } from "@hously/shared/types";
export function useCalendarEvents(year?: number, month?: number) {
  const fetcher = useFetcher();

  const params = new URLSearchParams();
  if (year) params.append("year", year.toString());
  if (month) params.append("month", month.toString());
  const queryString = params.toString();

  return useQuery({
    queryKey: queryKeys.calendar.events(year, month),
    queryFn: async () => {
      const response = await fetcher<CalendarEventsResponse>(
        `${CALENDAR_ENDPOINTS.EVENTS}${queryString ? `?${queryString}` : ""}`,
      );
      return response.events;
    },
  });
}

export function useCreateCustomEvent() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomEventRequest) =>
      fetcher<CustomEvent>(CALENDAR_ENDPOINTS.CUSTOM_EVENTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateCustomEvent() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateCustomEventRequest;
    }) =>
      fetcher<CustomEvent>(CALENDAR_ENDPOINTS.CUSTOM_EVENTS.UPDATE(id), {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
    },
  });
}

export function useDeleteCustomEvent() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<void>(CALENDAR_ENDPOINTS.CUSTOM_EVENTS.DELETE(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useICalToken() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.calendar.icalToken(),
    queryFn: () => fetcher<ICalTokenResponse>(CALENDAR_ENDPOINTS.ICAL_TOKEN),
  });
}

export function useGenerateICalToken() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<ICalTokenGenerateResponse>(CALENDAR_ENDPOINTS.ICAL_TOKEN, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.icalToken(),
      });
    },
  });
}

export function useRevokeICalToken() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<void>(CALENDAR_ENDPOINTS.ICAL_TOKEN, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.icalToken(),
      });
    },
  });
}
