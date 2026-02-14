import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { clearUser } from '../lib/auth';
import { useLogout } from '../features/auth/hooks';
import { NotificationsMenu } from './NotificationsBell';
import { UserMenu } from './UserMenu';
import { CalendarIcon, Loader } from 'lucide-react';
import { usePrefetchRoute } from '../hooks/usePrefetchRoute';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  path: string;
  translationKey: string;
  icon: string;
}

export function Navbar() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const prefetchRoute = usePrefetchRoute();

  const navItems: NavItem[] = [
    {
      path: '/shopping',
      translationKey: 'nav.shopping',
      icon: '🛒',
    },
    { path: '/chores', translationKey: 'nav.chores', icon: '✅' },
    { path: '/kitchen', translationKey: 'nav.kitchen', icon: '🍳' },
  ];

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        mobileMenuButtonRef.current &&
        !mobileMenuButtonRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    try {
      // Get current subscription endpoint from service worker if available
      let subscriptionEndpoint: string | undefined;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            subscriptionEndpoint = subscription.endpoint;
            // Unsubscribe from service worker (client-side)
            try {
              await subscription.unsubscribe();
            } catch (error) {
              console.warn('Failed to unsubscribe from service worker on logout:', error);
              // Continue with logout even if unsubscribe fails
            }
          }
        } catch (error) {
          // Ignore errors when getting subscription - proceed with logout anyway
          console.warn('Could not get subscription endpoint for logout:', error);
        }
      }

      await logoutMutation.mutateAsync(subscriptionEndpoint);
      clearUser();
      navigate({ to: '/login' });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API call fails, clear local state and redirect
      clearUser();
      navigate({ to: '/login' });
    }
  };

  return (
    <>
      <div style={{ height: 'calc(64px + env(safe-area-inset-top, 0px))' }} />
      <nav className="fixed heading-safe-area top-0 left-0 right-0 z-50 bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700 theme-transition">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link
                  to="/"
                  className="text-2xl font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <img src="/icon-32.png" alt="" className="inline h-6 w-6 mr-2" />Hously
                </Link>
              </div>
              <div className="hidden lg:block ml-10">
                <div className="flex space-x-4">
                  {navItems.map(item => {
                    const isActive =
                      currentPath === item.path || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onMouseEnter={() => prefetchRoute(item.path)}
                        className={`nav-link py-2 text-sm font-medium whitespace-nowrap ${
                          isActive
                            ? 'text-primary-600 dark:text-primary-400 hover:dark:text-primary-600'
                            : 'text-black dark:text-neutral-300 hover:dark:text-white'
                        } hover:text-neutral-900 dark:hover:text-neutral-100 transition duration-200`}
                      >
                        <span className="mr-1">{item.icon}</span>
                        {t(item.translationKey)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2 sm:space-x-4">
              <NotificationsMenu />
              <Link
                to="/calendar"
                onMouseEnter={() => prefetchRoute('/calendar')}
                className="flex justify-center items-center relative p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg transition-colors"
                aria-label={t('calendar.title')}
              >
                <CalendarIcon className="h-5 w-5" />
              </Link>

              {!user ? (
                <div className="w-[40px] h-[40px] flex justify-center items-center text-neutral-500">
                  <Loader className="text-xl animate-spin" />
                </div>
              ) : (
                <UserMenu user={user} onLogout={handleLogout} />
              )}
            </div>
          </div>
        </div>

        <div
          className={`block lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            mobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
          }`}
          ref={mobileMenuRef}
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-neutral-50 dark:bg-neutral-700 theme-transition">
            {navItems.map((item, index) => {
              const isActive =
                currentPath === item.path || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  onTouchStart={() => prefetchRoute(item.path)}
                  className={`block px-3 py-2 text-base font-medium transition-all duration-200 transform hover:translate-x-1 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded-md ${
                    isActive
                      ? 'text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-600'
                      : 'text-neutral-500 dark:text-neutral-300'
                  } hover:text-primary-600 dark:hover:text-primary-400`}
                  style={{
                    animationDelay: mobileMenuOpen ? `${index * 50}ms` : '0ms',
                    animation: mobileMenuOpen ? 'fadeInSlide 0.3s ease-out forwards' : 'none',
                  }}
                >
                  <span className="mr-2">{item.icon}</span>
                  {t(item.translationKey)}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
