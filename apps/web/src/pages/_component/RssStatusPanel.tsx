import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Rss, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { LIBRARY_ENDPOINTS } from "@/lib/endpoints";
import type { RssStatusResponse } from "@hously/shared/types";

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useRssStatus() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.library.rssStatus(),
    queryFn: () => fetcher<RssStatusResponse>(LIBRARY_ENDPOINTS.RSS_STATUS),
    staleTime: 0,
    refetchInterval: 15_000,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(isoString: string): string {
  const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function formatCountdown(isoString: string): string {
  const diff = Math.round((new Date(isoString).getTime() - Date.now()) / 1000);
  if (diff <= 0) return "now";
  const mins = Math.floor(diff / 60);
  if (mins < 1) return `${diff}s`;
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `in ${hrs}h`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
      {children}
    </span>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function RssStatusPanel() {
  const { t } = useTranslation("common");
  const { data, isLoading } = useRssStatus();
  const lastRun = data?.last_run ?? null;
  const nextRunAt = data?.next_run_at ?? null;

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="w-1 h-4 rounded-full bg-orange-400 shrink-0" />
        <Rss
          className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
          strokeWidth={2}
        />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {t("dashboard.rss.title")}
        </h3>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Last run */}
        <div>
          <Kicker>{t("dashboard.rss.lastRun")}</Kicker>
          {isLoading && (
            <div className="mt-1.5 h-4 w-32 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          )}
          {!isLoading && !lastRun && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t("dashboard.rss.neverRan")}
            </p>
          )}
          {lastRun && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-700 dark:text-zinc-200 font-mono tabular-nums">
                  {formatRelative(lastRun.completed_at)}
                </span>
                {lastRun.status === "success" ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-2 py-0.5">
                    <CheckCircle2 size={10} />
                    {t("dashboard.rss.statusOk")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 rounded-full px-2 py-0.5">
                    <XCircle size={10} />
                    {t("dashboard.rss.statusError")}
                  </span>
                )}
              </div>
              {lastRun.status === "error" && lastRun.error && (
                <p
                  className="text-xs text-rose-600 dark:text-rose-400 truncate"
                  title={lastRun.error}
                >
                  {lastRun.error}
                </p>
              )}
              {lastRun.status === "success" && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("dashboard.rss.releasesFound", {
                    count: lastRun.releases_found,
                  })}
                  {lastRun.releases_grabbed > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-sky-600 dark:text-sky-400 font-medium">
                        {t("dashboard.rss.releasesGrabbed", {
                          count: lastRun.releases_grabbed,
                        })}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Per-indexer breakdown */}
        {lastRun && lastRun.indexers.length > 0 && (
          <div>
            <Kicker>{t("dashboard.rss.indexers")}</Kicker>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {lastRun.indexers.map((idx) => (
                <span
                  key={idx.name}
                  className="text-xs text-zinc-600 dark:text-zinc-300"
                >
                  <span className="font-medium">{idx.name}</span>
                  <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                    {" "}
                    {idx.releases_found}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Next run */}
        {nextRunAt && (
          <div>
            <Kicker>{t("dashboard.rss.nextRun")}</Kicker>
            <p className="mt-1 text-sm font-mono tabular-nums text-zinc-700 dark:text-zinc-200">
              {formatCountdown(nextRunAt)}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <Link
        to="/library"
        className="block px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors border-t border-zinc-100 dark:border-zinc-800 text-center"
      >
        {t("dashboard.rss.openLibraryLink")}
      </Link>
    </section>
  );
}
