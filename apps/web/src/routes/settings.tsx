import { useTranslation } from 'react-i18next';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ProfileTab } from './settings/ProfileTab';
import { NotificationsTab } from './settings/NotificationsTab';
import { CalendarTab } from './settings/CalendarTab';
import { ExternalNotificationsTab } from './settings/ExternalNotificationsTab';
import { PluginsTab } from './settings/PluginsTab';
import { DataExportTab } from './settings/DataExportTab';
import { UsersTab } from './settings/UsersTab';
import { JobsTab } from './settings/JobsTab';
import { SessionsTab } from './settings/SessionsTab';
import { useCurrentUser } from '@hously/shared';
import { cn } from '../lib/utils';
import { User, Bell, Calendar, Puzzle, Link2, Users, Database, Clock, ShieldCheck, type LucideIcon } from 'lucide-react';
import { usePrefetchRoute } from '../hooks/usePrefetchRoute';

export type Tab =
  | 'notifications'
  | 'profile'
  | 'calendar'
  | 'external-notifications'
  | 'plugins'
  | 'data-export'
  | 'jobs'
  | 'users'
  | 'sessions';

interface TabItem {
  id: Tab;
  label: string;
  icon: LucideIcon;
}

export function Settings() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const search = useSearch({ from: '/settings' });
  const { data: currentUser } = useCurrentUser();
  const prefetchRoute = usePrefetchRoute();
  const activeTab = (search.tab as Tab) || 'profile';

  const setActiveTab = (tab: Tab) => {
    navigate({ to: '/settings', search: { tab } });
  };

  const userTabs: TabItem[] = [
    { id: 'profile', label: t('settings.profile.title'), icon: User },
    { id: 'notifications', label: t('settings.notifications.title'), icon: Bell },
    { id: 'calendar', label: t('settings.calendar.title'), icon: Calendar },
  ];

  const adminTabs: TabItem[] = currentUser?.is_admin
    ? [
        { id: 'plugins', label: t('settings.plugins.title'), icon: Puzzle },
        { id: 'external-notifications', label: t('settings.externalNotifications.title'), icon: Link2 },
        { id: 'users', label: t('settings.users.title'), icon: Users },
        { id: 'sessions', label: t('settings.sessions.title'), icon: ShieldCheck },
        { id: 'jobs', label: t('settings.jobs.title'), icon: Clock },
        { id: 'data-export', label: t('settings.dataExport.title'), icon: Database },
      ]
    : [];

  const renderTab = (tab: TabItem) => (
    <div key={tab.id} className="relative">
      {activeTab === tab.id && (
        <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary-600 dark:bg-primary-400" />
      )}
      <button
        onClick={() => setActiveTab(tab.id)}
        onMouseEnter={() => prefetchRoute('/settings', { tab: tab.id })}
        className={cn(
          'w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
          activeTab === tab.id
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400'
            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
        )}
      >
        <tab.icon className="w-4 h-4 flex-shrink-0" />
        {tab.label}
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-neutral-50 dark:bg-neutral-900">
      {/* Mobile: select dropdown */}
      <div className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
        <select
          value={activeTab}
          onChange={e => setActiveTab(e.target.value as Tab)}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <optgroup label={t('settings.sections.account')}>
            {userTabs.map(tab => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </optgroup>
          {adminTabs.length > 0 && (
            <optgroup label={t('settings.sections.admin')}>
              {adminTabs.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Desktop: sidebar */}
      <aside className="hidden md:block w-64 flex-shrink-0 relative border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto">
          <div className="px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
            <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t('settings.title')}</h1>
          </div>
          <nav className="p-3">
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 px-3">
                {t('settings.sections.account')}
              </p>
              <div className="space-y-0.5">{userTabs.map(renderTab)}</div>
            </div>
            {adminTabs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1.5 px-3">
                  {t('settings.sections.admin')}
                </p>
                <div className="space-y-0.5">{adminTabs.map(renderTab)}</div>
              </div>
            )}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'external-notifications' && currentUser?.is_admin && <ExternalNotificationsTab />}
          {activeTab === 'plugins' && currentUser?.is_admin && <PluginsTab />}
          {activeTab === 'data-export' && currentUser?.is_admin && <DataExportTab />}
          {activeTab === 'users' && currentUser?.is_admin && <UsersTab />}
          {activeTab === 'sessions' && currentUser?.is_admin && <SessionsTab />}
          {activeTab === 'jobs' && currentUser?.is_admin && <JobsTab />}
        </div>
      </div>
    </div>
  );
}
