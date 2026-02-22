import apn from '@parse/node-apn';

interface ApnPushPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  channelId?: string;
  badge?: number;
  contentAvailable?: boolean;
}

let apnProvider: apn.Provider | null = null;

export const getApnProvider = () => {
  if (apnProvider) return apnProvider;

  const { APNS_TEAM_ID, APNS_KEY_ID, APNS_AUTH_KEY, APNS_TOPIC, APNS_PRODUCTION } = process.env;

  if (!APNS_TEAM_ID || !APNS_KEY_ID || !APNS_AUTH_KEY || !APNS_TOPIC) {
    console.warn('APNs credentials not fully configured. Node-apn will not be initialized.');
    return null;
  }

  try {
    const isProduction = APNS_PRODUCTION === 'true';

    apnProvider = new apn.Provider({
      token: {
        key: APNS_AUTH_KEY,
        keyId: APNS_KEY_ID,
        teamId: APNS_TEAM_ID,
      },
      production: isProduction,
    });

    console.log(`APNs Provider initialized (${isProduction ? 'Production' : 'Sandbox'}) for topic: ${APNS_TOPIC}`);
    return apnProvider;
  } catch (error) {
    console.error('Failed to initialize APNs Provider:', error);
    return null;
  }
};

/**
 * Send push notifications via Apple Push Notification service (APNs).
 * Returns tokens that should be deleted from DB (e.g. BadDeviceToken or Unregistered).
 */
export async function sendApnNotifications(
  tokens: string[],
  payload: ApnPushPayload
): Promise<{ successCount: number; invalidTokens: string[] }> {
  const provider = getApnProvider();
  if (!provider) {
    return { successCount: 0, invalidTokens: [] };
  }

  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 0) {
    return { successCount: 0, invalidTokens: [] };
  }

  const notification = new apn.Notification();
  notification.topic = process.env.APNS_TOPIC || '';
  
  if (payload.title || payload.body) {
    notification.alert = {
      title: payload.title || '',
      body: payload.body || '',
    };
  }
  if (payload.badge !== undefined) notification.badge = payload.badge;
  if (payload.sound !== null) notification.sound = payload.sound || 'default';
  
  // Custom payload data
  if (payload.data) {
    notification.payload = payload.data;
  }
  
  // Silent push / Background update
  if (payload.contentAvailable) {
    notification.contentAvailable = true;
  }

  try {
    const response = await provider.send(notification, uniqueTokens);
    
    const invalidTokens: string[] = [];
    const successCount = response.sent.length;

    response.failed.forEach(failure => {
      console.error('APNs push failure:', {
        token: failure.device,
        error: failure.response?.reason || failure.error?.message,
      });

      // https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/handling_notification_responses_from_apns
      const reason = failure.response?.reason;
      if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
        invalidTokens.push(failure.device);
      }
    });

    return { successCount, invalidTokens };
  } catch (error) {
    console.error('Error sending APNs push notification:', error);
    return { successCount: 0, invalidTokens: [] };
  }
}
