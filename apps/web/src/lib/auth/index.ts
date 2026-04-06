import { AUTH_ENDPOINTS } from "@hously/shared/endpoints";
import type { User } from "@hously/shared/types";
import { getQueryClient, invalidateAuthCache } from "@/lib/api/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { webFetcher } from "@/lib/api/fetcher";
import { ApiError } from "@/lib/api/client";
import { toast } from "sonner";

let currentUser: User | null = null;
let userPromise: Promise<User | null> | null = null;

export async function getCurrentUser(): Promise<User | null> {
  if (currentUser) {
    // Always re-seed the TQ cache on the fast path so components that mount
    // after navigation always find data and never flash a loading state.
    getQueryClient()?.setQueryData(queryKeys.auth.me, currentUser);
    return currentUser;
  }

  if (userPromise) {
    return userPromise;
  }

  userPromise = (async () => {
    try {
      const response = await webFetcher<{ user: User | null }>(
        AUTH_ENDPOINTS.ME,
      );
      currentUser = response.user;
      // Seed the React Query cache so useCurrentUser() picks up the data
      // without needing its own fetch — prevents the "user not loaded" state
      getQueryClient()?.setQueryData(queryKeys.auth.me, currentUser);
      return currentUser;
    } catch (error: any) {
      // If 401, user is not authenticated - clear cache
      if (error instanceof ApiError && error.status === 401) {
        currentUser = null;
        userPromise = null;
        // Invalidate React Query cache to ensure UI updates
        invalidateAuthCache();
        return null;
      }

      // If 429, show toast and re-throw so the router can avoid redirect
      if (error instanceof ApiError && error.status === 429) {
        toast.error("Too many requests. Please slow down.");
        throw error;
      }

      // For transient/non-auth errors, preserve any known user state and re-throw.
      // This prevents protected routes from redirecting to login due to flaky /me requests.
      const cachedUser = getQueryClient()?.getQueryData<User | null>(
        queryKeys.auth.me,
      );
      if (cachedUser !== undefined) {
        currentUser = cachedUser;
        return currentUser;
      }

      throw error;
    } finally {
      userPromise = null;
    }
  })();

  return userPromise;
}

export function clearUser(): void {
  currentUser = null;
  userPromise = null;
  // Invalidate React Query cache to ensure UI updates
  invalidateAuthCache();
}

export function setUser(user: User | null): void {
  currentUser = user;
  getQueryClient()?.setQueryData(queryKeys.auth.me, user);
}
