import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { authApi } from "../api";
import type { User } from "../../../types";

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      try {
        const response = await authApi.getCurrentUser();
        return response.user;
      } catch (error: any) {
        // If 401, user is not authenticated - return null, don't throw
        if (error?.status === 401) {
          return null;
        }
        // For other errors, still return null but log
        console.error("Auth error:", error);
        return null;
      }
    },
    retry: false,
    staleTime: 0, // Always consider auth data stale - must refetch from server
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount
    refetchOnReconnect: true, // Refetch when reconnecting to network
  });
}
