import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../api";

export function useUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminApi.getUsers(),
  });
}

