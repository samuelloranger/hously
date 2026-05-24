import { useTranslation } from "react-i18next";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IndexerWarning } from "@hously/shared/types";

interface InteractiveSearchStatusStripProps {
  indexerWarnings: IndexerWarning[];
  dismissed: boolean;
  onDismiss: () => void;
  hiddenCount: number;
  hasViewOverrides: boolean;
  onResetView: () => void;
  visibleCount: number;
  totalReleases: number;
  isSearchMode: boolean;
  searchApiQuery: string;
  canToggleSearchTitle: boolean;
  isOriginalTitleQuery: boolean;
  onToggleSearchTitleVariant: () => void;
}

export function InteractiveSearchStatusStrip({
  indexerWarnings,
  dismissed,
  onDismiss,
  hiddenCount,
  hasViewOverrides,
  onResetView,
  visibleCount,
  totalReleases,
  isSearchMode,
  searchApiQuery,
  canToggleSearchTitle,
  isOriginalTitleQuery,
  onToggleSearchTitleVariant,
}: InteractiveSearchStatusStripProps) {
  const { t } = useTranslation("common");

  return (
    <>
      {indexerWarnings.length > 0 && !dismissed && (
        <div
          role="alert"
          className="mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700/40 dark:bg-amber-950/20"
        >
          <TriangleAlert
            size={15}
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="min-w-0 flex-1">
            <span className="font-medium text-amber-900 dark:text-amber-200">
              {indexerWarnings.length === 1
                ? t("medias.interactive.indexerWarning.single", {
                    name: indexerWarnings[0].name,
                  })
                : t("medias.interactive.indexerWarning.multiple", {
                    count: indexerWarnings.length,
                    names: indexerWarnings.map((w) => w.name).join(", "),
                  })}
            </span>
            <span className="ml-1 text-amber-700 dark:text-amber-300">
              {t("medias.interactive.indexerWarning.hint")}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-amber-500 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200"
            aria-label={t("medias.interactive.indexerWarning.dismiss")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Desktop results count + query pill — hidden on mobile (mobile uses drawer) */}
      {isSearchMode && searchApiQuery.length >= 2 && (
        <div className="mb-3 hidden flex-wrap items-center gap-x-2.5 gap-y-1 sm:flex">
          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            {t("medias.interactive.resultsVisible", {
              visible: visibleCount,
              total: totalReleases,
            })}
          </span>
          {hiddenCount > 0 && (
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {t("medias.interactive.hiddenCount", {
                count: hiddenCount,
              })}
            </span>
          )}
          {hasViewOverrides && (
            <button
              type="button"
              onClick={onResetView}
              className="text-xs font-medium text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
            >
              {t("medias.interactive.resetView")}
            </button>
          )}
          <span className="flex min-w-0 max-w-[260px] items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
            {canToggleSearchTitle ? (
              <button
                type="button"
                onClick={onToggleSearchTitleVariant}
                title={
                  isOriginalTitleQuery
                    ? t("medias.interactive.useLocalizedTitleHint")
                    : t("medias.interactive.useOriginalTitleHint")
                }
                className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1 rounded-md px-0.5 text-left transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
              >
                <span className="shrink-0 text-neutral-400">Search:</span>
                <span
                  className="truncate font-medium text-neutral-700 dark:text-neutral-200"
                  title={searchApiQuery}
                >
                  {searchApiQuery || "…"}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
                    isOriginalTitleQuery
                      ? "bg-amber-200/80 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                      : "bg-primary-200/70 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100",
                  )}
                >
                  {isOriginalTitleQuery
                    ? t("medias.interactive.titleBadgeOriginal")
                    : t("medias.interactive.titleBadgeLocalized")}
                </span>
              </button>
            ) : (
              <>
                <span className="shrink-0 text-neutral-400">Search:</span>
                <span
                  className="truncate font-medium text-neutral-700 dark:text-neutral-200"
                  title={searchApiQuery}
                >
                  {searchApiQuery || "…"}
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </>
  );
}
