import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../api";

export function useScheduledJobs() {
  return useQuery({
    queryKey: ["admin", "scheduled-jobs"],
    queryFn: () => adminApi.getScheduledJobs(),
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: true,
  });
}

