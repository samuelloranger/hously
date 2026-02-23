import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { clearUser } from '../lib/auth';
import { useLogout } from '@hously/shared';
import { NotificationsMenu } from './NotificationsBell';
import { UserMenu } from './UserMenu';
import { CalendarIcon, Clapperboard, CookingPot, ListChecks, Loader, Magnet, ShoppingCart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePrefetchRoute } from '../hooks/usePrefetchRoute';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  path: string;
  translationKey: string;
  icon: LucideIcon;
}

export function Navbar() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const prefetchRoute = usePrefetchRoute();

  const navItems: NavItem[] = [
    { path: '/medias', translationKey: 'nav.medias', icon: Clapperboard },
    { path: '/torrents', translationKey: 'nav.torrents', icon: Magnet },
    { path: '/shopping', translationKey: 'nav.shopping', icon: ShoppingCart },
    { path: '/chores', translationKey: 'nav.chores', icon: ListChecks },
    { path: '/kitchen', translationKey: 'nav.kitchen', icon: CookingPot },
  ];

  const handleLogout = async () => {
    try {
      let subscriptionEndpoint: string | undefined;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            subscriptionEndpoint = subscription.endpoint;
            try {
              await subscription.unsubscribe();
            } catch (error) {
              console.warn('Failed to unsubscribe from service worker on logout:', error);
            }
          }
        } catch (error) {
          console.warn('Could not get subscription endpoint for logout:', error);
        }
      }

      await logoutMutation.mutateAsync(subscriptionEndpoint);
      clearUser();
      navigate({ to: '/login' });
    } catch (error) {
      console.error('Logout error:', error);
      clearUser();
      navigate({ to: '/login' });
    }
  };

  return (
    <>
      <div style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))' }} />
      <nav className="fixed heading-safe-area top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-950/[0.06] dark:border-white/[0.08] theme-transition">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + Desktop Nav */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5 group" onMouseEnter={() => prefetchRoute('/')}>
                <img
                  src="/icon-32.png"
                  alt=""
                  className="h-7 w-7 transition-transform duration-200 group-hover:scale-110"
                />
                <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">Hously</span>
              </Link>

              <div className="hidden lg:flex items-center">
                <div className="flex items-center gap-0.5 rounded-xl bg-neutral-100 dark:bg-white/[0.06] p-1">
                  {navItems.map(item => {
                    const isActive =
                      currentPath === item.path || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onMouseEnter={() => prefetchRoute(item.path)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                          isActive
                            ? 'bg-white dark:bg-neutral-700/80 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                        }`}
                      >
                        <Icon size={15} />
                        {t(item.translationKey)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-0.5">
              <NotificationsMenu />

              <Link
                to="/calendar"
                onMouseEnter={() => prefetchRoute('/calendar')}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  currentPath === '/calendar'
                    ? 'bg-neutral-100 dark:bg-white/[0.08] text-neutral-900 dark:text-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
                aria-label={t('calendar.title')}
              >
                <CalendarIcon className="h-[18px] w-[18px]" />
              </Link>

              <div className="mx-1.5 h-5 w-px bg-neutral-200 dark:bg-white/[0.08]" />

              {!user ? (
                <div className="flex h-9 w-9 items-center justify-center text-neutral-400">
                  <Loader className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <UserMenu user={user} onLogout={handleLogout} />
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
