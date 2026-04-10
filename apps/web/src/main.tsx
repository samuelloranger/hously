import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FetcherProvider } from "@/lib/api/context";
import { router } from "@/router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { checkVersionAndReload } from "@/lib/version";
import { registerServiceWorker } from "@/lib/sw/registration";
import { useAutoInvalidateNotifications } from "@/lib/notifications/useAutoInvalidateNotifications";
import { useIOSImprovements } from "@/hooks/app/useIOSImprovements";
import { NotificationToastContainer } from "@/components/NotificationToastContainer";
import { setQueryClient } from "@/lib/api/queryClient";
import { webFetcher } from "@/lib/api/fetcher";
import "./lib/i18n/index";
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

// Component to handle service worker query invalidation and iOS improvements
function AppWithServiceWorkerIntegration() {
  useAutoInvalidateNotifications();
  useIOSImprovements();

  return (
    <>
      <RouterProvider router={router} context={{ queryClient }} />
      <NotificationToastContainer />
    </>
  );
}

// Register service worker for push notifications
registerServiceWorker();

// Render immediately to avoid blank screens if optional bootstrapping hangs.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FetcherProvider fetcher={webFetcher}>
          <AppWithServiceWorkerIntegration />
        </FetcherProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Run bootstrapping tasks in the background.
void checkVersionAndReload();
