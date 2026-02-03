import { fetchApi } from "../../lib/api";
import type { UserResponse } from "../../types";
import i18n from "../../lib/i18n";

export const authApi = {
  // Elysia endpoint
  async getCurrentUser(): Promise<UserResponse> {
    return fetchApi<UserResponse>("/api/auth/me");
  },

  // Elysia endpoint
  async login(email: string, password: string): Promise<UserResponse> {
    const locale = i18n.language || "en";
    const response = await fetchApi<UserResponse>(`/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password, locale }),
    });
    return response;
  },

  // Elysia endpoint
  async signup(
    email: string,
    password: string,
    first_name?: string,
    last_name?: string,
  ): Promise<UserResponse> {
    const locale = i18n.language || "en";
    const response = await fetchApi<UserResponse>(`/api/auth/signup`, {
      method: "POST",
      body: JSON.stringify({ email, password, first_name, last_name, locale }),
    });
    return response;
  },

  // Elysia endpoint
  async logout(subscriptionEndpoint?: string): Promise<{ message: string }> {
    const body: { subscription?: { endpoint: string } } = {};
    if (subscriptionEndpoint) {
      body.subscription = { endpoint: subscriptionEndpoint };
    }
    const response = await fetchApi<{ message: string }>(`/api/auth/logout`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return response;
  },

  // Elysia endpoint
  async forgotPassword(email: string): Promise<{ message: string }> {
    const locale = i18n.language || "en";
    return fetchApi<{ message: string }>(`/api/auth/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email, locale }),
    });
  },

  // Elysia endpoint
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const locale = i18n.language || "en";
    return fetchApi<{ message: string }>(`/api/auth/reset-password`, {
      method: "POST",
      body: JSON.stringify({ token, password, locale }),
    });
  },
};
