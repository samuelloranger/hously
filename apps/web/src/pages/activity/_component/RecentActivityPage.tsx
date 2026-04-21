import { useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ListItemSkeleton } from "@/components/Skeleton";
import { useDashboardActivityFeed } from "@/pages/_component/useDashboardStats";
import { resolveDateFnsLocale } from "@/lib/utils/relativeTime";
import {
  getActivityPresentation,
  getActivityServiceLabel,
  getActivityTypeLabel,
} from "@/pages/activity/_component/activityPresentation";

const PAGE_SIZE = 25;

export function RecentActivityPage() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const search = useSearch({ from: "/activity/" });
  const locale = resolveDateFnsLocale(i18n.language);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const service = search.service?.trim() || undefined;
  const type = search.type?.trim() || undefined;

  const { data, isLoading, isFetching } = useDashboardActivityFeed({
    limit,
    service,
    type,
  });

  const activities = useMemo(() => {
    return (data?.activities ?? [])
      .map((activity) => getActivityPresentation(activity, t, locale))
      .filter((activity): activity is NonNullable<typeof activity> =>
        Boolean(activity),
      );
  }, [data?.activities, t, locale]);

  const hasFilters = Boolean(service || type);

  const updateFilters = (next: { service?: string; type?: string }) => {
    setLimit(PAGE_SIZE);
    navigate({
      to: "/activity",
      search: {
        service: next.service || "",
        type: next.type || "",
      },
    });
  };

  return (
    <PageLayout className="max-w-4xl">
      <PageHeader
        icon={Clock}
        iconColor="text-blue-600"
        title={t("dashboard.activityPage.title")}
        subtitle={t("dashboard.activityPage.subtitle")}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {t("dashboard.activityPage.serviceFilter")}
              </span>
              <Select
                value={service ?? ""}
                onValueChange={(value) =>
                  updateFilters({ service: value, type })
                }
              >
                <SelectTrigger
                  aria-label={t("dashboard.activityPage.serviceFilter")}
                >
                  <SelectValue
                    placeholder={t("dashboard.activityPage.allServices")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t("dashboard.activityPage.allServices")}
                  </SelectItem>
                  {(data?.available_services ?? []).map((value) => (
                    <SelectItem key={value} value={value}>
                      {getActivityServiceLabel(t, value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                {t("dashboard.activityPage.typeFilter")}
              </span>
              <Select
                value={type ?? ""}
                onValueChange={(value) =>
                  updateFilters({ service, type: value })
                }
              >
                <SelectTrigger
                  aria-label={t("dashboard.activityPage.typeFilter")}
                >
                  <SelectValue
                    placeholder={t("dashboard.activityPage.allTypes")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    {t("dashboard.activityPage.allTypes")}
                  </SelectItem>
                  {(data?.available_types ?? []).map((value) => (
                    <SelectItem key={value} value={value}>
                      {getActivityTypeLabel(t, value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-sm text-neutral-500 dark:text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {t("dashboard.activityPage.results", {
                shown: activities.length,
                total: data?.total ?? 0,
              })}
            </p>
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateFilters({})}
              >
                {t("dashboard.activityPage.clearFilters")}
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
                  <article
                    key={`${activity.type}-${activity.time}-${index}`}
                    className="p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
                        <activity.Icon className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">
                            {activity.description}
                          </p>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {activity.serviceLabel}
                          </span>
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                            {activity.typeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {data?.has_more ? (
                <div className="border-t border-neutral-200/70 p-4 dark:border-neutral-800">
                  <Button
                    onClick={() => setLimit((current) => current + PAGE_SIZE)}
                    disabled={isFetching}
                  >
                    {isFetching
                      ? t("common.loading")
                      : t("dashboard.activityPage.loadMore")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={Clock}
                title={t("dashboard.activityPage.emptyTitle")}
                description={
                  hasFilters
                    ? t("dashboard.activityPage.emptyFilteredDescription")
                    : t("dashboard.activityPage.emptyDescription")
                }
              />
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  );
}
