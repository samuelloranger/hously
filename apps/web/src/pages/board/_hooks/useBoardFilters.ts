import { useMemo, useState } from "react";
import {
  BOARD_KANBAN_STATUSES,
  type BacklogSortOption,
  type BoardKanbanStatusApi,
  type BoardTask,
} from "@hously/shared/types";
import {
  type BoardFilters,
  EMPTY_FILTERS,
  applyFilters,
  hasActiveFilters,
} from "@/pages/board/_utils/filters";
import { sortBacklog } from "@/pages/board/_utils/sortBacklog";

export function useBoardFilters(
  columns: Record<BoardKanbanStatusApi, BoardTask[]>,
  allTasks: BoardTask[],
) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const active = hasActiveFilters(filters);

  // Backlog sort
  const [backlogSort, setBacklogSort] = useState<BacklogSortOption>("position");
  const [backlogSortDir, setBacklogSortDir] = useState<"asc" | "desc">("asc");

  const filteredKanbanColumns = useMemo(() => {
    if (!active) return columns;
    const result = {} as Record<BoardKanbanStatusApi, BoardTask[]>;
    for (const s of BOARD_KANBAN_STATUSES) {
      result[s] = applyFilters(columns[s], filters);
    }
    return result;
  }, [columns, filters, active]);

  const filteredBacklogTasks = useMemo(() => {
    const filtered = active ? applyFilters(allTasks, filters) : allTasks;
    return sortBacklog(filtered, backlogSort, backlogSortDir);
  }, [allTasks, filters, active, backlogSort, backlogSortDir]);

  return {
    showFilters,
    setShowFilters,
    filters,
    setFilters,
    hasActiveFilters: active,
    filteredKanbanColumns,
    filteredBacklogTasks,
    backlogSort,
    setBacklogSort,
    backlogSortDir,
    setBacklogSortDir,
  };
}

export { type BoardFilters, EMPTY_FILTERS } from "@/pages/board/_utils/filters";
