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
      const today = new Date(new Date().toDateString());
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      if (filters.dueDateFilter === "overdue") {
        if (!dueDate || dueDate >= today) return false;
      } else if (filters.dueDateFilter === "this_week") {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        if (!dueDate || dueDate < today || dueDate > nextWeek) return false;
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
