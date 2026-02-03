import { useMutation, useQuery } from "@tanstack/react-query";
import { adminApi } from "../api";

export function useTestEmail() {
  return useMutation({
    mutationFn: (templateId?: string) => adminApi.testEmail(templateId),
  });
}

export function useTestEmailTemplates() {
  return useQuery({
    queryKey: ["admin", "test-email-templates"],
    queryFn: () => adminApi.getTestEmailTemplates(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

