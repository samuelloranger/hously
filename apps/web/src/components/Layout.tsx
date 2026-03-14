import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

import { PageTransition } from './PageTransition';
import { NotificationPermissionModal } from './NotificationPermissionModal';
import { RouteDataRefetcher } from './RouteDataRefetcher';
import { useAuth } from '../hooks/useAuth';
import { usePWA } from '../hooks/usePWA';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAutoSubscribeNotifications } from '../hooks/useAutoSubscribeNotifications';
import { Toaster } from 'sonner';
import { useRouterState, ScrollRestoration } from '@tanstack/react-router';

export function RootLayout() {
  const { user } = useAuth();
  const { isStandalone } = usePWA();
  const isMobile = useIsMobile();
  const { showModal, handleAllow, handleDismiss } = useAutoSubscribeNotifications();
  const router = useRouterState();

  // Bottom nav is only shown when standalone AND mobile
  const showBottomNav = isStandalone && isMobile;
  const isSettings = router.location.pathname.startsWith('/settings');

  const shouldShowNav = !['/login'].includes(router.location.pathname);

  return (
    <>
      <ScrollRestoration />
      {shouldShowNav && <Sidebar />}
      <div className={shouldShowNav ? 'lg:pl-60' : ''}>
        <main
          className={`user min-h-full flex-1 flex flex-col ${
            showBottomNav ? 'pb-24' : isSettings ? 'pb-0' : 'pb-10'
          }`}
        >
          <RouteDataRefetcher />
          <PageTransition />
        </main>
      </div>
      {user && <BottomNav />}
      <NotificationPermissionModal isOpen={showModal} onAllow={handleAllow} onDismiss={handleDismiss} />
      <Toaster position="top-center" richColors />
    </>
  );
}
