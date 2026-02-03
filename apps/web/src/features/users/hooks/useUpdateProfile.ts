import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { usersApi, type UpdateProfileRequest } from "../api";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => usersApi.updateProfile(data),
    onSuccess: (response) => {
      // Invalidate and refetch auth queries to update user data everywhere
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
      queryClient.setQueryData(queryKeys.auth.me, response.user);
    },
  });
}
