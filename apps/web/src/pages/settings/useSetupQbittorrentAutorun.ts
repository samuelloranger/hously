import { useMutation } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";

type AutorunSetupResponse = {
  success: boolean;
  hously_url: string;
};

export function useSetupQbittorrentAutorun() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (body?: { hously_url?: string }) =>
      fetcher<AutorunSetupResponse>(
        `${INTEGRATION_ENDPOINTS.QBITTORRENT}/autorun-setup`,
        {
          method: "POST",
          body: body ?? {},
        },
      ),
  });
}
