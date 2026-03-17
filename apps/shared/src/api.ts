import type { Fetcher } from './hooks/context';
import {
  ADMIN_ENDPOINTS,
  AUTH_ENDPOINTS,
  CHORES_ENDPOINTS,
  DASHBOARD_ENDPOINTS,
  EXTERNAL_NOTIFICATION_ENDPOINTS,
  NOTIFICATION_ENDPOINTS,
  PLUGIN_ENDPOINTS,
  RECIPES_ENDPOINTS,
  SHOPPING_ENDPOINTS,
  USERS_ENDPOINTS,
} from './endpoints';
import { getRecipeImageUrl } from './utils/media';
import type {
  ApiResult,
  ArrProfile,
  ChangePasswordRequest,
  ChoreMutationResponse,
  ChoresResponse,
  ClearCompletedChoresResponse,
  ClearCompletedResponse,
  CreateChoreRequest,
  CreateRecipeRequest,
  CreateShoppingItemRequest,
  DashboardJellyfinLatestResponse,
  DashboardActivityFeedResponse,
  DashboardNetdataSummaryResponse,
  DashboardScrutinySummaryResponse,
  DashboardQbittorrentStatusResponse,
  DashboardStatsResponse,
  DashboardUpcomingResponse,
  DeleteUserResponse,
  ExportDataResponse,
  ExternalNotificationService,
  ImportDataResponse,
  JellyfinPlugin,
  JellyfinPluginUpdateResponse,
  ListUsersResponse,
  LogsResponse,
  NetdataPlugin,
  NetdataPluginUpdateResponse,
  Notification,
  NotificationDevice,
  NotificationDevicesResponse,
  NotificationTemplate,
  ReorderChoresRequest,
  ReorderShoppingItemsRequest,
  QbittorrentPlugin,
  QbittorrentPluginUpdateResponse,
  QueueJob,
  RadarrPlugin,
  RadarrPluginUpdateResponse,
  RecipeDetailResponse,
  RecipesResponse,
  ScheduledJobsResponse,
  ServiceResponse,
  ServicesResponse,
  ShoppingItemResponse,
  ShoppingItemsResponse,
  ScrutinyPlugin,
  ScrutinyPluginUpdateResponse,
  SonarrPlugin,
  SonarrPluginUpdateResponse,
  TmdbPlugin,
  TmdbPluginUpdateResponse,
  TemplateResponse,
  TemplatesResponse,
  TestEmailResponse,
  TestEmailTemplatesResponse,
  ToggleChoreRequest,
  ToggleChoreResponse,
  ToggleShoppingItemResponse,
  TriggerActionResponse,
  UnreadCountResponse,
  UpdateChoreRequest,
  UpdateProfileRequest,
  UpdateRecipeRequest,
  UploadChoreImageResponse,
  User,
  UserResponse,
  UsersResponse,
} from './types';

export type ApiFetcher = Fetcher;
export type AuthUserResponse = UserResponse & { token?: string; refreshToken?: string };
type AuthenticatedUserResponse = { user: User; token?: string; refreshToken?: string };

const withParams = (endpoint: string, params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${endpoint}?${query}` : endpoint;
};

const toFormData = (field: string, value: File | FormData): FormData => {
  if (value instanceof FormData) return value;
  const formData = new FormData();
  formData.append(field, value);
  return formData;
};

type AuthApiOptions = {
  getLocale?: () => string | undefined;
};
type PushSubscriptionInput = { endpoint: string } | Record<string, unknown>;

export function createAuthApi(fetcher: ApiFetcher, options: AuthApiOptions = {}) {
  const resolveLocale = (locale?: string) => locale ?? options.getLocale?.() ?? 'en';

  const getCurrentUser = () => fetcher<AuthenticatedUserResponse>(AUTH_ENDPOINTS.ME);

  const login = async (credentials: {
    email: string;
    password: string;
    locale?: string;
  }): Promise<AuthenticatedUserResponse> => {
    return fetcher<AuthenticatedUserResponse>(AUTH_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: {
        email: credentials.email,
        password: credentials.password,
        locale: resolveLocale(credentials.locale),
      },
    });
  };

  const validateInvitation = async (token: string) => {
    return fetcher<{ valid: boolean; email?: string; error?: string }>(
      `${AUTH_ENDPOINTS.ACCEPT_INVITATION}?token=${encodeURIComponent(token)}`
    );
  };

  const acceptInvitation = async (data: {
    token: string;
    password: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AuthenticatedUserResponse> => {
    return fetcher<AuthenticatedUserResponse>(AUTH_ENDPOINTS.ACCEPT_INVITATION, {
      method: 'POST',
      body: {
        token: data.token,
        password: data.password,
        first_name: data.first_name ?? data.firstName,
        last_name: data.last_name ?? data.lastName,
      },
    });
  };

  const logout = (subscriptionEndpoint?: string) => {
    const body: { subscription?: { endpoint: string } } = {};
    if (subscriptionEndpoint) body.subscription = { endpoint: subscriptionEndpoint };

    return fetcher<{ message: string }>(AUTH_ENDPOINTS.LOGOUT, {
      method: 'POST',
      body,
    });
  };

  const forgotPassword = (payload: { email: string; locale?: string }): Promise<{ message: string }> => {
    return fetcher<{ message: string }>(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
      method: 'POST',
      body: {
        email: payload.email,
        locale: resolveLocale(payload.locale),
      },
    });
  };

  const resetPassword = (payload: {
    token: string;
    password: string;
    locale?: string;
  }): Promise<{ message: string }> => {
    return fetcher<{ message: string }>(AUTH_ENDPOINTS.RESET_PASSWORD, {
      method: 'POST',
      body: {
        token: payload.token,
        password: payload.password,
        locale: resolveLocale(payload.locale),
      },
    });
  };

  const updateProfile = (
    data: UpdateProfileRequest | { firstName?: string | null; lastName?: string | null; locale?: string | null }
  ): Promise<AuthenticatedUserResponse> => {
    const camel = data as { firstName?: string | null; lastName?: string | null };
    const normalized: UpdateProfileRequest = {
      first_name: 'first_name' in data ? data.first_name : camel.firstName,
      last_name: 'last_name' in data ? data.last_name : camel.lastName,
      locale: data.locale ?? null,
    };

    return fetcher<AuthenticatedUserResponse>(USERS_ENDPOINTS.ME, {
      method: 'PUT',
      body: normalized,
    });
  };

  const changePassword = (
    data: ChangePasswordRequest | { currentPassword: string; newPassword: string }
  ): Promise<{ message: string }> => {
    const normalized: ChangePasswordRequest = {
      current_password: 'current_password' in data ? data.current_password : data.currentPassword,
      new_password: 'new_password' in data ? data.new_password : data.newPassword,
    };

    return fetcher<{ message: string }>(USERS_ENDPOINTS.CHANGE_PASSWORD, {
      method: 'POST',
      body: normalized,
    });
  };

  const uploadAvatar = (
    fileOrFormData: File | FormData
  ): Promise<{ message: string; avatar_url: string; url?: string }> => {
    return fetcher<{ message: string; avatar_url: string; url?: string }>(USERS_ENDPOINTS.AVATAR, {
      method: 'POST',
      body: toFormData('avatar', fileOrFormData),
    });
  };

  const registerPushToken = (token: string, platform: 'ios' | 'android'): Promise<void> => {
    return fetcher<void>(NOTIFICATION_ENDPOINTS.REGISTER_DEVICE, {
      method: 'POST',
      body: { token, platform },
    });
  };

  const unregisterPushToken = (token: string): Promise<void> => {
    return fetcher<void>(NOTIFICATION_ENDPOINTS.UNREGISTER_DEVICE, {
      method: 'POST',
      body: { token },
    });
  };

  return {
    getCurrentUser,
    login,
    validateInvitation,
    acceptInvitation,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    uploadAvatar,
    registerPushToken,
    unregisterPushToken,
  };
}

export function createShoppingApi(fetcher: ApiFetcher) {
  const getShoppingItems = () => fetcher<ShoppingItemsResponse>(SHOPPING_ENDPOINTS.LIST);
  const createShoppingItem = (data: CreateShoppingItemRequest) =>
    fetcher<ShoppingItemResponse>(SHOPPING_ENDPOINTS.CREATE, {
      method: 'POST',
      body: data,
    });
  const toggleShoppingItem = (itemId: number) =>
    fetcher<ToggleShoppingItemResponse>(SHOPPING_ENDPOINTS.TOGGLE(itemId), { method: 'POST' });
  const updateShoppingItem = (itemId: number, data: { item_name?: string; notes?: string | null }) =>
    fetcher<ShoppingItemResponse>(SHOPPING_ENDPOINTS.UPDATE(itemId), {
      method: 'PUT',
      body: data,
    });
  const deleteShoppingItem = (itemId: number) =>
    fetcher<ShoppingItemResponse>(SHOPPING_ENDPOINTS.DELETE(itemId), { method: 'DELETE' });
  const deleteShoppingItems = (itemIds: number[]) =>
    fetcher<ApiResult<{ message: string; count: number }>>(SHOPPING_ENDPOINTS.DELETE_BULK, {
      method: 'POST',
      body: { item_ids: itemIds },
    });
  const clearAllCompleted = () =>
    fetcher<ClearCompletedResponse>(SHOPPING_ENDPOINTS.CLEAR_COMPLETED, { method: 'POST' });
  const reorderItems = (payload: number[] | ReorderShoppingItemsRequest) => {
    const itemIds = Array.isArray(payload) ? payload : payload.item_ids;
    return fetcher<ShoppingItemResponse>(SHOPPING_ENDPOINTS.REORDER, {
      method: 'POST',
      body: { item_ids: itemIds },
    });
  };

  return {
    getShoppingItems,
    getItems: getShoppingItems,
    createShoppingItem,
    createItem: createShoppingItem,
    toggleShoppingItem,
    toggleItem: toggleShoppingItem,
    updateShoppingItem,
    updateItem: updateShoppingItem,
    deleteShoppingItem,
    deleteItem: deleteShoppingItem,
    deleteShoppingItems,
    clearAllCompleted,
    clearCompleted: clearAllCompleted,
    reorderItems,
  };
}

export function createChoresApi(fetcher: ApiFetcher) {
  const getChores = () => fetcher<ChoresResponse>(CHORES_ENDPOINTS.LIST);
  const createChore = (data: CreateChoreRequest) =>
    fetcher<ChoreMutationResponse>(CHORES_ENDPOINTS.CREATE, {
      method: 'POST',
      body: data,
    });
  const toggleChore = (choreId: number, payload?: ToggleChoreRequest) =>
    fetcher<ToggleChoreResponse>(CHORES_ENDPOINTS.TOGGLE(choreId), {
      method: 'POST',
      body: payload ?? {},
    });
  const updateChore = (choreId: number, data: UpdateChoreRequest) =>
    fetcher<ChoreMutationResponse>(CHORES_ENDPOINTS.UPDATE(choreId), {
      method: 'PUT',
      body: data,
    });
  const deleteChore = (choreId: number) =>
    fetcher<ChoreMutationResponse>(CHORES_ENDPOINTS.DELETE(choreId), { method: 'DELETE' });
  const clearAllCompleted = () =>
    fetcher<ClearCompletedChoresResponse>(CHORES_ENDPOINTS.CLEAR_COMPLETED, {
      method: 'POST',
    });
  const removeRecurrence = (choreId: number) =>
    fetcher<ChoreMutationResponse>(CHORES_ENDPOINTS.REMOVE_RECURRENCE(choreId), {
      method: 'PUT',
    });
  const reorderChores = (payload: number[] | ReorderChoresRequest) => {
    const choreIds = Array.isArray(payload) ? payload : payload.chore_ids;
    return fetcher<ChoreMutationResponse>(CHORES_ENDPOINTS.REORDER, {
      method: 'POST',
      body: { chore_ids: choreIds },
    });
  };

  const uploadImage = (fileOrFormData: File | FormData) =>
    fetcher<UploadChoreImageResponse>(CHORES_ENDPOINTS.UPLOAD_IMAGE, {
      method: 'POST',
      body: toFormData('image', fileOrFormData),
    });

  const getImageUrl = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    return CHORES_ENDPOINTS.IMAGE(imagePath);
  };

  const getThumbnailUrl = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    return CHORES_ENDPOINTS.THUMBNAIL(imagePath);
  };

  return {
    getChores,
    createChore,
    toggleChore,
    updateChore,
    deleteChore,
    clearAllCompleted,
    clearCompleted: clearAllCompleted,
    uploadImage,
    getImageUrl,
    getThumbnailUrl,
    removeRecurrence,
    reorderChores,
  };
}

export function createDashboardApi(fetcher: ApiFetcher) {
  return {
    getDashboardStats: () => fetcher<DashboardStatsResponse>(DASHBOARD_ENDPOINTS.STATS),
    getDashboardActivities: (limit?: number) =>
      fetcher<{ activities: DashboardStatsResponse['activities'] }>(
        withParams(DASHBOARD_ENDPOINTS.ACTIVITIES, { limit })
      ),
    getDashboardActivityFeed: (params: { limit?: number; service?: string; type?: string } = {}) =>
      fetcher<DashboardActivityFeedResponse>(withParams(DASHBOARD_ENDPOINTS.ACTIVITIES_FEED, params)),
    getDashboardJellyfinLatest: (limit: number = 10, page: number = 1) =>
      fetcher<DashboardJellyfinLatestResponse>(withParams(DASHBOARD_ENDPOINTS.JELLYFIN.LATEST, { limit, page })),
    getDashboardUpcoming: (limit: number = 8, page: number = 1) =>
      fetcher<DashboardUpcomingResponse>(withParams(DASHBOARD_ENDPOINTS.UPCOMING.LIST, { limit, page })),
    addUpcomingToArr: (data: { media_type: 'movie' | 'tv'; tmdb_id: number; search_on_add: boolean }) =>
      fetcher<{
        success: boolean;
        service: 'radarr' | 'sonarr';
        added: boolean;
        already_exists: boolean;
      }>(DASHBOARD_ENDPOINTS.UPCOMING.ADD, {
        method: 'POST',
        body: data,
      }),
    getUpcomingStatus: (data: { media_type: 'movie' | 'tv'; tmdb_id: number }) =>
      fetcher<{
        exists: boolean;
        service: 'radarr' | 'sonarr';
        can_add: boolean;
        source_id: number | null;
        arr_url: string | null;
      }>(DASHBOARD_ENDPOINTS.UPCOMING.STATUS, {
        method: 'POST',
        body: data,
      }),
    getDashboardQbittorrentStatus: () =>
      fetcher<DashboardQbittorrentStatusResponse>(DASHBOARD_ENDPOINTS.QBITTORRENT.STATUS),
    getDashboardScrutinySummary: () => fetcher<DashboardScrutinySummaryResponse>(DASHBOARD_ENDPOINTS.SCRUTINY.SUMMARY),
    getDashboardNetdataSummary: () => fetcher<DashboardNetdataSummaryResponse>(DASHBOARD_ENDPOINTS.NETDATA.SUMMARY),
  };
}

export function createRecipesApi(fetcher: ApiFetcher) {
  return {
    getRecipes: () => fetcher<RecipesResponse>(RECIPES_ENDPOINTS.LIST),
    getRecipe: (recipeId: number) => fetcher<RecipeDetailResponse>(RECIPES_ENDPOINTS.DETAIL(recipeId)),
    createRecipe: (data: CreateRecipeRequest) =>
      fetcher<ApiResult<{ id: number }>>(RECIPES_ENDPOINTS.CREATE, {
        method: 'POST',
        body: data,
      }),
    updateRecipe: (recipeId: number, data: UpdateRecipeRequest) =>
      fetcher<ApiResult<{ message: string }>>(RECIPES_ENDPOINTS.UPDATE(recipeId), {
        method: 'PUT',
        body: data,
      }),
    deleteRecipe: (recipeId: number) =>
      fetcher<ApiResult<{ message: string }>>(RECIPES_ENDPOINTS.DELETE(recipeId), { method: 'DELETE' }),
    toggleFavorite: (recipeId: number) =>
      fetcher<ApiResult<{ is_favorite: number }>>(RECIPES_ENDPOINTS.TOGGLE_FAVORITE(recipeId), { method: 'POST' }),
    uploadImage: (fileOrFormData: File | FormData) =>
      fetcher<ApiResult<{ image_path: string }>>(RECIPES_ENDPOINTS.UPLOAD_IMAGE, {
        method: 'POST',
        body: toFormData('image', fileOrFormData),
      }),
    getImageUrl: (imagePath: string | null | undefined): string | null => getRecipeImageUrl(imagePath),
  };
}

export function createNotificationsApi(fetcher: ApiFetcher) {
  type NotificationsListResponse = {
    notifications: Notification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };

  return {
    getNotifications: (page: number = 1, limit: number = 20, read?: boolean) =>
      fetcher<NotificationsListResponse>(
        withParams(NOTIFICATION_ENDPOINTS.LIST, {
          page,
          limit,
          read,
        })
      ),
    getNotificationDevices: () => fetcher<NotificationDevicesResponse>(NOTIFICATION_ENDPOINTS.DEVICES),
    deleteNotificationDevice: (deviceId: number) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.DELETE_DEVICE(deviceId), {
        method: 'DELETE',
      }),
    getUnreadCount: () => fetcher<UnreadCountResponse>(NOTIFICATION_ENDPOINTS.UNREAD_COUNT),
    markAsRead: (notificationId: number) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.MARK_READ(notificationId), {
        method: 'PUT',
      }),
    markAllAsRead: () =>
      fetcher<{ success: boolean; message: string; count: number }>(NOTIFICATION_ENDPOINTS.MARK_ALL_READ, {
        method: 'PUT',
      }),
    deleteNotification: (notificationId: number) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.DELETE(notificationId), {
        method: 'DELETE',
      }),
    subscribe: (subscription: PushSubscriptionInput, deviceInfo?: object) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.SUBSCRIBE, {
        method: 'POST',
        body: { subscription, device_info: deviceInfo },
      }),
    unsubscribe: (subscription?: PushSubscriptionInput) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.UNSUBSCRIBE, {
        method: 'POST',
        body: { subscription },
      }),
    getVapidPublicKey: () => fetcher<{ publicKey: string }>(NOTIFICATION_ENDPOINTS.VAPID_PUBLIC_KEY),
    testNotification: (subscription: PushSubscriptionInput) =>
      fetcher<{ success: boolean; message: string }>(NOTIFICATION_ENDPOINTS.TEST, {
        method: 'POST',
        body: { subscription },
      }),
  };
}

export function createUsersApi(fetcher: ApiFetcher) {
  return {
    getUsers: () => fetcher<UsersResponse>(USERS_ENDPOINTS.LIST),
    getCurrentUser: () => fetcher<UserResponse>(USERS_ENDPOINTS.ME),
    updateProfile: (data: UpdateProfileRequest) =>
      fetcher<UserResponse>(USERS_ENDPOINTS.ME, {
        method: 'PUT',
        body: data,
      }),
    changePassword: (data: ChangePasswordRequest) =>
      fetcher<{ message: string }>(USERS_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        body: data,
      }),
    uploadAvatar: (fileOrFormData: File | FormData) =>
      fetcher<{ message: string; avatar_url: string }>(USERS_ENDPOINTS.AVATAR, {
        method: 'POST',
        body: toFormData('avatar', fileOrFormData),
      }),
  };
}

export function createAdminApi(fetcher: ApiFetcher) {
  return {
    exportData: () => fetcher<ExportDataResponse>(ADMIN_ENDPOINTS.EXPORT),
    importData: (data: Record<string, unknown>) =>
      fetcher<ImportDataResponse>(ADMIN_ENDPOINTS.IMPORT, {
        method: 'POST',
        body: data,
      }),
    triggerAction: (action: string) =>
      fetcher<TriggerActionResponse>(ADMIN_ENDPOINTS.TRIGGER_ACTION, {
        method: 'POST',
        body: { action },
      }),
    getScheduledJobs: () => fetcher<ScheduledJobsResponse>(ADMIN_ENDPOINTS.SCHEDULED_JOBS),
    getQueueJobs: (name: string, status?: string[], limit?: number) => 
      fetcher<QueueJob[]>(withParams(ADMIN_ENDPOINTS.QUEUE_JOBS(name), { status: status?.join(','), limit })),
    getUsers: () => fetcher<ListUsersResponse>(ADMIN_ENDPOINTS.USERS),
    inviteUser: (data: { email: string; is_admin?: boolean; locale?: string }) =>
      fetcher<{ success: boolean; invitation: Record<string, unknown> }>(ADMIN_ENDPOINTS.INVITE_USER, {
        method: 'POST',
        body: data,
      }),
    getInvitations: () =>
      fetcher<{ success: boolean; invitations: Array<Record<string, unknown>> }>(ADMIN_ENDPOINTS.INVITATIONS),
    resendInvitation: (id: number) =>
      fetcher<{ success: boolean; message: string }>(ADMIN_ENDPOINTS.RESEND_INVITATION(id), {
        method: 'POST',
      }),
    revokeInvitation: (id: number) =>
      fetcher<{ success: boolean; message: string }>(ADMIN_ENDPOINTS.REVOKE_INVITATION(id), {
        method: 'DELETE',
      }),
    deleteUser: (userId: number) =>
      fetcher<DeleteUserResponse>(ADMIN_ENDPOINTS.DELETE_USER(userId), {
        method: 'DELETE',
      }),
    getTestEmailTemplates: () => fetcher<TestEmailTemplatesResponse>(ADMIN_ENDPOINTS.TEST_EMAIL_TEMPLATES),
    testEmail: (templateId?: string) =>
      fetcher<TestEmailResponse>(ADMIN_ENDPOINTS.TEST_EMAIL, {
        method: 'POST',
        body: { template_id: templateId || 'test' },
      }),
  };
}

export function createPluginsApi(fetcher: ApiFetcher) {
  return {
    getJellyfinPlugin: () => fetcher<{ plugin: JellyfinPlugin }>(PLUGIN_ENDPOINTS.JELLYFIN),
    updateJellyfinPlugin: (data: { website_url: string; api_key: string; enabled: boolean }) =>
      fetcher<JellyfinPluginUpdateResponse>(PLUGIN_ENDPOINTS.JELLYFIN, {
        method: 'PUT',
        body: data,
      }),
    getRadarrPlugin: () => fetcher<{ plugin: RadarrPlugin }>(PLUGIN_ENDPOINTS.RADARR),
    updateRadarrPlugin: (data: {
      website_url: string;
      api_key: string;
      root_folder_path: string;
      quality_profile_id: number;
      enabled: boolean;
    }) =>
      fetcher<RadarrPluginUpdateResponse>(PLUGIN_ENDPOINTS.RADARR, {
        method: 'PUT',
        body: data,
      }),
    getRadarrProfiles: (data: { website_url: string; api_key: string }) =>
      fetcher<{ quality_profiles: ArrProfile[] }>(PLUGIN_ENDPOINTS.RADARR_PROFILES, {
        method: 'POST',
        body: data,
      }),
    getSonarrPlugin: () => fetcher<{ plugin: SonarrPlugin }>(PLUGIN_ENDPOINTS.SONARR),
    updateSonarrPlugin: (data: {
      website_url: string;
      api_key: string;
      root_folder_path: string;
      quality_profile_id: number;
      language_profile_id: number;
      enabled: boolean;
    }) =>
      fetcher<SonarrPluginUpdateResponse>(PLUGIN_ENDPOINTS.SONARR, {
        method: 'PUT',
        body: data,
      }),
    getSonarrProfiles: (data: { website_url: string; api_key: string }) =>
      fetcher<{ quality_profiles: ArrProfile[]; language_profiles: ArrProfile[] }>(PLUGIN_ENDPOINTS.SONARR_PROFILES, {
        method: 'POST',
        body: data,
      }),
    getQbittorrentPlugin: () => fetcher<{ plugin: QbittorrentPlugin }>(PLUGIN_ENDPOINTS.QBITTORRENT),
    updateQbittorrentPlugin: (data: {
      website_url: string;
      username: string;
      password?: string;
      poll_interval_seconds?: number;
      max_items?: number;
      enabled: boolean;
    }) =>
      fetcher<QbittorrentPluginUpdateResponse>(PLUGIN_ENDPOINTS.QBITTORRENT, {
        method: 'PUT',
        body: data,
      }),
    getScrutinyPlugin: () => fetcher<{ plugin: ScrutinyPlugin }>(PLUGIN_ENDPOINTS.SCRUTINY),
    updateScrutinyPlugin: (data: { website_url: string; enabled: boolean }) =>
      fetcher<ScrutinyPluginUpdateResponse>(PLUGIN_ENDPOINTS.SCRUTINY, {
        method: 'PUT',
        body: data,
      }),
    getNetdataPlugin: () => fetcher<{ plugin: NetdataPlugin }>(PLUGIN_ENDPOINTS.NETDATA),
    updateNetdataPlugin: (data: { website_url: string; enabled: boolean }) =>
      fetcher<NetdataPluginUpdateResponse>(PLUGIN_ENDPOINTS.NETDATA, {
        method: 'PUT',
        body: data,
      }),
    getTmdbPlugin: () => fetcher<{ plugin: TmdbPlugin }>(PLUGIN_ENDPOINTS.TMDB),
    updateTmdbPlugin: (data: { api_key: string; enabled: boolean }) =>
      fetcher<TmdbPluginUpdateResponse>(PLUGIN_ENDPOINTS.TMDB, {
        method: 'PUT',
        body: data,
      }),
  };
}

export function createExternalNotificationsApi(fetcher: ApiFetcher) {
  return {
    getServices: () => fetcher<ServicesResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.SERVICES),
    enableService: (serviceId: number) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.ENABLE_SERVICE(serviceId), { method: 'POST' }),
    disableService: (serviceId: number) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.DISABLE_SERVICE(serviceId), { method: 'POST' }),
    regenerateToken: (serviceId: number) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.REGENERATE_TOKEN(serviceId), { method: 'POST' }),
    updateNotifyAdminsOnly: (serviceId: number, notifyAdminsOnly: boolean) =>
      fetcher<ServiceResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.UPDATE_NOTIFY_ADMINS_ONLY(serviceId), {
        method: 'POST',
        body: { notify_admins_only: notifyAdminsOnly },
      }),
    getTemplates: () => fetcher<TemplatesResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.TEMPLATES),
    updateTemplate: (templateId: number, data: { title_template?: string; body_template?: string }) =>
      fetcher<TemplateResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.TEMPLATE(templateId), {
        method: 'PUT',
        body: data,
      }),
    getLogs: () => fetcher<LogsResponse>(EXTERNAL_NOTIFICATION_ENDPOINTS.LOGS),
  };
}

export type { ExternalNotificationService, NotificationTemplate, Notification, NotificationDevice };
