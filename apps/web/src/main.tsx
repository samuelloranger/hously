import { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { checkVersionAndReload } from "./lib/version";
import { registerServiceWorker } from "./lib/serviceWorker";
import { useAutoInvalidateNotifications } from "./hooks/useAutoInvalidateNotifications";
import { useIOSImprovements } from "./hooks/useIOSImprovements";
import { initDB } from "./lib/offline/db";
import { initNetworkStatus } from "./lib/offline/networkStatus";
import { restoreQueryCache } from "./lib/offline/queryPersistence";
import { triggerSync } from "./lib/offline/backgroundSync";
import { setQueryClient } from "./lib/queryClient";
import "./lib/i18n";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Only refetch if data is stale
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 30 * 1000, // Data stays fresh for 30 seconds - prevents flashing on navigation
      gcTime: 5 * 60 * 1000, // Keep unused data in cache for 5 minutes - instant back navigation
    },
  },
});

// Export queryClient instance for use outside React components
setQueryClient(queryClient);

// Initialize offline features
async function initOfflineFeatures() {
  try {
    // Initialize IndexedDB
    await initDB();

    // Initialize network status listeners
    initNetworkStatus();

    // Restore query cache from IndexedDB
    await restoreQueryCache(queryClient);

    // Set up periodic query persistence (save cache every 30 seconds)
    setInterval(() => {
      import("./lib/offline/queryPersistence").then(({ persistQueryCache }) => {
        persistQueryCache(queryClient).catch((error) => {
          console.error("Failed to persist query cache:", error);
        });
      });
    }, 30000);

    // Try to sync any pending mutations
    await triggerSync();

    console.log("Offline features initialized");
  } catch (error) {
    console.error("Failed to initialize offline features:", error);
  }
}

// Component to handle service worker query invalidation and iOS improvements
function AppWithServiceWorkerIntegration() {
  useAutoInvalidateNotifications();
  useIOSImprovements();

  // Listen for sync messages from service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "sync-mutations") {
          // Trigger sync when service worker requests it
          triggerSync().catch((error) => {
            console.error("Failed to sync mutations:", error);
          });
        }
      });
    }
  }, []);

  // Listen for online events to trigger sync
  useEffect(() => {
    const handleOnline = () => {
      triggerSync().catch((error) => {
        console.error("Failed to sync on reconnect:", error);
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return <RouterProvider router={router} />;
}

// Register service worker for push notifications
registerServiceWorker();

// Initialize offline features and then render the app
Promise.all([initOfflineFeatures(), checkVersionAndReload()]).then(
  ([_, reloadTriggered]) => {
    // Only render if version check didn't trigger a reload
    if (!reloadTriggered) {
      ReactDOM.createRoot(document.getElementById("root")!).render(
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <AppWithServiceWorkerIntegration />
          </QueryClientProvider>
        </StrictMode>
      );
    }
  }
);
