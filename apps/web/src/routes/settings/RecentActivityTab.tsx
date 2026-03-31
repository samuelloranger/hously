import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { ListItemSkeleton } from '@/components/Skeleton';
import { useDashboardActivityFeed, resolveDateFnsLocale } from '@hously/shared';
import {
  getActivityPresentation,
  getActivityServiceLabel,
  getActivityTypeLabel,
} from '@/features/dashboard/activityPresentation';

const PAGE_SIZE = 25;

export function RecentActivityTab() {
  const { t, i18n } = useTranslation('common');
  const locale = resolveDateFnsLocale(i18n.language);
  const [service, setService] = useState('');
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useDashboardActivityFeed({
    limit,
    service: service || undefined,
    type: type || undefined,
  });

  const activities = useMemo(() => {
    return (data?.activities ?? [])
      .map(activity => getActivityPresentation(activity, t, locale))
      .filter((activity): activity is NonNullable<typeof activity> => Boolean(activity));
  }, [data?.activities, locale, t]);

  const hasFilters = Boolean(service || type);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('settings.activity.title')}
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t('settings.activity.description')}</p>
      </div>

      <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {t('dashboard.activityPage.serviceFilter')}
            </span>
            <Select
              value={service}
              onChange={event => {
                setLimit(PAGE_SIZE);
                setService(event.target.value);
              }}
            >
              <option value="">{t('dashboard.activityPage.allServices')}</option>
              {(data?.available_services ?? []).map(value => (
                <option key={value} value={value}>
                  {getActivityServiceLabel(t, value)}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {t('dashboard.activityPage.typeFilter')}
            </span>
            <Select
              value={type}
              onChange={event => {
                setLimit(PAGE_SIZE);
                setType(event.target.value);
              }}
            >
              <option value="">{t('dashboard.activityPage.allTypes')}</option>
              {(data?.available_types ?? []).map(value => (
                <option key={value} value={value}>
                  {getActivityTypeLabel(t, value)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-500 dark:text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('dashboard.activityPage.results', { shown: activities.length, total: data?.total ?? 0 })}</p>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLimit(PAGE_SIZE);
                setService('');
                setType('');
              }}
            >
              {t('dashboard.activityPage.clearFilters')}
            </Button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
        {isLoading ? (
          <div className="space-y-3 p-4">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : activities.length > 0 ? (
          <>
            <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {activities.map((activity, index) => (
                <article key={`${activity.type}-${activity.time}-${index}`} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg dark:bg-neutral-800">
                      {activity.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{activity.description}</p>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {activity.serviceLabel}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                          {activity.typeLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{activity.time}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {data?.has_more ? (
              <div className="border-t border-neutral-200/70 p-4 dark:border-neutral-800">
                <Button onClick={() => setLimit(current => current + PAGE_SIZE)} disabled={isFetching}>
                  {isFetching ? t('common.loading') : t('dashboard.activityPage.loadMore')}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="p-6">
            <EmptyState
              icon="⏰"
              title={t('dashboard.activityPage.emptyTitle')}
              description={
                hasFilters
                  ? t('dashboard.activityPage.emptyFilteredDescription')
                  : t('dashboard.activityPage.emptyDescription')
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}
