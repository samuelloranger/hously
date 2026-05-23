import { Film, Tv, Plus, RefreshCw, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface LibraryPageHeaderProps {
  movieCount: number;
  showCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  onAddClick: () => void;
  isAdmin: boolean;
}

export function LibraryPageHeader({
  movieCount,
  showCount,
  isLoading,
  onRefresh,
  onAddClick,
  isAdmin,
}: LibraryPageHeaderProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
      {/* Title + live stat pills */}
      <div className="flex flex-col gap-1.5 sm:gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {t("medias.library.pageTitle")}
          </h1>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Film
                size={11}
                className="shrink-0 text-primary-500 dark:text-primary-400"
              />
              <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                {movieCount}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                movies
              </span>
            </span>
            <span className="text-neutral-300 dark:text-neutral-700 text-xs select-none">
              ·
            </span>
            <span className="flex items-center gap-1">
              <Tv
                size={11}
                className="shrink-0 text-primary-500 dark:text-primary-400"
              />
              <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                {showCount}
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                shows
              </span>
            </span>
          </div>
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {t("medias.library.pageSubtitle")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddClick}
          className="flex flex-1 sm:flex-none h-8 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          <Plus size={13} />
          {t("medias.detail.addToLibrary")}
        </button>

        {isAdmin && (
          <Link
            to="/library/downloads"
            className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <Download size={13} />
            <span className="hidden sm:inline">
              {t("medias.library.downloadsImport")}
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={onRefresh}
          title="Refresh"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors",
            isLoading &&
              "animate-spin text-neutral-300 dark:text-neutral-600 pointer-events-none",
          )}
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
}
