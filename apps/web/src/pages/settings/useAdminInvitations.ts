import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { ADMIN_ENDPOINTS } from "@/lib/endpoints";
import type { ListInvitationsResponse } from "@hously/shared/types";

export function useAdminInvitations() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.admin.invitations(),
    queryFn: () =>
      fetcher<ListInvitationsResponse>(ADMIN_ENDPOINTS.INVITATIONS),
  });
}
