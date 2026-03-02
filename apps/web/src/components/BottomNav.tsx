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
    { path: '/', translationKey: 'nav.dashboard', icon: '📊' },
    { path: '/shopping', translationKey: 'nav.shopping', icon: '🛒' },
    { path: '/chores', translationKey: 'nav.chores', icon: '✅' },
    { path: '/kitchen', translationKey: 'nav.kitchen', icon: '🍳' },
    { path: '/explore', translationKey: 'nav.explore', icon: '🧭' },
    { path: '/library', translationKey: 'nav.library', icon: '🎞️' },
    { path: '/torrents', translationKey: 'nav.torrents', icon: '🧲' },
  ];

  // Only show bottom nav when app is installed AND on mobile device
  if (!isStandalone || !isMobile) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
    >
      <div className="flex items-stretch rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-neutral-200/70 dark:border-white/[0.07] shadow-2xl shadow-black/[0.15] overflow-hidden">
        {navItems.map(item => {
          const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
          return (
            <Link
              key={item.path}
              to={item.path}
              onMouseEnter={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
              style={{ width: `calc(100% / ${navItems.length})`, touchAction: 'manipulation' }}
              className={`flex flex-col items-center justify-center h-[58px] gap-1 relative transition-all duration-200 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-neutral-400 dark:text-neutral-500 active:bg-neutral-100/80 dark:active:bg-white/[0.05]'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-2 right-2 h-[2px] rounded-b-full bg-indigo-500 dark:bg-indigo-400" />
              )}
              <span
                className={`text-[17px] leading-none transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[9px] font-semibold leading-none truncate w-full text-center px-0.5 transition-colors ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {t(item.translationKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
