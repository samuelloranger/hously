import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Film, ChevronRight } from "lucide-react";
import { useLibraryStats } from "@/features/medias/hooks/useLibrary";
import { formatBytes } from "@/lib/utils/format";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80 last:border-0">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 shrink-0">
        {value}
      </span>
    </div>
  );
}

export function LibraryStatsPanel() {
  const { t } = useTranslation("common");
  const { data, isLoading, isError } = useLibraryStats();
  const stats = data?.stats;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
          <Film
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <SectionTitle>{t("dashboard.home.libraryStats.title")}</SectionTitle>
        </div>
        <Link
          to="/library"
          className="flex items-center gap-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline shrink-0"
        >
          {t("dashboard.home.libraryStats.openLibrary")}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="px-4 py-3">
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-8 rounded-md bg-zinc-100 dark:bg-zinc-800"
              />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <p className="py-2 text-sm text-rose-600 dark:text-rose-400 text-center">
            {t("dashboard.home.libraryStats.loadError")}
          </p>
        )}

        {!isLoading && !isError && stats && (
          <div>
            <KpiRow
              label={t("dashboard.home.libraryStats.totalMovies")}
              value={String(stats.total_movies)}
            />
            <KpiRow
              label={t("dashboard.home.libraryStats.totalShows")}
              value={String(stats.total_shows)}
            />
            <KpiRow
              label={t("dashboard.home.libraryStats.downloaded")}
              value={String(stats.downloaded)}
            />
            <KpiRow
              label={t("dashboard.home.libraryStats.wanted")}
              value={String(stats.wanted)}
            />
            <KpiRow
              label={t("dashboard.home.libraryStats.returningSeries")}
              value={String(stats.returning_series)}
            />
            <KpiRow
              label={t("dashboard.home.libraryStats.storageUsed")}
              value={formatBytes(stats.storage_used_bytes)}
            />
          </div>
        )}
      </div>
    </section>
  );
}
