import { Navbar } from "./Navbar";
import { BottomNav } from "./BottomNav";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { PageTransition } from "./PageTransition";
import { NotificationPermissionModal } from "./NotificationPermissionModal";
import { RouteDataRefetcher } from "./RouteDataRefetcher";
import { OfflineIndicator } from "./OfflineIndicator";
import { useAuth } from "../hooks/useAuth";
import { usePWA } from "../hooks/usePWA";
import { useIsMobile } from "../hooks/useIsMobile";
import { useAutoSubscribeNotifications } from "../hooks/useAutoSubscribeNotifications";
import { Toaster } from "sonner";
import { useRouterState } from "@tanstack/react-router";

export function RootLayout() {
  const { user } = useAuth();
  const { isStandalone } = usePWA();
  const isMobile = useIsMobile();
  const { showModal, handleAllow, handleDismiss } =
    useAutoSubscribeNotifications();
  const router = useRouterState();

  // Bottom nav is only shown when standalone AND mobile
  const showBottomNav = isStandalone && isMobile;
  const isSettings = router.location.pathname.startsWith("/settings");
  
  const shouldShowNavbar = !['/login'].includes(router.location.pathname);

  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <div className="text-neutral-500 dark:text-neutral-400">Loading...</div>
  //     </div>
  //   );
  // }

  return (
    <>
      {shouldShowNavbar && <Navbar />}
      <main
        className={`user min-h-full flex-1 flex flex-col ${`${
          showBottomNav ? "pb-24" : isSettings ? "pb-0" : "pb-10"
        }`}`}
      >
        <RouteDataRefetcher />
        <PageTransition />
      </main>
      {user && <BottomNav />}
      <OfflineIndicator />
      <PWAInstallBanner />
      <NotificationPermissionModal
        isOpen={showModal}
        onAllow={handleAllow}
        onDismiss={handleDismiss}
      />
      <Toaster position="top-center" richColors />
    </>
  );
}
