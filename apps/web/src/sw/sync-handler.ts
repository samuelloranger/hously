import type { SyncEvent } from "./types";
import { syncBadgeCount } from "./badge";

// Periodic background sync handler - sync notification count and queued mutations
export function handleSync(event: Event): void {
  const syncEvent = event as SyncEvent;
  
  if (syncEvent.tag === "sync-notifications") {
    syncEvent.waitUntil(syncBadgeCount());
  } else if (syncEvent.tag === "sync-mutations") {
    // Sync queued mutations when back online
    // Send message to client to trigger sync (service worker can't directly access IndexedDB easily)
    syncEvent.waitUntil(triggerClientSync());
  }
}

/**
 * Trigger sync by sending message to client
 * The client will handle the actual sync since it has access to IndexedDB
 */
async function triggerClientSync(): Promise<void> {
  try {
    const clients = await (self as any).clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    
    // Send message to all clients to trigger sync
    clients.forEach((client: any) => {
      client.postMessage({
        type: "sync-mutations",
      });
    });
  } catch (error) {
    console.error("Failed to trigger client sync:", error);
  }
}

