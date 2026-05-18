import { useMutation } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { UploadChoreImageResponse } from "@hously/shared/types";

export function useUploadChoreImage() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (formData: FormData) =>
      fetcher<UploadChoreImageResponse>(CHORES_ENDPOINTS.UPLOAD_IMAGE, {
        method: "POST",
        body: formData,
      }),
  });
}
