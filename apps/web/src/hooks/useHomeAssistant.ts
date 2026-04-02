import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_ENDPOINTS } from '@hously/shared';
import { queryKeys } from '@/lib/queryKeys';
import type { HomeAssistantWidgetResponse } from '@hously/shared';
import { useFetcher } from '@/lib/api/context';

export function useHomeAssistantWidget(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.dashboard.homeAssistantWidget(),
    queryFn: () => fetcher<HomeAssistantWidgetResponse>(DASHBOARD_ENDPOINTS.HOME_ASSISTANT.WIDGET),
    staleTime: 15_000,
    refetchInterval: 25_000,
    enabled: options?.enabled ?? true,
  });
}

export function useHomeAssistantControl() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { entity_id: string; action: 'on' | 'off' | 'toggle' }) =>
      fetcher<{ success: boolean }>(DASHBOARD_ENDPOINTS.HOME_ASSISTANT.CONTROL, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.homeAssistantWidget() });
    },
  });
}
