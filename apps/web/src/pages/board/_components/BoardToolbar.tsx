import { useTranslation } from "react-i18next";
import { Archive, Filter, LayoutGrid, List, Plus } from "lucide-react";
import {
  BACKLOG_SORT_OPTIONS,
  type BacklogSortOption,
} from "@hously/shared/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SORT_LABELS } from "@/pages/board/_utils/sortBacklog";
import type { ViewMode } from "@/pages/board/_hooks/useBoardCreateForm";

interface BoardToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  backlogCount: number;
  // Filter
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onToggleFilters: () => void;
  // Backlog sort
  backlogSort: BacklogSortOption;
  onBacklogSortChange: (sort: BacklogSortOption) => void;
  backlogSortDir: "asc" | "desc";
  onBacklogSortDirToggle: () => void;
  // Create
  onCreateToggle: () => void;
}

export function BoardToolbar({
  viewMode,
  onViewModeChange,
  backlogCount,
  hasActiveFilters,
  activeFilterCount,
  onToggleFilters,
  backlogSort,
  onBacklogSortChange,
  backlogSortDir,
  onBacklogSortDirToggle,
  onCreateToggle,
}: BoardToolbarProps) {
  const { t } = useTranslation("common");

  return (
    <div className="mb-4 flex items-center gap-2">
      {/* View toggle */}
      <div className="flex rounded-lg border border-neutral-200/80 bg-neutral-100/60 p-0.5 dark:border-neutral-700/60 dark:bg-neutral-800/60">
        <button
          onClick={() => onViewModeChange("board")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "board"
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Board
        </button>
        <button
          onClick={() => onViewModeChange("backlog")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "backlog"
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
          )}
        >
          <List className="h-3.5 w-3.5" />
          Backlog
          {backlogCount > 0 && (
            <span className="rounded-full bg-neutral-200/80 px-1.5 py-px text-[10px] text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
              {backlogCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onViewModeChange("archive")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "archive"
              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </button>
      </div>

      <div className="flex-1" />

      {/* Backlog sort */}
      {viewMode === "backlog" && (
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-900/40">
          <span className="text-[11px] font-medium text-neutral-400">
            Sort:
          </span>
          <select
            value={backlogSort}
            onChange={(e) =>
              onBacklogSortChange(e.target.value as BacklogSortOption)
            }
            className="bg-transparent text-[12px] font-medium text-neutral-700 outline-none dark:text-neutral-200"
          >
            {BACKLOG_SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {SORT_LABELS[opt]}
              </option>
            ))}
          </select>
          <button
            onClick={onBacklogSortDirToggle}
            className="ml-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            title={backlogSortDir === "asc" ? "Ascending" : "Descending"}
          >
            {backlogSortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      )}

      {/* Filter toggle */}
      <button
        onClick={onToggleFilters}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          hasActiveFilters
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700/60 dark:bg-indigo-900/20 dark:text-indigo-300"
            : "border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700/60",
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        Filters
        {hasActiveFilters && (
          <span className="rounded-full bg-indigo-600 px-1.5 py-px text-[10px] text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Add task */}
      <Button
        onClick={onCreateToggle}
        className="h-8 gap-1.5 bg-indigo-600 px-3 text-xs hover:bg-indigo-700"
      >
        <Plus className="h-3.5 w-3.5" />
        {t("board.newTask", "New task")}
      </Button>
    </div>
  );
}
