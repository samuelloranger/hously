import { fetchApi } from "../../lib/api";
import type { UsersResponse, UserResponse } from "../../types";

export interface UpdateProfileRequest {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export const usersApi = {
  // List all users (still on legacy API)
  async getUsers(): Promise<UsersResponse> {
    return fetchApi<UsersResponse>(`/api/users`);
  },

  // Get current user profile (Elysia)
  async getCurrentUser(): Promise<UserResponse> {
    return fetchApi<UserResponse>("/api/users/me");
  },

  // Update profile - first_name, last_name, locale (Elysia)
  async updateProfile(data: UpdateProfileRequest): Promise<UserResponse> {
    return fetchApi<UserResponse>("/api/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Change password (Elysia) - separate endpoint
  async changePassword(
    data: ChangePasswordRequest,
  ): Promise<{ message: string }> {
    return fetchApi<{ message: string }>("/api/users/me/password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Upload avatar (Elysia)
  async uploadAvatar(
    file: File,
  ): Promise<{ message: string; avatar_url: string }> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch("/api/users/me/avatar", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Upload failed" }));
      throw new Error(errorData.error || "Failed to upload avatar");
    }

    return response.json();
  },
};
