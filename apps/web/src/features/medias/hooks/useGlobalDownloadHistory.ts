import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { LIBRARY_ENDPOINTS } from "@/lib/endpoints";
import type { GlobalDownloadHistoryResponse } from "@hously/shared/types";

export function useGlobalDownloadHistory(params?: {
  page?: number;
  status?: string;
  days?: number;
}) {
  const fetcher = useFetcher();
  const search = new URLSearchParams();
  if (params?.page && params.page > 1) search.set("page", String(params.page));
  if (params?.status && params.status !== "all")
    search.set("status", params.status);
  if (params?.days && params.days > 0) search.set("days", String(params.days));
  const qs = search.toString();
  const url = qs
    ? `${LIBRARY_ENDPOINTS.DOWNLOAD_HISTORY}?${qs}`
    : LIBRARY_ENDPOINTS.DOWNLOAD_HISTORY;

  return useQuery({
    queryKey: queryKeys.library.downloadHistory(params),
    queryFn: () => fetcher<GlobalDownloadHistoryResponse>(url),
    placeholderData: keepPreviousData,
  });
}
