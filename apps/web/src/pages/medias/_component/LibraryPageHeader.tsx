import { Film, Tv, Plus, RefreshCw, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
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
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between">
      {/* Title + live stat pills */}
      <div className="flex flex-col gap-1.5 sm:gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-lg font-bold tracking-tight text-white">
            {t("medias.library.pageTitle")}
          </h1>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Film
                size={11}
                className="shrink-0 text-primary-400"
              />
              <span className="text-sm font-semibold tabular-nums text-neutral-200">
                {movieCount}
              </span>
              <span className="text-xs text-neutral-500">
                movies
              </span>
            </span>
            <span className="text-neutral-700 text-xs select-none">
              ·
            </span>
            <span className="flex items-center gap-1">
              <Tv
                size={11}
                className="shrink-0 text-primary-400"
              />
              <span className="text-sm font-semibold tabular-nums text-neutral-200">
                {showCount}
              </span>
              <span className="text-xs text-neutral-500">
                shows
              </span>
            </span>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          {t("medias.library.pageSubtitle")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddClick}
          className="flex flex-1 sm:flex-none h-8 items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          <Plus size={13} />
          {t("medias.detail.addToLibrary")}
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate({ to: "/library/downloads" })}
            className="flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            <Download size={13} />
            <span className="hidden sm:inline">
              {t("medias.library.downloadsImport")}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onRefresh}
          title="Refresh"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-500 hover:text-neutral-300 transition-colors",
            isLoading &&
              "animate-spin text-neutral-600 pointer-events-none",
          )}
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
}
