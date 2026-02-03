import { authApi } from "../features/auth/api";
import type { User } from "../types";
import { getQueryClient, invalidateAuthCache } from "./queryClient";
import { queryKeys } from "./queryKeys";

let currentUser: User | null = null;
let userPromise: Promise<User | null> | null = null;

export async function getCurrentUser(): Promise<User | null> {
  if (currentUser) {
    return currentUser;
  }

  if (userPromise) {
    return userPromise;
  }

  userPromise = (async () => {
    try {
      const response = await authApi.getCurrentUser();
      currentUser = response.user;
      return currentUser;
    } catch (error: any) {
      // If 401, user is not authenticated - clear cache
      if (error?.status === 401) {
        currentUser = null;
        userPromise = null;
        // Invalidate React Query cache to ensure UI updates
        invalidateAuthCache();
      } else {
        currentUser = null;
      }
      return null;
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

export function logout(): void {
  clearUser();
  window.location.href = "/logout";
}
