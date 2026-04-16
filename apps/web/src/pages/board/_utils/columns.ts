import {
  BOARD_KANBAN_STATUSES,
  type BoardKanbanStatusApi,
  type BoardTask,
  type BoardTaskStatusApi,
} from "@hously/shared/types";

export function groupTasks(
  tasks: BoardTask[],
): Record<BoardKanbanStatusApi, BoardTask[]> {
  const empty: Record<BoardKanbanStatusApi, BoardTask[]> = {
    on_hold: [],
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const task of tasks) {
    if ((BOARD_KANBAN_STATUSES as readonly string[]).includes(task.status)) {
      empty[task.status as BoardKanbanStatusApi].push(task);
    }
  }
  for (const k of BOARD_KANBAN_STATUSES) {
    empty[k].sort((a, b) => a.position - b.position);
  }
  return empty;
}

export function normalizeColumns(
  cols: Record<BoardKanbanStatusApi, BoardTask[]>,
): Record<BoardKanbanStatusApi, BoardTask[]> {
  const out = {} as Record<BoardKanbanStatusApi, BoardTask[]>;
  for (const s of BOARD_KANBAN_STATUSES) {
    out[s] = cols[s].map((task, i) => ({
      ...task,
      status: s as BoardTaskStatusApi,
      position: i,
    }));
  }
  return out;
}

export function toSyncPayload(cols: Record<BoardKanbanStatusApi, BoardTask[]>) {
  return BOARD_KANBAN_STATUSES.flatMap((s) =>
    cols[s].map((task) => ({
      id: task.id,
      status: task.status,
      position: task.position,
    })),
  );
}

/** Move all tasks in `selectedIds` to `targetStatus` (appended at end). */
export function bulkMoveTasksToColumn(
  cols: Record<BoardKanbanStatusApi, BoardTask[]>,
  selectedIds: number[],
  targetStatus: BoardKanbanStatusApi,
): Record<BoardKanbanStatusApi, BoardTask[]> {
  const idSet = new Set(selectedIds);
  const collected: BoardTask[] = [];
  const next: Record<BoardKanbanStatusApi, BoardTask[]> = {
    on_hold: [],
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const s of BOARD_KANBAN_STATUSES) {
    for (const task of cols[s]) {
      if (idSet.has(task.id)) {
        collected.push(task);
      } else {
        next[s].push(task);
      }
    }
  }
  next[targetStatus] = [...next[targetStatus], ...collected];
  return normalizeColumns(next);
}
