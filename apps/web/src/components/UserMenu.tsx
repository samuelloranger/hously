import { useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { formatDisplayName, type User, useUpdateProfile } from '@hously/shared';
import { useTheme } from '../hooks/useTheme';
import { usePWA } from '../hooks/usePWA';
import { cn } from '../lib/utils';
import { ChevronDown } from 'lucide-react';
import { usePrefetchRoute } from '../hooks/usePrefetchRoute';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

interface NavItem {
  path: string;
  translationKey: string;
  icon: string;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const { t, i18n } = useTranslation('common');
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const [isOpen, setIsOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { isStandalone } = usePWA();
  const updateProfile = useUpdateProfile();
  const prefetchRoute = usePrefetchRoute();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
  ];
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const navItems: NavItem[] = [
    { path: '/', translationKey: 'nav.dashboard', icon: '📊' },
    { path: '/shopping', translationKey: 'nav.shopping', icon: '🛒' },
    { path: '/chores', translationKey: 'nav.chores', icon: '✅' },
    { path: '/explore', translationKey: 'nav.explore', icon: '🧭' },
    { path: '/library', translationKey: 'nav.library', icon: '🎞️' },
    { path: '/torrents', translationKey: 'nav.torrents', icon: '🧲' },
  ];

  const toggleLanguage = () => {
    const nextLanguage = languages.find(lang => lang.code !== i18n.language) || languages[0];
    i18n.changeLanguage(nextLanguage.code);

    if (user) {
      updateProfile.mutate(
        { locale: nextLanguage.code },
        {
          onError: error => {
            console.debug('Failed to update locale on server:', error);
          },
        }
      );
    }
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  const initials = formatDisplayName(user).charAt(0).toUpperCase();

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex h-9 items-center gap-2 rounded-xl px-1.5 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
          aria-label={t('common.userMenu')}
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={formatDisplayName(user)}
              className="h-7 w-7 rounded-lg object-cover ring-1 ring-neutral-200/80 dark:ring-white/10"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-xs font-semibold text-primary-700 dark:text-primary-300">
              {initials}
            </div>
          )}
          <span className="hidden lg:block max-w-[100px] truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
            {formatDisplayName(user)}
          </span>
          <ChevronDown
            className={`hidden lg:block h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="min-w-[220px] w-56 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200/80 dark:border-neutral-700/60 z-50 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
          align="end"
          sideOffset={8}
          collisionPadding={16}
        >
          {/* Mobile nav items — hidden on desktop and PWA standalone */}
          <div
            className={cn(
              'py-2 px-2 border-b border-neutral-100 dark:border-neutral-700/60',
              isStandalone ? 'hidden' : 'block lg:hidden'
            )}
          >
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Navigation
            </p>
            <div className="grid grid-cols-3 gap-1">
              {navItems.map(item => {
                const isActive =
                  currentPath === item.path || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    style={{ touchAction: 'manipulation' }}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.04] active:bg-neutral-100 dark:active:bg-white/[0.08]'
                    }`}
                  >
                    <span className={`text-lg leading-none transition-transform ${isActive ? 'scale-110' : ''}`}>
                      {item.icon}
                    </span>
                    <span className="text-[10px] font-medium leading-none text-center w-full truncate">
                      {t(item.translationKey)}
                    </span>
                    {isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-500 opacity-0" />}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Preferences */}
          <div className="py-2 px-3 border-b border-neutral-100 dark:border-neutral-700/60">
            <button onClick={toggleLanguage} className="flex items-center justify-between w-full py-1.5 group">
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{t('common.language')}</span>
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                {currentLanguage.name}
              </span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-between w-full py-1.5 group"
              aria-label={t('common.toggleTheme')}
            >
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">{t('common.theme')}</span>
              <span className="text-sm transition-transform duration-200 group-hover:scale-110">
                {isDark ? '☀️' : '🌙'}
              </span>
            </button>
          </div>

          {/* Actions */}
          <div className="py-1.5 px-1.5">
            <Link
              to="/settings"
              search={{ tab: 'profile' }}
              onClick={() => setIsOpen(false)}
              onMouseEnter={() => prefetchRoute('/settings', { tab: 'profile' })}
              className={`flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-lg transition-colors ${
                currentPath === '/settings'
                  ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-white/[0.06]'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-sm">⚙️</span>
              {t('settings.title')}
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 text-sm rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <span className="text-sm">🚪</span>
              {t('nav.logout')}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
