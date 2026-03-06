import { sw } from './sw';
import { handleAppUpdate } from './app-update';
import { syncBadgeCount } from './badge';
import type { PushNotificationData } from './types';

const NOTIFICATION_EVENT_CHANNEL = 'hously-notification-events';

export function handlePush(event: PushEvent): void {
  let data: PushNotificationData = {};

  if (event.data) {
    try {
      data = event.data.json() as PushNotificationData;
    } catch {
      data = { title: 'Hously', body: event.data.text() };
    }
  }

  const messagePayload = {
    type: 'notification-received' as const,
    notificationData: data,
  };

  const broadcast_promise = sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage(messagePayload);
    });

    // Fallback for browsers/tabs where SW client messaging is flaky for uncontrolled windows.
    if ('BroadcastChannel' in self) {
      const channel = new BroadcastChannel(NOTIFICATION_EVENT_CHANNEL);
      channel.postMessage(messagePayload);
      channel.close();
    }
  });

  const title = data.title || 'Hously';
  const body = data.body || 'Vous avez une nouvelle notification';
  const icon = data.icon || '/icon-192.png';
  const badge = data.badge || '/icon-32.png';
  const tag = data.tag || 'notification';
  const url = data.data?.url || '/';

  const options: NotificationOptions = {
    body,
    icon,
    badge,
    tag,
    vibrate: data.vibrate || [200, 100, 200],
    data: {
      url,
      chore_id: data.data?.chore_id || null,
      notification_type: data.data?.notification_type || null,
    },
    requireInteraction: true,
  };

  if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions;
  } else {
    options.actions = [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' },
    ];
  }

  const promises: Promise<unknown>[] = [
    sw.registration.showNotification(title, options),
    broadcast_promise,
    syncBadgeCount(),
  ];

  // 💡 Ici on remet handleAppUpdate dans la game, SANS faire de silent push
  if (data.data?.notification_type === 'app-update') {
    promises.push(handleAppUpdate());
  }

  event.waitUntil(Promise.all(promises));
}
