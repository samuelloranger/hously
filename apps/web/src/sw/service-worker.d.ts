// Service Worker type definitions
/// <reference lib="webworker" />

// Prevent Window from being used (empty interface prevents accidental Window usage)
interface Window {
  // This prevents Window from being used in service worker context
}
