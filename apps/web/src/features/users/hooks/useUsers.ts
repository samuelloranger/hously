import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { usersApi } from "../api";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: usersApi.getUsers,
    refetchOnMount: true,
  });
}
