import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { PointerActivationConstraints, type DragEndEvent, type DragOverEvent } from '@dnd-kit/dom';
import { Filter, LayoutGrid, List, Plus, X } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { HouseLoader } from '@/components/HouseLoader';
import {
  useBoardTasks,
  useCreateBoardTask,
  useDeleteBoardTask,
  useSyncBoardTasks,
  useUpdateBoardTask,
} from '@/hooks/useBoardTasks';
import { useUsers } from '@/hooks/useUsers';
import {
  BOARD_KANBAN_STATUSES,
  BOARD_TASK_STATUSES,
  type BoardKanbanStatusApi,
  type BoardTask,
  type BoardTaskPriorityApi,
  type BoardTaskStatusApi,
  type UpdateBoardTaskRequest,
} from '@hously/shared';
import { cn } from '@/lib/utils';
import { BoardColumn } from './components/BoardColumn';
import { BoardTaskCard } from './components/BoardTaskCard';
import { TaskDrawer } from './components/TaskDrawer';
import { BacklogView } from './components/BacklogView';

type DragEndPayload = Parameters<DragEndEvent>[0];
type DragOverPayload = Parameters<DragOverEvent>[0];

type ViewMode = 'board' | 'backlog';

interface BoardFilters {
  tags: string[];
  assigneeId: number | null;
  priority: BoardTaskPriorityApi | null;
  dueDateFilter: 'overdue' | 'this_week' | null;
}

const EMPTY_FILTERS: BoardFilters = {
  tags: [],
  assigneeId: null,
  priority: null,
  dueDateFilter: null,
};

function groupTasks(tasks: BoardTask[]): Record<BoardKanbanStatusApi, BoardTask[]> {
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
  cols: Record<BoardKanbanStatusApi, BoardTask[]>
): Record<BoardKanbanStatusApi, BoardTask[]> {
  const out = {} as Record<BoardKanbanStatusApi, BoardTask[]>;
  for (const s of BOARD_KANBAN_STATUSES) {
    out[s] = cols[s].map((task, i) => ({ ...task, status: s as BoardTaskStatusApi, position: i }));
  }
  return out;
}

function toSyncPayload(cols: Record<BoardKanbanStatusApi, BoardTask[]>) {
  return BOARD_KANBAN_STATUSES.flatMap(s =>
    cols[s].map(task => ({ id: task.id, status: task.status, position: task.position }))
  );
}

function applyFilters(tasks: BoardTask[], filters: BoardFilters): BoardTask[] {
  return tasks.filter(task => {
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assigneeId !== null && task.assignee_id !== filters.assigneeId) return false;
    if (filters.tags.length > 0 && !filters.tags.every(t => task.tags.includes(t))) return false;
    if (filters.dueDateFilter) {
      const today = new Date(new Date().toDateString());
      const dueDate = task.due_date ? new Date(task.due_date) : null;
      if (filters.dueDateFilter === 'overdue') {
        if (!dueDate || dueDate >= today) return false;
      } else if (filters.dueDateFilter === 'this_week') {
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        if (!dueDate || dueDate < today || dueDate > nextWeek) return false;
      }
    }
    return true;
  });
}

export function BoardView() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useBoardTasks();
  const { data: usersData } = useUsers();
  const users = usersData?.users ?? [];
  const syncMutation = useSyncBoardTasks();
  const createMutation = useCreateBoardTask();
  const updateMutation = useUpdateBoardTask();
  const deleteMutation = useDeleteBoardTask();

  const allTasks = data?.tasks ?? [];
  const kanbanTasks = useMemo(
    () => allTasks.filter(t => (BOARD_KANBAN_STATUSES as readonly string[]).includes(t.status)),
    [allTasks]
  );
  const backlogTasks = allTasks;

  const groupedFromServer = useMemo(() => groupTasks(kanbanTasks), [kanbanTasks]);
  const [columns, setColumns] = useState<Record<BoardKanbanStatusApi, BoardTask[]>>(groupedFromServer);
  const columnsRef = useRef(columns);
  useLayoutEffect(() => { columnsRef.current = columns; }, [columns]);
  useEffect(() => { setColumns(groupedFromServer); }, [groupedFromServer]);

  const snapshotRef = useRef<Record<BoardKanbanStatusApi, BoardTask[]> | null>(null);

  const sensors = useMemo(
    () => [
      PointerSensor.configure({
        activationConstraints: [new PointerActivationConstraints.Distance({ value: 8 })],
      }),
      KeyboardSensor,
    ],
    []
  );

  const handleDragStart = useCallback(() => {
    snapshotRef.current = structuredClone(columnsRef.current);
  }, []);

  const handleDragOver = useCallback((event: DragOverPayload) => {
    setColumns(prev => move(prev, event) as Record<BoardKanbanStatusApi, BoardTask[]>);
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
    [syncMutation]
  );

  // Drawer
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);

  const handleTaskClick = useCallback((task: BoardTask) => {
    setSelectedTask(task);
  }, []);

  // Keep drawer in sync with server data
  useEffect(() => {
    if (selectedTask) {
      const updated = allTasks.find(t => t.id === selectedTask.id);
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
    [updateMutation]
  );

  const handleDelete = useCallback(
    (id: number) => {
      deleteMutation.mutate(id);
      setSelectedTask(null);
    },
    [deleteMutation]
  );

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('board');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createStatus, setCreateStatus] = useState<BoardTaskStatusApi>('todo');

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    createMutation.mutate(
      { title, status: createStatus },
      {
        onSuccess: () => {
          setNewTitle('');
          setShowCreate(false);
        },
      }
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

  // All unique tags across tasks
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const task of allTasks) {
      for (const tag of task.tags) tags.add(tag);
    }
    return Array.from(tags).sort();
  }, [allTasks]);

  const filteredKanbanColumns = useMemo(() => {
    if (!hasActiveFilters) return columns;
    const result = {} as Record<BoardKanbanStatusApi, BoardTask[]>;
    for (const s of BOARD_KANBAN_STATUSES) {
      result[s] = applyFilters(columns[s], filters);
    }
    return result;
  }, [columns, filters, hasActiveFilters]);

  const filteredBacklogTasks = useMemo(
    () => (hasActiveFilters ? applyFilters(backlogTasks, filters) : backlogTasks),
    [backlogTasks, filters, hasActiveFilters]
  );

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
        title={t('board.title')}
        subtitle={t('board.subtitle')}
      />

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2">
        {/* View toggle */}
        <div className="flex rounded-lg border border-neutral-200/80 bg-neutral-100/60 p-0.5 dark:border-neutral-700/60 dark:bg-neutral-800/60">
          <button
            onClick={() => setViewMode('board')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'board'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Board
          </button>
          <button
            onClick={() => setViewMode('backlog')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'backlog'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
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
        </div>

        <div className="flex-1" />

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            hasActiveFilters
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700/60 dark:bg-indigo-900/20 dark:text-indigo-300'
              : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700/60'
          )}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-px text-[10px] text-white">
              {[filters.tags.length > 0, filters.assigneeId !== null, filters.priority !== null, filters.dueDateFilter !== null].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Add task */}
        <Button
          onClick={() => setShowCreate(v => !v)}
          className="h-8 gap-1.5 bg-indigo-600 px-3 text-xs hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-800 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('board.newTaskTitle')}
            </label>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowCreate(false);
              }}
              placeholder={t('board.newTaskPlaceholder')}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
            />
          </div>
          <div className="w-full sm:w-44">
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('board.column')}
            </label>
            <select
              value={createStatus}
              onChange={e => setCreateStatus(e.target.value as BoardTaskStatusApi)}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
            >
              {BOARD_TASK_STATUSES.map(s => (
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
              {t('board.addTask')}
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
            value={filters.priority ?? ''}
            onChange={v => setFilters(f => ({ ...f, priority: (v || null) as BoardTaskPriorityApi | null }))}
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
              value={filters.assigneeId?.toString() ?? ''}
              onChange={v => setFilters(f => ({ ...f, assigneeId: v ? Number(v) : null }))}
            >
              <option value="">Any assignee</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}` : u.email}
                </option>
              ))}
            </FilterSelect>
          )}

          {/* Due date filter */}
          <FilterSelect
            label="Due date"
            value={filters.dueDateFilter ?? ''}
            onChange={v =>
              setFilters(f => ({ ...f, dueDateFilter: (v || null) as BoardFilters['dueDateFilter'] }))
            }
          >
            <option value="">Any date</option>
            <option value="overdue">Overdue</option>
            <option value="this_week">Due this week</option>
          </FilterSelect>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() =>
                    setFilters(f =>
                      f.tags.includes(tag)
                        ? { ...f, tags: f.tags.filter(t => t !== tag) }
                        : { ...f, tags: [...f.tags, tag] }
                    )
                  }
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                    filters.tags.includes(tag)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="ml-auto flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Board view */}
      {viewMode === 'board' && (
        <DragDropProvider
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch]">
            {BOARD_KANBAN_STATUSES.map(status => (
              <BoardColumn key={status} status={status}>
                <div className="border-b border-neutral-200/80 px-3 py-2.5 dark:border-neutral-700/50">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
                      {statusLabel(status)}
                    </h3>
                    <span className="rounded-full bg-neutral-200/60 px-1.5 py-px text-[10px] font-medium text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400">
                      {filteredKanbanColumns[status].length}
                      {hasActiveFilters && columns[status].length !== filteredKanbanColumns[status].length && (
                        <span className="text-neutral-400">/{columns[status].length}</span>
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
                      onClick={handleTaskClick}
                    />
                  ))}
                  {filteredKanbanColumns[status].length === 0 && (
                    <p className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
                      {hasActiveFilters ? 'No matching tasks' : t('board.emptyColumn')}
                    </p>
                  )}
                </div>
              </BoardColumn>
            ))}
          </div>
        </DragDropProvider>
      )}

      {/* Backlog view */}
      {viewMode === 'backlog' && (
        <BacklogView tasks={filteredBacklogTasks} onTaskClick={handleTaskClick} />
      )}

      {syncMutation.isPending && (
        <p className="mt-2 text-center text-xs text-neutral-400">{t('board.saving')}</p>
      )}

      {/* Task drawer */}
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleDrawerUpdate}
        onDelete={handleDelete}
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
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-[12px] font-medium text-neutral-700 outline-none dark:text-neutral-200"
      >
        {children}
      </select>
    </div>
  );
}
