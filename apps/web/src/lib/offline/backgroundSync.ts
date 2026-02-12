import { getPendingMutations, removeMutation, markMutationProcessing, markMutationFailed } from './mutationQueue';
import { getNetworkStatus } from './networkStatus';

const API_BASE = import.meta.env.PROD ? '' : '';

/**
 * Process queued mutations when back online
 */
export async function syncQueuedMutations(): Promise<void> {
  if (!getNetworkStatus()) {
    console.log('Still offline, skipping sync');
    return;
  }

  const pendingMutations = await getPendingMutations();

  if (pendingMutations.length === 0) {
    return;
  }

  console.log(`Syncing ${pendingMutations.length} queued mutations...`);

  for (const mutation of pendingMutations) {
    try {
      await markMutationProcessing(mutation.id);

      // Get CSRF token if needed
      const headers = { ...mutation.headers };

      // Execute the mutation
      const response = await fetch(`${API_BASE}${mutation.endpoint}`, {
        method: mutation.method,
        headers,
        body: mutation.body,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success - remove from queue
      await removeMutation(mutation.id);
      console.log(`Successfully synced mutation: ${mutation.endpoint}`);
    } catch (error) {
      console.error(`Failed to sync mutation ${mutation.id}:`, error);
      await markMutationFailed(mutation.id);
    }
  }

  // Check if there are more pending mutations
  const remaining = await getPendingMutations();
  if (remaining.length > 0) {
    console.log(`${remaining.length} mutations still pending`);
  }
}

/**
 * Register background sync with service worker
 */
export async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if Background Sync API is available
    if (!('sync' in registration)) {
      console.warn('Background Sync API not supported');
      return;
    }

    await (registration as any).sync.register('sync-mutations');
    console.log('Background sync registered');
  } catch (error) {
    console.error('Failed to register background sync:', error);
  }
}

/**
 * Trigger immediate sync attempt
 */
export async function triggerSync(): Promise<void> {
  if (getNetworkStatus()) {
    await syncQueuedMutations();
  } else {
    // Register background sync for when connection is restored
    await registerBackgroundSync();
  }
}
