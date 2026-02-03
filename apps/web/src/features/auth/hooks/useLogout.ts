import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { authApi } from "../api";

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionEndpoint?: string) =>
      authApi.logout(subscriptionEndpoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      queryClient.clear();
    },
  });
}
