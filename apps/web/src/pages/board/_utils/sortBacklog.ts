import type {
  BacklogSortOption,
  BoardTask,
  BoardTaskPriorityApi,
} from "@hously/shared/types";

const PRIORITY_RANK: Record<BoardTaskPriorityApi, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const SORT_LABELS: Record<BacklogSortOption, string> = {
  position: "Manual order",
  priority: "Priority",
  due_date: "Due date",
  created_at: "Created date",
  assignee: "Assignee",
};

export function sortBacklog(
  tasks: BoardTask[],
  sortBy: BacklogSortOption,
  sortDir: "asc" | "desc",
): BoardTask[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case "priority":
        return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * dir;
      case "due_date": {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date) * dir;
      }
      case "created_at": {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return a.created_at.localeCompare(b.created_at) * dir;
      }
      case "assignee": {
        const nameA = a.assignee_name ?? "";
        const nameB = b.assignee_name ?? "";
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB) * dir;
      }
      default:
        return (a.position - b.position) * dir;
    }
  });
}
