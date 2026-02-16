import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys, CALENDAR_ENDPOINTS } from '../index';
import type {
  CalendarEventsResponse,
  CustomEventsResponse,
  CustomEvent,
  CreateCustomEventRequest,
  UpdateCustomEventRequest,
} from '../types';

export function useCalendarEvents(year?: number, month?: number) {
  const fetcher = useFetcher();

  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  if (month) params.append('month', month.toString());
  const queryString = params.toString();

  return useQuery({
    queryKey: queryKeys.calendar.events(year, month),
    queryFn: async () => {
      const response = await fetcher<CalendarEventsResponse>(
        `${CALENDAR_ENDPOINTS.EVENTS}${queryString ? `?${queryString}` : ''}`
      );
      return response.events;
    },
  });
}

export function useCustomEvents(year?: number, month?: number) {
  const fetcher = useFetcher();

  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  if (month) params.append('month', month.toString());
  const queryString = params.toString();

  return useQuery({
    queryKey: queryKeys.customEvents.list(year, month),
    queryFn: async () => {
      const response = await fetcher<CustomEventsResponse>(
        `${CALENDAR_ENDPOINTS.CUSTOM_EVENTS.LIST}${queryString ? `?${queryString}` : ''}`
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
        method: 'POST',
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
    mutationFn: ({ id, data }: { id: number; data: UpdateCustomEventRequest }) =>
      fetcher<CustomEvent>(CALENDAR_ENDPOINTS.CUSTOM_EVENTS.UPDATE(id), {
        method: 'PUT',
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
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customEvents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
