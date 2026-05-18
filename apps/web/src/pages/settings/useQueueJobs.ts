import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { ADMIN_ENDPOINTS } from "@/lib/endpoints";
import type { QueueJob } from "@hously/shared/types";

export function useQueueJobs(queue: string, status?: string) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.queueJobs(queue, status),
    queryFn: () => {
      const url = status
        ? `${ADMIN_ENDPOINTS.QUEUE_JOBS(queue)}?status=${status}`
        : ADMIN_ENDPOINTS.QUEUE_JOBS(queue);
      return fetcher<QueueJob[]>(url);
    },
    enabled: false,
  });
}
