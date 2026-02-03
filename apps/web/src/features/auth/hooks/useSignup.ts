import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { authApi } from "../api";

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      email,
      password,
      first_name,
      last_name,
    }: {
      email: string;
      password: string;
      first_name?: string;
      last_name?: string;
    }) => authApi.signup(email, password, first_name, last_name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}
