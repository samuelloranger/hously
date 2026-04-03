import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";

import { PageTransition } from "@/components/PageTransition";
import { NotificationPermissionModal } from "@/components/NotificationPermissionModal";
import { QuickActionPalette } from "@/components/QuickActionPalette";
import { RouteDataRefetcher } from "@/components/RouteDataRefetcher";
import { useAuth } from "@/lib/auth/useAuth";
import { usePWA } from "@/lib/sw/usePWA";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAutoSubscribeNotifications } from "@/lib/notifications/useAutoSubscribeNotifications";
import { Toaster } from "sonner";
import { useRouterState, ScrollRestoration } from "@tanstack/react-router";
import { useState } from "react";

export function RootLayout() {
  const { user } = useAuth();
  const { isStandalone } = usePWA();
  const isMobile = useIsMobile();
  const { showModal, handleAllow, handleDismiss } =
    useAutoSubscribeNotifications();
  const router = useRouterState();
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  // Bottom nav is only shown when standalone AND mobile
  const showBottomNav = isStandalone && isMobile;
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
          className={`user min-h-full flex-1 flex flex-col ${showBottomNav ? "pb-24" : isSettings ? "pb-0" : "pb-10"}`}
        >
          <RouteDataRefetcher />
          <PageTransition />
        </main>
      </div>
      {user && <BottomNav />}
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
