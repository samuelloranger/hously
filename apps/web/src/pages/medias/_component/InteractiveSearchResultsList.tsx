import { useTranslation } from "react-i18next";
import { RefreshCw, TriangleAlert } from "lucide-react";
import type { InteractiveReleaseItem } from "@hously/shared/types";
import { ReleaseCard } from "./ReleaseCard";
import { Button } from "@/components/ui/button";

interface InteractiveSearchResultsListProps {
  releases: InteractiveReleaseItem[];
  isLoading: boolean;
  needsSearchQuery: boolean;
  errorMessage: string | null;
  grabBusy: boolean;
  pendingReleaseKey: string | null;
  grabbedTitles: Set<string>;
  onDownload: (release: InteractiveReleaseItem) => void;
  onRefetch: () => void;
  totalReleases: number;
  isError: boolean;
  onResetView: () => void;
}

export function InteractiveSearchResultsList({
  releases,
  isLoading,
  needsSearchQuery,
  errorMessage,
  grabBusy,
  pendingReleaseKey,
  grabbedTitles,
  onDownload,
  onRefetch,
  totalReleases,
  isError,
  onResetView,
}: InteractiveSearchResultsListProps) {
  const { t } = useTranslation("common");

  return (
    <div className="pt-4">
      {needsSearchQuery ? (
        <div className="flex h-full items-center justify-center py-8">
          <div className="max-w-md text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("medias.interactive.minQuery")}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex h-full items-center justify-center py-8">
          <div className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("medias.interactive.loading")}
          </div>
        </div>
      ) : isError ? (
        <div className="flex h-full items-center justify-center py-8">
          <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-700/40 dark:bg-amber-950/20">
            <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <TriangleAlert size={18} />
            </div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t("medias.interactive.errorTitle")}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {errorMessage ?? t("medias.interactive.errorDescription")}
            </p>
            <Button type="button" onClick={onRefetch} className="mt-4 gap-2">
              <RefreshCw size={14} />
              {t("medias.interactive.retry")}
            </Button>
          </div>
        </div>
      ) : releases.length === 0 ? (
        <div className="flex h-full items-center justify-center py-8">
          <div className="max-w-md text-center">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              {totalReleases > 0
                ? t("medias.interactive.noMatches")
                : t("medias.interactive.empty")}
            </p>
            {totalReleases > 0 && (
              <button
                type="button"
                onClick={onResetView}
                className="mt-3 text-sm font-medium text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
              >
                {t("medias.interactive.resetView")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="space-y-2">
            {releases.map((release) => {
              const releaseKey = `${release.guid}-${release.indexer_id ?? "x"}`;
              return (
                <ReleaseCard
                  key={releaseKey}
                  release={release}
                  onDownload={() => void onDownload(release)}
                  isDownloading={pendingReleaseKey === releaseKey}
                  isBusy={grabBusy}
                  alreadyGrabbed={grabbedTitles.has(
                    release.title.trim().toLowerCase(),
                  )}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
