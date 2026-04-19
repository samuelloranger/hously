import { localDateYmd } from "@hously/shared/utils/date";
import type { BoardTask, BoardTaskPriorityApi } from "@hously/shared/types";

export interface BoardFilters {
  tags: number[];
  assigneeId: number | null;
  priority: BoardTaskPriorityApi | null;
  dueDateFilter: "overdue" | "this_week" | null;
}

export const EMPTY_FILTERS: BoardFilters = {
  tags: [],
  assigneeId: null,
  priority: null,
  dueDateFilter: null,
};

export function applyFilters(
  tasks: BoardTask[],
  filters: BoardFilters,
): BoardTask[] {
  return tasks.filter((task) => {
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assigneeId !== null && task.assignee_id !== filters.assigneeId)
      return false;
    if (
      filters.tags.length > 0 &&
      !filters.tags.every((id) => task.tags.some((t) => t.id === id))
    )
      return false;
    if (filters.dueDateFilter) {
      const todayYmd = localDateYmd();
      const dueYmd = task.due_date ?? null;
      if (filters.dueDateFilter === "overdue") {
        if (!dueYmd || dueYmd >= todayYmd) return false;
      } else if (filters.dueDateFilter === "this_week") {
        const nextWeekYmd = localDateYmd(
          undefined,
          new Date(Date.now() + 7 * 86400000),
        );
        if (!dueYmd || dueYmd < todayYmd || dueYmd > nextWeekYmd) return false;
      }
    }
    return true;
  });
}

export function hasActiveFilters(filters: BoardFilters): boolean {
  return (
    filters.tags.length > 0 ||
    filters.assigneeId !== null ||
    filters.priority !== null ||
    filters.dueDateFilter !== null
  );
}
