import { useTranslation } from 'react-i18next';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ProfileTab } from './settings/ProfileTab';
import { NotificationsTab } from './settings/NotificationsTab';
import { CalendarTab } from './settings/CalendarTab';
import { ExternalNotificationsTab } from './settings/ExternalNotificationsTab';
import { PluginsTab } from './settings/PluginsTab';
import { DataExportTab } from './settings/DataExportTab';
import { DevelopmentTab } from './settings/DevelopmentTab';
import { UsersTab } from './settings/UsersTab';
import { useCurrentUser } from '../features/auth/hooks';
import { cn } from '../lib/utils';

export type Tab =
  | 'notifications'
  | 'profile'
  | 'calendar'
  | 'external-notifications'
  | 'plugins'
  | 'data-export'
  | 'development'
  | 'users';

export function Settings() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const search = useSearch({ from: '/settings' });
  const { data: currentUser } = useCurrentUser();
  const activeTab = (search.tab as Tab) || 'profile';

  const setActiveTab = (tab: Tab) => {
    navigate({
      to: '/settings',
      search: { tab },
    });
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    {
      id: 'profile',
      label: t('settings.profile.title'),
      icon: '👤',
    },
    {
      id: 'notifications',
      label: t('settings.notifications.title'),
      icon: '🔔',
    },
    {
      id: 'calendar',
      label: t('settings.calendar.title'),
      icon: '📅',
    },
    // Only show admin tabs to admins
    ...(currentUser?.is_admin
      ? [
          {
            id: 'external-notifications' as Tab,
            label: t('settings.externalNotifications.title'),
            icon: '🔗',
          },
          {
            id: 'users' as Tab,
            label: t('settings.users.title'),
            icon: '👥',
          },
          {
            id: 'plugins' as Tab,
            label: t('settings.plugins.title'),
            icon: '🧩',
          },
          {
            id: 'development' as Tab,
            label: t('settings.development.title'),
            icon: '🔧',
          },
          {
            id: 'data-export' as Tab,
            label: t('settings.dataExport.title'),
            icon: '💾',
          },
        ]
      : []),
  ];

  return (
    <div className="h-full flex-1 flex flex-col md:flex-row min-h-full bg-neutral-50 dark:bg-neutral-900 w-full">
      {/* Sidebar - Vertical Menu */}
      <aside className="w-full md:w-64 flex-shrink-0 relative border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800">
        <div className="sticky top-[64px]">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('settings.title')}</h1>
          </div>
          <nav className="px-4 pt-0 pb-6 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700/50'
                )}
              >
                <span className="mr-3 text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'external-notifications' && currentUser?.is_admin && <ExternalNotificationsTab />}
          {activeTab === 'plugins' && currentUser?.is_admin && <PluginsTab />}
          {activeTab === 'data-export' && currentUser?.is_admin && <DataExportTab />}
          {activeTab === 'users' && currentUser?.is_admin && <UsersTab />}
          {activeTab === 'development' && currentUser?.is_admin && <DevelopmentTab />}
        </div>
      </div>
    </div>
  );
}
