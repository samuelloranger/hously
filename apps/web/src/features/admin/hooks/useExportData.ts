import { useMutation } from "@tanstack/react-query";
import { adminApi } from "../api";

export function useExportData() {
  return useMutation({
    mutationFn: () => adminApi.exportData(),
  });
}

