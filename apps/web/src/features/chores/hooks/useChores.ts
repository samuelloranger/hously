import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { choresApi } from "../api";

export function useChores() {
  return useQuery({
    queryKey: queryKeys.chores.list(),
    queryFn: choresApi.getChores,
  });
}
