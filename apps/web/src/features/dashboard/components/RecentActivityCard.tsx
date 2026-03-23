import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardActivities, resolveDateFnsLocale } from '@hously/shared';
import { ListItemSkeleton } from '@/components/Skeleton';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';
import { getActivityPresentation } from '../activityPresentation';

export function RecentActivityCard() {
  const { t, i18n } = useTranslation('common');
  const { data: activitiesData, isLoading } = useDashboardActivities(10);
  const prefetchIntent = usePrefetchIntent('/activity');

  const rawActivities = activitiesData?.activities || [];
  const locale = resolveDateFnsLocale(i18n.language);

  const activities = useMemo(() => {
    return rawActivities
      .map(activity => getActivityPresentation(activity, t, locale))
      .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity))
      .filter(activity => activity.description.trim().length > 0);
  }, [rawActivities, t, locale]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-200/80 dark:border-blue-700/40 bg-gradient-to-br from-[#eff6ff] via-[#e8f1ff] to-[#dbeafe] dark:from-blue-950/50 dark:via-sky-950/35 dark:to-blue-900/25 shadow-sm">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-blue-200/60 dark:border-blue-700/50">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-200/80 dark:bg-blue-800/40 text-[10px]">
            ⏰
          </div>
          <h3 className="text-[11px] font-semibold text-blue-950 dark:text-white">{t('dashboard.recentActivity')}</h3>
        </div>
        <Link
          to="/activity"
          search={{ service: '', type: '' }}
          {...prefetchIntent}
          className="text-[11px] font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {t('dashboard.activityPage.viewAll')}
        </Link>
      </div>
      <div className="p-3.5">
        <div className="space-y-3">
          {isLoading ? (
            <>
              <ListItemSkeleton />
              <ListItemSkeleton />
              <ListItemSkeleton />
            </>
          ) : activities.length > 0 ? (
            activities.map((activity, index) => (
              <div
                key={`${activity.type}-${activity.service}-${activity.time}-${index}`}
                className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-blue-100/60 dark:hover:bg-blue-900/20"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40 text-[10px]">
                  {activity.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-blue-950 dark:text-blue-100">{activity.description}</p>
                  <p className="text-[11px] text-blue-500/70 dark:text-blue-400/60 mt-0.5">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <span className="text-lg text-blue-300 dark:text-blue-700 mb-3 block">⏰</span>
              <p className="text-blue-700/70 dark:text-blue-300/70 text-xs">{t('dashboard.noRecentActivity')}</p>
              <p className="text-[11px] text-blue-500/60 dark:text-blue-400/50 mt-1">{t('dashboard.startUsing')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
