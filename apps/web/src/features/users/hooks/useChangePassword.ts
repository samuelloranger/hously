import { useMutation } from "@tanstack/react-query";
import { usersApi, type ChangePasswordRequest } from "../api";

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => usersApi.changePassword(data),
  });
}
