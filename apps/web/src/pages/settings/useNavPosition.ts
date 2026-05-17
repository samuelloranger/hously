import { useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { USERS_ENDPOINTS } from "@/lib/endpoints";
import type { NavPosition, User, UserResponse } from "@hously/shared/types";

export function useNavPosition() {
  const queryClient = useQueryClient();
  const fetcher = useFetcher();

  const user = queryClient.getQueryData<User | null>(queryKeys.auth.me);
  const position: NavPosition = (user?.nav_position as NavPosition) ?? "left";

  function setPosition(next: NavPosition) {
    // Optimistic update
    queryClient.setQueryData<User | null>(queryKeys.auth.me, (prev) =>
      prev ? { ...prev, nav_position: next } : prev,
    );

    fetcher<UserResponse>(USERS_ENDPOINTS.ME, {
      method: "PUT",
      body: { nav_position: next },
    }).finally(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    });
  }

  return { position, setPosition };
}
