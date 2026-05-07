import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CalendarDays, CheckSquare2, Flame } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { PageLayout } from "@/components/PageLayout";
import { useCurrentUser } from "@/lib/auth/useAuth";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import type { DashboardStats } from "@hously/shared/types";
import { getUserFirstName } from "@/lib/utils/format";
import { CardErrorBoundary } from "@/components/ErrorBoundary";
import { GreetingCard } from "@/pages/_component/GreetingCard";
import { DownloadsPanel } from "@/pages/_component/DownloadsPanel";
import { WeatherPanel } from "@/pages/_component/WeatherPanel";
import { HomeAssistantPanel } from "@/pages/_component/HomeAssistantPanel";
import { SystemPanel } from "@/pages/_component/system";
import { JellyfinShelf, UpcomingShelf } from "@/pages/_component/MediaShelves";
import { LibraryAttentionPanel } from "@/pages/_component/LibraryAttentionPanel";
import { LibraryStatsPanel } from "@/pages/_component/LibraryStatsPanel";
import { TrackersPanel } from "@/pages/_component/TrackersPanel";
import { RssStatusPanel } from "@/pages/_component/RssStatusPanel";
import { ChoresPanel, HabitsPanel } from "@/pages/_component/HomePanel";

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

  return (
    <PageLayout fullWidth>
      <div className="space-y-6">
        {/* Main layout: left stacked widgets / right tall column */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          {/* Left: stacked widgets */}
          <motion.div
            className="min-w-0 space-y-4"
            variants={columnVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div className="space-y-3" variants={panelVariants}>
              <GreetingCard
                userName={getUserFirstName(user, t("dashboard.user"))}
                pendingChores={stats?.chores_count}
                eventsToday={stats?.events_today}
              />
              <StatsRow stats={stats} isLoading={statsLoading} />
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <JellyfinShelf />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <UpcomingShelf />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <LibraryStatsPanel />
              </CardErrorBoundary>
            </motion.div>

            {user?.is_admin && (
              <motion.div variants={panelVariants}>
                <CardErrorBoundary>
                  <LibraryAttentionPanel />
                </CardErrorBoundary>
              </motion.div>
            )}

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <TrackersPanel />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <HabitsPanel />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <ChoresPanel />
              </CardErrorBoundary>
            </motion.div>
          </motion.div>

          {/* Right: weather + system + downloads + trackers */}
          <motion.div
            className="space-y-4"
            variants={columnVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <WeatherPanel />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <HomeAssistantPanel />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <SystemPanel />
              </CardErrorBoundary>
            </motion.div>

            {/* <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <UptimeKumaPanel />
              </CardErrorBoundary>
            </motion.div> */}

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                <DownloadsPanel />
              </CardErrorBoundary>
            </motion.div>

            <motion.div variants={panelVariants}>
              <CardErrorBoundary>
                {user?.is_admin && <RssStatusPanel />}
              </CardErrorBoundary>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
