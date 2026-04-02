import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import { PointerActivationConstraints, type DragEndEvent, type DragOverEvent } from '@dnd-kit/dom';
import { Plus } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { HouseLoader } from '@/components/HouseLoader';
import {
  useBoardTasks,
  useCreateBoardTask,
  useDeleteBoardTask,
  useSyncBoardTasks,
} from '@/hooks/useBoardTasks';
import { BOARD_TASK_STATUSES, type BoardTask, type BoardTaskStatusApi } from '@hously/shared';
import { BoardColumn } from './components/BoardColumn';
import { BoardTaskCard } from './components/BoardTaskCard';

type DragEndPayload = Parameters<DragEndEvent>[0];
type DragOverPayload = Parameters<DragOverEvent>[0];

function groupTasks(tasks: BoardTask[]): Record<BoardTaskStatusApi, BoardTask[]> {
  const empty: Record<BoardTaskStatusApi, BoardTask[]> = {
    on_hold: [],
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const task of tasks) {
    empty[task.status].push(task);
  }
  for (const k of BOARD_TASK_STATUSES) {
    empty[k].sort((a, b) => a.position - b.position);
  }
  return empty;
}

function normalizeColumns(
  cols: Record<BoardTaskStatusApi, BoardTask[]>
): Record<BoardTaskStatusApi, BoardTask[]> {
  const out = {} as Record<BoardTaskStatusApi, BoardTask[]>;
  for (const s of BOARD_TASK_STATUSES) {
    out[s] = cols[s].map((task, i) => ({ ...task, status: s, position: i }));
  }
  return out;
}

function toSyncPayload(cols: Record<BoardTaskStatusApi, BoardTask[]>) {
  return BOARD_TASK_STATUSES.flatMap(s =>
    cols[s].map(task => ({ id: task.id, status: task.status, position: task.position }))
  );
}

export function BoardView() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useBoardTasks();
  const syncMutation = useSyncBoardTasks();
  const createMutation = useCreateBoardTask();
  const deleteMutation = useDeleteBoardTask();

  const groupedFromServer = useMemo(() => groupTasks(data?.tasks ?? []), [data?.tasks]);

  const [columns, setColumns] = useState<Record<BoardTaskStatusApi, BoardTask[]>>(groupedFromServer);
  const columnsRef = useRef(columns);

  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    setColumns(groupedFromServer);
  }, [groupedFromServer]);

  const snapshotRef = useRef<Record<BoardTaskStatusApi, BoardTask[]> | null>(null);

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
    setColumns(prev => move(prev, event) as Record<BoardTaskStatusApi, BoardTask[]>);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndPayload) => {
      if (event.canceled) {
        if (snapshotRef.current) {
          setColumns(snapshotRef.current);
        }
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

  const handleDelete = useCallback(
    (id: number) => {
      if (confirm(t('board.deleteConfirm'))) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation, t]
  );

  const [newTitle, setNewTitle] = useState('');
  const [createStatus, setCreateStatus] = useState<BoardTaskStatusApi>('todo');

  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    createMutation.mutate(
      { title, status: createStatus },
      { onSuccess: () => setNewTitle('') }
    );
  };

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

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-800 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t('board.newTaskTitle')}
          </label>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder={t('board.newTaskPlaceholder')}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          />
        </div>
        <div className="w-full sm:w-44">
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t('board.column')}
          </label>
          <select
            value={createStatus}
            onChange={e => setCreateStatus(e.target.value as BoardTaskStatusApi)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          >
            {BOARD_TASK_STATUSES.map(s => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleCreate}
          disabled={createMutation.isPending || !newTitle.trim()}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('board.addTask')}
        </Button>
      </div>

      <DragDropProvider
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 [-webkit-overflow-scrolling:touch]">
          {BOARD_TASK_STATUSES.map(status => (
            <BoardColumn key={status} status={status}>
              <div className="border-b border-neutral-200/80 px-3 py-2.5 dark:border-neutral-700/50">
                <h3 className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
                  {statusLabel(status)}
                </h3>
                <p className="text-[11px] text-neutral-400">{columns[status].length}</p>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {columns[status].map((task, index) => (
                  <BoardTaskCard
                    key={task.id}
                    task={task}
                    columnId={status}
                    index={index}
                    onDelete={handleDelete}
                  />
                ))}
                {columns[status].length === 0 ? (
                  <p className="py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
                    {t('board.emptyColumn')}
                  </p>
                ) : null}
              </div>
            </BoardColumn>
          ))}
        </div>
      </DragDropProvider>

      {syncMutation.isPending ? (
        <p className="mt-2 text-center text-xs text-neutral-400">{t('board.saving')}</p>
      ) : null}
    </PageLayout>
  );
}
