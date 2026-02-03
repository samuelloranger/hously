import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api";

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
  });
}
