import { NotificationDevice } from '@/features/notifications/api';
import type {
  ApiResult,
  ShoppingItemsResponse,
  ChoresResponse,
  DashboardStatsResponse,
  DashboardJellyfinLatestResponse,
  UserResponse,
  UsersResponse,
  CreateShoppingItemRequest,
  CreateChoreRequest,
  CalendarEventsResponse,
  CustomEventsResponse,
  CreateCustomEventRequest,
  UpdateCustomEventRequest,
  CustomEvent,
} from '../types';
import { getNetworkStatus } from './offline/networkStatus';
import { queueMutation } from './offline/mutationQueue';

export const API_BASE = import.meta.env.PROD ? '' : '';
const NON_QUEUEABLE_MUTATION_PREFIXES = ['/api/plugins'];
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get CSRF token for POST/PUT/DELETE requests
  const method = options?.method?.toUpperCase();
  const hasBody = options?.body !== undefined;

  // Build headers object - convert Headers to Record if needed
  const headersObj: Record<string, string> = {};
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headersObj[key] = value;
      });
    } else {
      Object.assign(headersObj, options.headers);
    }
  }

  // Only set Content-Type for requests with a body
  if (hasBody && !headersObj['Content-Type']) {
    headersObj['Content-Type'] = 'application/json';
  }

  const headers: HeadersInit = headersObj;

  // Extract options without headers to avoid duplication
  const { headers: _, ...optionsWithoutHeaders } = options || {};

  // Check if we're offline and this is a mutation (POST/PUT/DELETE/PATCH)
  const isMutation = method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  const isOffline = !getNetworkStatus();
  const isNonQueueableMutation =
    Boolean(isMutation) && NON_QUEUEABLE_MUTATION_PREFIXES.some(prefix => endpoint.startsWith(prefix));

  // If offline and it's a mutation, queue it instead of making the request
  if (isOffline && isMutation) {
    if (isNonQueueableMutation) {
      throw new ApiError('This setting requires a live server connection. Please reconnect and try again.', 0, undefined);
    }
    try {
      const mutationId = await queueMutation(endpoint, method || 'POST', options?.body?.toString() || null, headersObj);

      // Return a mock response that indicates the action was queued
      // This allows the UI to continue working
      return {
        success: true,
        queued: true,
        queueId: mutationId,
        message: 'Action queued for sync when online',
      } as T;
    } catch (queueError) {
      console.error('Failed to queue mutation:', queueError);

      // Provide a more specific error message based on the error type
      const errorMessage =
        queueError instanceof Error && queueError.message.includes('IndexedDB unavailable')
          ? 'Unable to save changes offline. This may be due to private browsing mode or browser storage settings. Please connect to the internet to make changes.'
          : 'Unable to queue action. Please try again when online.';

      throw new ApiError(errorMessage, 500, undefined);
    }
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...optionsWithoutHeaders,
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

      // Handle Service Worker offline responses (503 with offline flag)
      if (response.status === 503 && errorData.offline) {
        throw new ApiError('Unable to connect to server. Please ensure the backend is running.\n', 0, response);
      }

      // Sanitize error messages in production to avoid information disclosure
      let errorMessage = errorData.error || `HTTP error! status: ${response.status}`;

      // In production, use generic error messages for 5xx errors
      if (import.meta.env.PROD && response.status >= 500) {
        errorMessage = 'An internal server error occurred. Please try again later.';
        // Log full error for debugging (will be handled by error tracking service)
        console.error('Server error:', {
          status: response.status,
          error: errorData,
        });
      }

      throw new ApiError(errorMessage, response.status, response);
    }

    return response.json();
  } catch (error) {
    // Handle network errors (backend not running, CORS, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // If it's a mutation and we're offline, try to queue it
      if (isMutation && isOffline) {
        if (isNonQueueableMutation) {
          throw new ApiError(
            'This setting requires a live server connection. Please reconnect and try again.',
            0,
            undefined
          );
        }
        try {
          const mutationId = await queueMutation(
            endpoint,
            method || 'POST',
            options?.body?.toString() || null,
            headersObj
          );
          return {
            success: true,
            queued: true,
            queueId: mutationId,
            message: 'Action queued for sync when online',
          } as T;
        } catch (queueError) {
          console.error('Failed to queue mutation:', queueError);

          // If queuing failed, provide a helpful error message
          const errorMessage =
            queueError instanceof Error && queueError.message.includes('IndexedDB unavailable')
              ? 'Unable to save changes offline. This may be due to private browsing mode or browser storage settings. Please connect to the internet to make changes.'
              : 'Unable to queue action. Please try again when online.';

          throw new ApiError(errorMessage, 0, undefined);
        }
      }

      // In production, use a generic error message
      const errorMessage = import.meta.env.PROD
        ? 'Unable to connect to server. Please check your internet connection and try again.'
        : 'Unable to connect to server. Please ensure the backend is running.\n\nTo start the backend:\n  make dev-api    (backend only)';

      throw new ApiError(errorMessage, 500, undefined);
    }
    throw error;
  }
}

export const api = {
  // Auth
  async getCurrentUser(): Promise<UserResponse> {
    return fetchApi<UserResponse>('/api/auth/me');
  },

  async login(email: string, password: string): Promise<UserResponse> {
    const response = await fetchApi<UserResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return response;
  },

  async signup(email: string, password: string, first_name?: string, last_name?: string): Promise<UserResponse> {
    const response = await fetchApi<UserResponse>(`/api/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, first_name, last_name }),
    });
    return response;
  },

  async logout(): Promise<{ message: string }> {
    const response = await fetchApi<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
    return response;
  },

  // Shopping (Elysia API)
  async getShoppingItems(): Promise<ShoppingItemsResponse> {
    return fetchApi<ShoppingItemsResponse>('/api/shopping');
  },

  async createShoppingItem(data: CreateShoppingItemRequest): Promise<ApiResult<{ id: number }>> {
    return fetchApi<ApiResult<{ id: number }>>('/api/shopping', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleShoppingItem(itemId: number): Promise<ApiResult<{ completed: boolean }>> {
    return fetchApi<ApiResult<{ completed: boolean }>>(`/api/shopping/${itemId}/toggle`, {
      method: 'POST',
    });
  },

  async deleteShoppingItem(itemId: number): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`/api/shopping/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Chores (Elysia API)
  async getChores(): Promise<ChoresResponse> {
    return fetchApi<ChoresResponse>('/api/chores');
  },

  async createChore(data: CreateChoreRequest): Promise<ApiResult<{ id: number }>> {
    return fetchApi<ApiResult<{ id: number }>>('/api/chores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleChore(choreId: number): Promise<ApiResult<{ completed: boolean }>> {
    return fetchApi<ApiResult<{ completed: boolean }>>(`/api/chores/${choreId}/toggle`, {
      method: 'POST',
    });
  },

  async deleteChore(choreId: number): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`/api/chores/${choreId}`, {
      method: 'DELETE',
    });
  },

  // Dashboard (Elysia API)
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return fetchApi<DashboardStatsResponse>('/api/dashboard/stats');
  },

  async getDashboardActivities(limit?: number): Promise<{
    activities: DashboardStatsResponse['activities'];
  }> {
    const params = limit ? `?limit=${limit}` : '';
    return fetchApi<{ activities: DashboardStatsResponse['activities'] }>(`/api/dashboard/activities${params}`);
  },

  async getDashboardJellyfinLatest(limit?: number): Promise<DashboardJellyfinLatestResponse> {
    const params = limit ? `?limit=${limit}` : '';
    return fetchApi<DashboardJellyfinLatestResponse>(`/api/dashboard/jellyfin/latest${params}`);
  },

  // Users (Legacy Python API for list, Elysia for profile)
  async getUsers(): Promise<UsersResponse> {
    return fetchApi<UsersResponse>(`/api/users`);
  },

  // Update locale via Elysia users endpoint
  async updateLocale(locale: string): Promise<UserResponse> {
    return fetchApi<UserResponse>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify({ locale }),
    });
  },

  // Notifications (Elysia)
  async getNotificationDevices(): Promise<{
    devices: Array<NotificationDevice>;
  }> {
    return fetchApi<{ devices: Array<NotificationDevice> }>('/api/notifications/devices');
  },

  async deleteNotificationDevice(deviceId: number): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`/api/notifications/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },

  // Calendar (Elysia API)
  async getCalendarEvents(year?: number, month?: number): Promise<CalendarEventsResponse> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    const queryString = params.toString();
    return fetchApi<CalendarEventsResponse>(`/api/calendar${queryString ? `?${queryString}` : ''}`);
  },

  // Custom Events (Elysia API)
  async getCustomEvents(year?: number, month?: number): Promise<CustomEventsResponse> {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    const queryString = params.toString();
    return fetchApi<CustomEventsResponse>(`/api/custom-events${queryString ? `?${queryString}` : ''}`);
  },

  async createCustomEvent(data: CreateCustomEventRequest): Promise<CustomEvent> {
    return fetchApi<CustomEvent>('/api/custom-events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCustomEvent(eventId: number, data: UpdateCustomEventRequest): Promise<CustomEvent> {
    return fetchApi<CustomEvent>(`/api/custom-events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteCustomEvent(eventId: number): Promise<ApiResult<{ success: boolean }>> {
    return fetchApi<ApiResult<{ success: boolean }>>(`/api/custom-events/${eventId}`, {
      method: 'DELETE',
    });
  },
};

export { ApiError };
