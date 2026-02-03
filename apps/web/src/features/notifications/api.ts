import { fetchApi } from "../../lib/api";
import type { Notification } from "../../types/entities";

export type NotificationDevice = {
  id: number;
  endpoint: string;
  device_name: string;
  platform: string;
  os_name: string;
  os_version: string;
  browser_name: string;
  browser_version: string;
  created_at: string | Date;
};

export interface NotificationDevicesResponse {
  devices: Array<NotificationDevice>;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UnreadCountResponse {
  unread_count: number;
}

// Elysia API endpoints (migrated from Python)
const NOTIFICATIONS_API = "/api/notifications";

export const notificationsApi = {
  getNotifications: async (
    page: number = 1,
    limit: number = 20,
    read?: boolean
  ): Promise<NotificationsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (read !== undefined) {
      params.append("read", read.toString());
    }
    return fetchApi<NotificationsResponse>(
      `${NOTIFICATIONS_API}?${params.toString()}`
    );
  },

  getNotificationDevices: async (): Promise<NotificationDevicesResponse> => {
    return fetchApi<NotificationDevicesResponse>(`${NOTIFICATIONS_API}/devices`);
  },

  deleteNotificationDevice: async (
    deviceId: number
  ): Promise<{ success: boolean; message: string }> => {
    return fetchApi<{ success: boolean; message: string }>(
      `${NOTIFICATIONS_API}/devices/${deviceId}`,
      {
        method: "DELETE",
      }
    );
  },

  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    return fetchApi<UnreadCountResponse>(`${NOTIFICATIONS_API}/unread-count`);
  },

  markAsRead: async (
    notificationId: number
  ): Promise<{ success: boolean; message: string }> => {
    return fetchApi(`${NOTIFICATIONS_API}/${notificationId}/read`, {
      method: "PUT",
    });
  },

  markAllAsRead: async (): Promise<{
    success: boolean;
    message: string;
    count: number;
  }> => {
    return fetchApi(`${NOTIFICATIONS_API}/read-all`, {
      method: "PUT",
    });
  },

  deleteNotification: async (
    notificationId: number
  ): Promise<{ success: boolean; message: string }> => {
    return fetchApi(`${NOTIFICATIONS_API}/${notificationId}`, {
      method: "DELETE",
    });
  },

  // Push notification subscription endpoints (migrated to Elysia)
  subscribe: async (
    subscription: PushSubscription,
    deviceInfo?: Record<string, string>
  ): Promise<{ success: boolean; message: string }> => {
    return fetchApi(`${NOTIFICATIONS_API}/subscribe`, {
      method: "POST",
      body: JSON.stringify({ subscription, device_info: deviceInfo }),
    });
  },

  unsubscribe: async (
    subscription?: PushSubscription
  ): Promise<{ success: boolean; message: string }> => {
    return fetchApi(`${NOTIFICATIONS_API}/unsubscribe`, {
      method: "POST",
      body: JSON.stringify({ subscription }),
    });
  },

  getVapidPublicKey: async (): Promise<{ publicKey: string }> => {
    return fetchApi(`${NOTIFICATIONS_API}/vapid-public-key`);
  },

  testNotification: async (
    subscription: PushSubscription
  ): Promise<{ success: boolean; message: string }> => {
    return fetchApi(`${NOTIFICATIONS_API}/test`, {
      method: "POST",
      body: JSON.stringify({ subscription }),
    });
  },
};
