import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Film, ChevronRight } from "lucide-react";
import { useLibraryStats } from "@/features/medias/hooks/useLibrary";
import { formatBytes } from "@/lib/utils/format";

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
          <Film
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {t("dashboard.home.libraryStats.title")}
          </h3>
        </div>
        <Link
          to="/library"
          className="flex items-center gap-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
          {t("dashboard.home.libraryStats.openLibrary")}
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="px-4 py-1">
        {isLoading && (
          <div className="space-y-2 py-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-5 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="py-6 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {t("dashboard.home.libraryStats.loadError")}
            </p>
          </div>
        )}

        {!isLoading && !isError && stats && (
          <>
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
          </>
        )}
      </div>
    </section>
  );
}
