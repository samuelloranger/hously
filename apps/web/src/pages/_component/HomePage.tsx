import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CalendarDays, CheckSquare2, Flame } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { PageLayout } from "@/components/PageLayout";
import { CardErrorBoundary } from "@/components/ErrorBoundary";
import { useCurrentUser } from "@/lib/auth/useAuth";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import type { DashboardStats } from "@hously/shared/types";
import { getUserFirstName } from "@/lib/utils/format";
import { GreetingCard } from "@/pages/_component/GreetingCard";
import { WidgetEditWrapper } from "@/pages/_component/WidgetEditWrapper";
import {
  WIDGETS,
  getEffectiveLayout,
  moveWidgetInLayout,
} from "@hously/shared/constants";
import type {
  WidgetVisibility,
  WidgetLayout,
  WidgetId,
} from "@hously/shared/constants";
import {
  useAppSettings,
  useUpdateAppSettings,
} from "@/pages/settings/useAppSettings";
import { WIDGET_COMPONENTS } from "@/pages/_component/widgetComponents";

// ─── Motion variants ──────────────────────────────────────────────────────────

const columnVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({
  stats,
  isLoading,
}: {
  stats?: DashboardStats;
  isLoading?: boolean;
}) {
  const { t } = useTranslation("common");

  if (isLoading) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-4 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        <div
          className="h-4 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"
          style={{ animationDelay: "80ms" }}
        />
      </div>
    );
  }

  if (!stats) return null;

  const chips = [
    {
      href: "/calendar" as const,
      icon: <CalendarDays size={11} />,
      value: stats.events_today,
      label: t("dashboard.home.statsEventsToday", {
        count: stats.events_today,
      }),
      color: "hover:text-amber-600 dark:hover:text-amber-400",
    },
    {
      href: "/chores" as const,
      icon: <CheckSquare2 size={11} />,
      value: stats.chores_count,
      label: t("dashboard.home.statsChores", { count: stats.chores_count }),
      color: "hover:text-emerald-600 dark:hover:text-emerald-400",
    },
  ].filter((c) => c.value > 0);

  const streak = stats.habits_streak;

  if (chips.length === 0 && !streak) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          to={chip.href}
          className={`flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 transition-colors ${chip.color}`}
        >
          {chip.icon}
          <span className="font-mono font-semibold tabular-nums">
            {chip.value}
          </span>
          <span>{chip.label}</span>
        </Link>
      ))}
      {streak > 0 && (
        <span className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
          <Flame size={11} className="text-orange-400" />
          <span className="font-mono font-semibold tabular-nums text-orange-500">
            {t("dashboard.home.streakDays", { count: streak })}
          </span>
          <span>{t("dashboard.home.streakLabel")}</span>
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function HomePage() {
  const { t } = useTranslation("common");
  const { data: user } = useCurrentUser();
  const { data: statsData, isPending: statsLoading } = useDashboardStats();
  const stats = statsData?.stats;

  const { data } = useAppSettings();
  const updateMut = useUpdateAppSettings();
  const visibility =
    data?.settings.dashboard_widget_visibility ?? ({} as WidgetVisibility);
  const isAdmin = !!user?.is_admin;

  const [isEditMode, setIsEditMode] = useState(false);

  const [layout, setLayout] = useState<WidgetLayout>(() =>
    getEffectiveLayout(data?.settings.dashboard_widget_layout ?? null),
  );

  useEffect(() => {
    if (updateMut.isPending) return;
    setLayout(
      getEffectiveLayout(data?.settings.dashboard_widget_layout ?? null),
    );
  }, [data?.settings.dashboard_widget_layout, updateMut.isPending]);

  function isWidgetVisible(id: WidgetId): boolean {
    const w = WIDGETS.find((w) => w.id === id);
    return !!(w && (!w.adminOnly || isAdmin) && visibility[id] !== false);
  }

  function moveWidget(id: WidgetId, direction: "up" | "down") {
    const next = moveWidgetInLayout(layout, id, direction, isWidgetVisible);
    setLayout(next);
    updateMut.mutate({ dashboard_widget_layout: next });
  }

  const allVisibleIds = layout.flatMap((col) => col.filter(isWidgetVisible));

  const widgetColumns = layout.map((col) =>
    col.filter(isWidgetVisible).map((id) => {
      const Component = WIDGET_COMPONENTS[id];
      const visibleIdx = allVisibleIds.indexOf(id);
      const isFirst = visibleIdx === 0;
      const isLast = visibleIdx === allVisibleIds.length - 1;
      return (
        <motion.div key={id} variants={panelVariants}>
          <CardErrorBoundary>
            {isEditMode ? (
              <WidgetEditWrapper
                onMoveUp={() => moveWidget(id, "up")}
                onMoveDown={() => moveWidget(id, "down")}
                canMoveUp={!isFirst}
                canMoveDown={!isLast}
              >
                <Component />
              </WidgetEditWrapper>
            ) : (
              <Component />
            )}
          </CardErrorBoundary>
        </motion.div>
      );
    }),
  );

  return (
    <PageLayout fullWidth>
      <div className="space-y-4">
        {/* 3-column widget layout:
            <768px  → single column
            768–999px → 2 columns (col1 left, col2+col3 stacked right)
            1000px+ → 3 equal columns */}
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          {/* Column 1 — GreetingCard always first, non-movable */}
          <motion.div
            className="flex flex-col gap-4 flex-1 min-w-0"
            variants={columnVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={panelVariants} className="space-y-3">
              <GreetingCard
                userName={getUserFirstName(user, t("dashboard.user"))}
                pendingChores={stats?.chores_count}
                eventsToday={stats?.events_today}
                isEditMode={isEditMode}
                onToggleEditMode={() => setIsEditMode((v) => !v)}
              />
              <StatsRow stats={stats} isLoading={statsLoading} />
            </motion.div>
            {widgetColumns[0]}
          </motion.div>

          {/* Columns 2 + 3: stacked at 768–999px, side-by-side at 1000px+ */}
          <div className="flex flex-col min-[1000px]:flex-row gap-4 [flex:2_1_0%] min-w-0">
            {/* Column 2 */}
            <motion.div
              className="flex flex-col gap-4 flex-1 min-w-0"
              variants={columnVariants}
              initial="hidden"
              animate="show"
            >
              {widgetColumns[1]}
            </motion.div>

            {/* Column 3 */}
            <motion.div
              className="flex flex-col gap-4 flex-1 min-w-0"
              variants={columnVariants}
              initial="hidden"
              animate="show"
            >
              {widgetColumns[2]}
            </motion.div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
