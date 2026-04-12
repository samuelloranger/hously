import {
  createRootRouteWithContext,
  ScrollRestoration,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { PageTransition } from "@/components/PageTransition";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { QuickActionPalette } from "@/components/QuickActionPalette";
import { RouteDataRefetcher } from "@/components/RouteDataRefetcher";
import { useAutoSubscribeNotifications } from "@/lib/notifications/useAutoSubscribeNotifications";

export interface RouterContext {
  queryClient: QueryClient;
}

function RootLayout() {
  const { showModal, handleAllow, handleDismiss } =
    useAutoSubscribeNotifications();
  const router = useRouterState();
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const isSettings = router.location.pathname.startsWith("/settings");
  const shouldShowNav = !["/login"].includes(router.location.pathname);

  return (
    <>
      <ScrollRestoration />
      {shouldShowNav && (
        <Sidebar onOpenQuickActions={() => setIsQuickActionsOpen(true)} />
      )}
      <div className={shouldShowNav ? "lg:pl-60" : ""}>
        <main
          className={`user min-h-full flex-1 flex flex-col ${isSettings ? "pb-0" : "pb-10"}`}
        >
          <RouteDataRefetcher />
          <PageTransition />
        </main>
      </div>
      <QuickActionPalette
        isOpen={isQuickActionsOpen}
        onOpen={() => setIsQuickActionsOpen(true)}
        onClose={() => setIsQuickActionsOpen(false)}
      />
      <NotificationPermissionModal
        isOpen={showModal}
        onAllow={handleAllow}
        onDismiss={handleDismiss}
      />
      <Toaster position="top-center" richColors />
    </>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});
