import { useMutation } from "@tanstack/react-query";
import { adminApi } from "../api";

export function useTriggerAction() {
  return useMutation({
    mutationFn: (action: string) => adminApi.triggerAction(action),
  });
}

