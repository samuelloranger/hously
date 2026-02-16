import { useCurrentUser } from '@hously/shared';

export function useAuth() {
  const { data: user, isLoading, error, refetch } = useCurrentUser();

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: user !== null && user !== undefined,
    error,
    refetch: async () => {
      const result = await refetch();
      return result.data;
    },
  };
}
