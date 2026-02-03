/**
 * Network status detection and management
 */

let isOnline = navigator.onLine;
let onlineListeners: Array<() => void> = [];
let offlineListeners: Array<() => void> = [];

/**
 * Initialize network status listeners
 */
export function initNetworkStatus(): void {
  // Listen to online/offline events
  window.addEventListener('online', () => {
    isOnline = true;
    onlineListeners.forEach((listener) => listener());
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    offlineListeners.forEach((listener) => listener());
  });
}

/**
 * Check if currently online
 */
export function getNetworkStatus(): boolean {
  return isOnline;
}

/**
 * Subscribe to online events
 */
export function onOnline(callback: () => void): () => void {
  onlineListeners.push(callback);
  return () => {
    onlineListeners = onlineListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Subscribe to offline events
 */
export function onOffline(callback: () => void): () => void {
  offlineListeners.push(callback);
  return () => {
    offlineListeners = offlineListeners.filter((cb) => cb !== callback);
  };
}

