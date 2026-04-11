import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import {
  PointerActivationConstraints,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/dom";
import {
  Archive,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { HouseLoader } from "@/components/HouseLoader";
import {
  useArchivedBoardTasks,
  useBoardTasks,
  useCreateBoardTask,
  useDeleteBoardTask,
  useSetBoardTaskArchived,
  useSyncBoardTasks,
  useUpdateBoardTask,
} from "@/hooks/board/useBoardTasks";
import { useJsonEventSource } from "@/hooks/realtime/useEventSource";
import { useUsers } from "@/hooks/users/useUsers";
import { BOARD_TASKS_ENDPOINTS } from "@hously/shared/endpoints";
import {
  BACKLOG_SORT_OPTIONS,
  BOARD_KANBAN_STATUSES,
  BOARD_TASK_STATUSES,
  type BacklogSortOption,
  type BoardKanbanStatusApi,
  type BoardTag,
  type BoardTask,
  type BoardTaskPriorityApi,
  type BoardTaskStatusApi,
  type BoardTasksResponse,
  type UpdateBoardTaskRequest,
} from "@hously/shared/types";
import { useBoardTags } from "@/hooks/board/useBoardTags";
import { queryKeys } from "@/lib/queryKeys";
import { TagManagerModal } from "./components/TagManagerModal";
import { cn } from "@/lib/utils";
import { BoardColumn } from "./components/BoardColumn";
import { BoardTaskCard } from "./components/BoardTaskCard";
import { TaskDrawer } from "./components/TaskDrawer";
import { BacklogView } from "./components/BacklogView";
import { ArchiveView } from "./components/ArchiveView";

type DragEndPayload = Parameters<DragEndEvent>[0];
type DragOverPayload = Parameters<DragOverEvent>[0];

type ViewMode = "board" | "backlog" | "archive";

interface BoardFilters {
  tags: number[]; // tag IDs
  assigneeId: number | null;
  priority: BoardTaskPriorityApi | null;
  dueDateFilter: "overdue" | "this_week" | null;
}

const EMPTY_FILTERS: BoardFilters = {
  tags: [],
  assigneeId: null,
  priority: null,
  dueDateFilter: null,
};

function groupTasks(
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

function normalizeColumns(
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

function toSyncPayload(cols: Record<BoardKanbanStatusApi, BoardTask[]>) {
  return BOARD_KANBAN_STATUSES.flatMap((s) =>
    cols[s].map((task) => ({
      id: task.id,
      status: task.status,
      position: task.position,
    })),
  );
}

/** Move all tasks in `selectedIds` to `targetStatus` (appended at end). Works on full column state. */
function bulkMoveTasksToColumn(
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

function applyFilters(tasks: BoardTask[], filters: BoardFilters): BoardTask[] {
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

const PRIORITY_RANK: Record<BoardTaskPriorityApi, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortBacklog(
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

const SORT_LABELS: Record<BacklogSortOption, string> = {
  position: "Manual order",
  priority: "Priority",
  due_date: "Due date",
  created_at: "Created date",
  assignee: "Assignee",
};

export function BoardView() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { data, isLoading } = useBoardTasks();
  const { data: usersData } = useUsers();
  const users = usersData?.users ?? [];
  const syncMutation = useSyncBoardTasks();
  const createMutation = useCreateBoardTask();
  const updateMutation = useUpdateBoardTask();
  const deleteMutation = useDeleteBoardTask();
  const archiveMutation = useSetBoardTaskArchived();
  const [restoringId, setRestoringId] = useState<number | null>(null);
  // View mode — declared early so the archive fetch can be gated
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const { data: archivedData } = useArchivedBoardTasks(viewMode === "archive");
  const archivedTasks = archivedData?.tasks ?? [];

  useEffect(() => {
    if (viewMode !== "board") setSelectedTaskIds([]);
  }, [viewMode]);

  useJsonEventSource<BoardTasksResponse>({
    url: BOARD_TASKS_ENDPOINTS.STREAM,
    logLabel: "Board tasks stream",
    onMessage: (payload) => {
      queryClient.setQueryData(queryKeys.boardTasks.list(), payload);
    },
  });

  const allTasks = data?.tasks ?? [];
  const kanbanTasks = useMemo(
    () =>
      allTasks.filter((t) =>
        (BOARD_KANBAN_STATUSES as readonly string[]).includes(t.status),
      ),
    [allTasks],
  );
  const backlogTasks = allTasks;

  useEffect(() => {
    const valid = new Set(kanbanTasks.map((t) => t.id));
    setSelectedTaskIds((prev) => prev.filter((id) => valid.has(id)));
  }, [kanbanTasks]);

  const groupedFromServer = useMemo(
    () => groupTasks(kanbanTasks),
    [kanbanTasks],
  );
  const [columns, setColumns] =
    useState<Record<BoardKanbanStatusApi, BoardTask[]>>(groupedFromServer);
  const columnsRef = useRef(columns);
  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);
  useEffect(() => {
    setColumns(groupedFromServer);
  }, [groupedFromServer]);

  const snapshotRef = useRef<Record<BoardKanbanStatusApi, BoardTask[]> | null>(
    null,
  );

  const sensors = useMemo(
    () => [
      PointerSensor.configure({
        activationConstraints: [
          new PointerActivationConstraints.Distance({ value: 8 }),
        ],
      }),
      KeyboardSensor,
    ],
    [],
  );

  const handleDragStart = useCallback(() => {
    snapshotRef.current = structuredClone(columnsRef.current);
  }, []);

  const handleDragOver = useCallback((event: DragOverPayload) => {
    setColumns(
      (prev) => move(prev, event) as Record<BoardKanbanStatusApi, BoardTask[]>,
    );
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndPayload) => {
      if (event.canceled) {
        if (snapshotRef.current) setColumns(snapshotRef.current);
        snapshotRef.current = null;
        return;
      }
      snapshotRef.current = null;
      const source = event.operation.source;
      if (source && isSortable(source)) {
        const normalized = normalizeColumns(columnsRef.current);
        setColumns(normalized);
        syncMutation.mutate({ tasks: toSyncPayload(normalized) });
      }
    },
    [syncMutation],
  );

  // Drawer
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);

  const handleBoardCardClick = useCallback(
    (task: BoardTask, e: React.MouseEvent | React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setSelectedTaskIds((prev) =>
          prev.includes(task.id)
            ? prev.filter((id) => id !== task.id)
            : [...prev, task.id],
        );
        return;
      }
      setSelectedTask(task);
    },
    [],
  );

  const toggleTaskSelect = useCallback((taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  }, []);

  const handleBulkMoveToColumn = useCallback(
    (targetStatus: BoardKanbanStatusApi) => {
      if (selectedTaskIds.length === 0) return;
      const next = bulkMoveTasksToColumn(
        columnsRef.current,
        selectedTaskIds,
        targetStatus,
      );
      setColumns(next);
      syncMutation.mutate(
        { tasks: toSyncPayload(next) },
        {
          onSuccess: () => setSelectedTaskIds([]),
        },
      );
    },
    [selectedTaskIds, syncMutation],
  );

  const handleBulkArchive = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;
    const ids = [...selectedTaskIds];
    try {
      await Promise.all(
        ids.map((id) => archiveMutation.mutateAsync({ id, archived: true })),
      );
      setSelectedTaskIds([]);
      setSelectedTask((cur) => (cur && ids.includes(cur.id) ? null : cur));
    } catch {
      /* mutation error surfaced elsewhere */
    }
  }, [selectedTaskIds, archiveMutation]);

  const handleBulkDelete = useCallback(() => {
    if (selectedTaskIds.length === 0) return;
    setDeleteConfirmPending(true);
  }, [selectedTaskIds]);

  const confirmBulkDelete = useCallback(async () => {
    const ids = [...selectedTaskIds];
    setDeleteConfirmPending(false);
    try {
      await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
      setSelectedTaskIds([]);
      setSelectedTask((cur) => (cur && ids.includes(cur.id) ? null : cur));
    } catch {
      /* mutation error surfaced elsewhere */
    }
  }, [selectedTaskIds, deleteMutation]);

  const openTaskDrawer = useCallback((task: BoardTask) => {
    setSelectedTask(task);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelectedTaskIds((prev) => (prev.length > 0 ? [] : prev));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep drawer in sync with server data
  useEffect(() => {
    if (selectedTask) {
      const updated = allTasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [allTasks]);

  const handleDrawerUpdate = useCallback(
    (id: number, partialData: Partial<BoardTask>) => {
      updateMutation.mutate({
        id,
        data: partialData as UpdateBoardTaskRequest,
      });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id);
      setSelectedTask(null);
    },
    [deleteMutation],
  );

  // Backlog sort
  const [backlogSort, setBacklogSort] = useState<BacklogSortOption>("position");
  const [backlogSortDir, setBacklogSortDir] = useState<"asc" | "desc">("asc");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createStatus, setCreateStatus] = useState<BoardTaskStatusApi>("todo");

  // Sync default create-status with current view
  useEffect(() => {
    setCreateStatus(viewMode === "backlog" ? "backlog" : "todo");
  }, [viewMode]);

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    createMutation.mutate(
      { title, status: createStatus },
      {
        onSuccess: () => {
          setNewTitle("");
          setShowCreate(false);
        },
      },
    );
  };

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const hasActiveFilters =
    filters.tags.length > 0 ||
    filters.assigneeId !== null ||
    filters.priority !== null ||
    filters.dueDateFilter !== null;

  // All tags from the tags registry
  const { data: tagsData } = useBoardTags();
  const allTags: BoardTag[] = tagsData?.tags ?? [];
  const [showTagManager, setShowTagManager] = useState(false);

  const filteredKanbanColumns = useMemo(() => {
    if (!hasActiveFilters) return columns;
    const result = {} as Record<BoardKanbanStatusApi, BoardTask[]>;
    for (const s of BOARD_KANBAN_STATUSES) {
      result[s] = applyFilters(columns[s], filters);
    }
    return result;
  }, [columns, filters, hasActiveFilters]);

  const filteredBacklogTasks = useMemo(() => {
    const filtered = hasActiveFilters
      ? applyFilters(backlogTasks, filters)
      : backlogTasks;
    return sortBacklog(filtered, backlogSort, backlogSortDir);
  }, [backlogTasks, filters, hasActiveFilters, backlogSort, backlogSortDir]);

  const statusLabel = (s: BoardTaskStatusApi) => t(`board.status.${s}`);

  if (isLoading && !data) {
    return (
      <PageLayout>
        <HouseLoader size="md" />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        icon="📋"
        iconColor="text-indigo-600"
        title={t("board.title")}
        subtitle={t("board.subtitle")}
      />

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2">
        {/* View toggle */}
        <div className="flex rounded-lg border border-neutral-200/80 bg-neutral-100/60 p-0.5 dark:border-neutral-700/60 dark:bg-neutral-800/60">
          <button
            onClick={() => setViewMode("board")}
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
            onClick={() => setViewMode("backlog")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "backlog"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
            )}
          >
            <List className="h-3.5 w-3.5" />
            Backlog
            {backlogTasks.length > 0 && (
              <span className="rounded-full bg-neutral-200/80 px-1.5 py-px text-[10px] text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {backlogTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode("archive")}
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
                setBacklogSort(e.target.value as BacklogSortOption)
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
              onClick={() =>
                setBacklogSortDir((d) => (d === "asc" ? "desc" : "asc"))
              }
              className="ml-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              title={backlogSortDir === "asc" ? "Ascending" : "Descending"}
            >
              {backlogSortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        )}

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
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
              {
                [
                  filters.tags.length > 0,
                  filters.assigneeId !== null,
                  filters.priority !== null,
                  filters.dueDateFilter !== null,
                ].filter(Boolean).length
              }
            </span>
          )}
        </button>

        {/* Add task */}
        <Button
          onClick={() => setShowCreate((v) => !v)}
          className="h-8 gap-1.5 bg-indigo-600 px-3 text-xs hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </Button>
      </div>

      {viewMode === "board" && selectedTaskIds.length > 0 && (
        <div
          className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-3 py-2.5 dark:border-indigo-800/60 dark:bg-indigo-950/40"
          role="region"
          aria-label={t("board.bulk.barLabel")}
        >
          <span className="text-xs font-medium text-indigo-900 dark:text-indigo-100">
            {t("board.bulk.selectedCount", { count: selectedTaskIds.length })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-indigo-800 dark:text-indigo-200">
              <span className="sr-only">{t("board.bulk.moveToColumn")}</span>
              <select
                className="max-w-[11rem] rounded-md border border-indigo-200/80 bg-white px-2 py-1 text-xs font-medium text-neutral-800 outline-none dark:border-indigo-700/60 dark:bg-neutral-900 dark:text-neutral-100"
                defaultValue=""
                disabled={syncMutation.isPending}
                onChange={(e) => {
                  const v = e.target.value as BoardKanbanStatusApi;
                  if (!v) return;
                  handleBulkMoveToColumn(v);
                  e.target.selectedIndex = 0;
                }}
              >
                <option value="" disabled>
                  {t("board.bulk.moveToPlaceholder")}
                </option>
                {BOARD_KANBAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-indigo-200 bg-white text-xs dark:border-indigo-700 dark:bg-neutral-900"
              disabled={archiveMutation.isPending}
              onClick={() => void handleBulkArchive()}
            >
              <Archive className="mr-1 h-3.5 w-3.5" />
              {t("board.bulk.archive")}
            </Button>
            {deleteConfirmPending ? (
              <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs dark:border-red-900 dark:bg-red-950/40">
                <span className="text-red-800 dark:text-red-300">
                  {t("board.bulk.deleteConfirm", { count: selectedTaskIds.length })}
                </span>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => void confirmBulkDelete()}
                  className="font-semibold text-red-700 hover:underline dark:text-red-400"
                >
                  {t("board.bulk.confirmYes")}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmPending(false)}
                  className="text-neutral-500 hover:underline dark:text-neutral-400"
                >
                  {t("board.bulk.confirmNo")}
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-red-200 bg-white text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-neutral-900 dark:text-red-400 dark:hover:bg-red-950/40"
                disabled={deleteMutation.isPending}
                onClick={handleBulkDelete}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {t("board.bulk.delete")}
              </Button>
            )}
            <button
              type="button"
              onClick={() => { setSelectedTaskIds([]); setDeleteConfirmPending(false); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100/80 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
            >
              <X className="h-3.5 w-3.5" />
              {t("board.bulk.clear")}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-800 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t("board.newTaskTitle")}
            </label>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreate(false);
              }}
              placeholder={t("board.newTaskPlaceholder")}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t("board.column")}
            </label>
            <select
              value={createStatus}
              onChange={(e) =>
                setCreateStatus(e.target.value as BoardTaskStatusApi)
              }
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
            >
              {BOARD_TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newTitle.trim()}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t("board.addTask")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowCreate(false)}
              className="shrink-0"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-4 py-3 dark:border-neutral-700/60 dark:bg-neutral-800">
          {/* Priority */}
          <FilterSelect
            label="Priority"
            value={filters.priority ?? ""}
            onChange={(v) =>
              setFilters((f) => ({
                ...f,
                priority: (v || null) as BoardTaskPriorityApi | null,
              }))
            }
          >
            <option value="">Any priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </FilterSelect>

          {/* Assignee */}
          {users.length > 0 && (
            <FilterSelect
              label="Assignee"
              value={filters.assigneeId?.toString() ?? ""}
              onChange={(v) =>
                setFilters((f) => ({ ...f, assigneeId: v ? Number(v) : null }))
              }
            >
              <option value="">Any assignee</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name
                    ? `${u.first_name}${u.last_name ? " " + u.last_name : ""}`
                    : u.email}
                </option>
              ))}
            </FilterSelect>
          )}

          {/* Due date filter */}
          <FilterSelect
            label="Due date"
            value={filters.dueDateFilter ?? ""}
            onChange={(v) =>
              setFilters((f) => ({
                ...f,
                dueDateFilter: (v || null) as BoardFilters["dueDateFilter"],
              }))
            }
          >
            <option value="">Any date</option>
            <option value="overdue">Overdue</option>
            <option value="this_week">Due this week</option>
          </FilterSelect>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() =>
                    setFilters((f) =>
                      f.tags.includes(tag.id)
                        ? { ...f, tags: f.tags.filter((id) => id !== tag.id) }
                        : { ...f, tags: [...f.tags, tag.id] },
                    )
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filters.tags.includes(tag.id)
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600",
                  )}
                >
                  {tag.color && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: filters.tags.includes(tag.id)
                          ? "white"
                          : tag.color,
                      }}
                    />
                  )}
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          {/* Manage tags link */}
          <button
            onClick={() => setShowTagManager(true)}
            className="ml-auto text-[11px] text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Manage tags
          </button>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Board view */}
      {viewMode === "board" && (
        <DragDropProvider
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch]">
            {BOARD_KANBAN_STATUSES.map((status) => (
              <BoardColumn key={status} status={status}>
                <div className="border-b border-neutral-200/80 px-3 py-2.5 dark:border-neutral-700/50">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
                      {statusLabel(status)}
                    </h3>
                    <span className="rounded-full bg-neutral-200/60 px-1.5 py-px text-[10px] font-medium text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400">
                      {filteredKanbanColumns[status].length}
                      {hasActiveFilters &&
                        columns[status].length !==
                          filteredKanbanColumns[status].length && (
                          <span className="text-neutral-400">
                            /{columns[status].length}
                          </span>
                        )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {filteredKanbanColumns[status].map((task, index) => (
                    <BoardTaskCard
                      key={task.id}
                      task={task}
                      columnId={status}
                      index={index}
                      isSelected={selectedSet.has(task.id)}
                      onToggleSelect={() => toggleTaskSelect(task.id)}
                      onCardClick={handleBoardCardClick}
                    />
                  ))}
                  {filteredKanbanColumns[status].length === 0 && (
                    <p className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
                      {hasActiveFilters
                        ? "No matching tasks"
                        : t("board.emptyColumn")}
                    </p>
                  )}
                </div>
              </BoardColumn>
            ))}
          </div>
        </DragDropProvider>
      )}

      {/* Backlog view */}
      {viewMode === "backlog" && (
        <BacklogView
          tasks={filteredBacklogTasks}
          onTaskClick={openTaskDrawer}
        />
      )}

      {/* Archive view */}
      {viewMode === "archive" && (
        <ArchiveView
          tasks={archivedTasks}
          onTaskClick={openTaskDrawer}
          onRestore={(id) => {
            setRestoringId(id);
            archiveMutation.mutate(
              { id, archived: false },
              { onSettled: () => setRestoringId(null) },
            );
          }}
          restoringId={restoringId}
        />
      )}

      {syncMutation.isPending && (
        <p className="mt-2 text-center text-xs text-neutral-400">
          {t("board.saving")}
        </p>
      )}

      {/* Task drawer */}
      <TaskDrawer
        key={selectedTask?.id ?? "none"}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleDrawerUpdate}
        onDelete={handleDelete}
        onArchive={(id) => {
          const archived = !selectedTask?.archived;
          archiveMutation.mutate(
            { id, archived },
            { onSuccess: () => setSelectedTask(null) },
          );
        }}
        allTasks={allTasks}
      />

      {/* Tag manager */}
      <TagManagerModal
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
      />
    </PageLayout>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-900/40">
      <span className="text-[11px] font-medium text-neutral-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] font-medium text-neutral-700 outline-none dark:text-neutral-200"
      >
        {children}
      </select>
    </div>
  );
}
