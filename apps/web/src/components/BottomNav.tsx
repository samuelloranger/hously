import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { usePWA } from '../hooks/usePWA';
import { useIsMobile } from '../hooks/useIsMobile';
import { usePrefetchRoute } from '../hooks/usePrefetchRoute';

interface NavItem {
  path: string;
  translationKey: string;
  icon: string;
}

export function BottomNav() {
  const { t } = useTranslation('common');
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const { isStandalone } = usePWA();
  const isMobile = useIsMobile();
  const prefetchRoute = usePrefetchRoute();

  const navItems: NavItem[] = [
    {
      path: '/',
      translationKey: 'nav.dashboard',
      icon: '📊',
    },
    {
      path: '/shopping',
      translationKey: 'nav.shopping',
      icon: '🛒',
    },
    { path: '/chores', translationKey: 'nav.chores', icon: '✅' },
    { path: '/kitchen', translationKey: 'nav.kitchen', icon: '🍳' },
    { path: '/medias', translationKey: 'nav.medias', icon: '🎞️' },
    { path: '/torrents', translationKey: 'nav.torrents', icon: '🧲' },
  ];

  // Only show bottom nav when app is installed AND on mobile device
  if (!isStandalone || !isMobile) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 theme-transition pt-0! pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-16 px-2 py-2">
        {navItems.map(item => {
          const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
          return (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
              style={{
                width: `calc(100% / ${navItems.length})`,
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full rounded-lg transition-colors duration-200 ${
                isActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500 dark:text-neutral-400'
              } hover:text-neutral-900 dark:hover:text-neutral-100 active:bg-neutral-100 dark:active:bg-neutral-700`}
            >
              <span className="text-sm mb-1">{item.icon}</span>
              <span className="text-[10px] font-medium truncate w-full text-center">{t(item.translationKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
