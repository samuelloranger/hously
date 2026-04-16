import { useCallback, useEffect, useMemo, useState } from "react";
import type { BoardKanbanStatusApi, BoardTask } from "@hously/shared/types";
import { bulkMoveTasksToColumn } from "@/pages/board/_utils/columns";
import { toSyncPayload } from "@/pages/board/_utils/columns";
import {
  useDeleteBoardTask,
  useSetBoardTaskArchived,
  useSyncBoardTasks,
} from "@/pages/board/_hooks/useBoardTasks";

interface UseBoardSelectionOptions {
  kanbanTasks: BoardTask[];
  columnsRef: React.RefObject<Record<BoardKanbanStatusApi, BoardTask[]>>;
  setColumns: React.Dispatch<
    React.SetStateAction<Record<BoardKanbanStatusApi, BoardTask[]>>
  >;
  onTaskClosed?: (ids: number[]) => void;
}

export function useBoardSelection({
  kanbanTasks,
  columnsRef,
  setColumns,
  onTaskClosed,
}: UseBoardSelectionOptions) {
  const syncMutation = useSyncBoardTasks();
  const archiveMutation = useSetBoardTaskArchived();
  const deleteMutation = useDeleteBoardTask();

  const [selectedTaskIdsState, setSelectedTaskIds] = useState<number[]>([]);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const validTaskIds = useMemo(
    () => new Set(kanbanTasks.map((task) => task.id)),
    [kanbanTasks],
  );
  const selectedTaskIds = useMemo(
    () => selectedTaskIdsState.filter((id) => validTaskIds.has(id)),
    [selectedTaskIdsState, validTaskIds],
  );
  const selectedSet = useMemo(
    () => new Set(selectedTaskIds),
    [selectedTaskIds],
  );

  // Escape clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSelectedTaskIds((prev) => (prev.length > 0 ? [] : prev));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTaskSelect = useCallback(
    (taskId: number) => {
      setSelectedTaskIds((prev) => {
        const next = prev.filter((id) => validTaskIds.has(id));
        return next.includes(taskId)
          ? next.filter((id) => id !== taskId)
          : [...next, taskId];
      });
    },
    [validTaskIds],
  );

  const handleBoardCardClick = useCallback(
    (task: BoardTask, e: React.MouseEvent | React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setSelectedTaskIds((prev) => {
          const next = prev.filter((id) => validTaskIds.has(id));
          return next.includes(task.id)
            ? next.filter((id) => id !== task.id)
            : [...next, task.id];
        });
        return true; // signal: selection handled, don't open drawer
      }
      return false;
    },
    [validTaskIds],
  );

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
        { onSuccess: () => setSelectedTaskIds([]) },
      );
    },
    [selectedTaskIds, syncMutation, columnsRef, setColumns],
  );

  const handleBulkArchive = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;
    const ids = [...selectedTaskIds];
    try {
      await Promise.all(
        ids.map((id) => archiveMutation.mutateAsync({ id, archived: true })),
      );
      setSelectedTaskIds([]);
      onTaskClosed?.(ids);
    } catch {
      /* mutation error surfaced elsewhere */
    }
  }, [selectedTaskIds, archiveMutation, onTaskClosed]);

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
      onTaskClosed?.(ids);
    } catch {
      /* mutation error surfaced elsewhere */
    }
  }, [selectedTaskIds, deleteMutation, onTaskClosed]);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds([]);
    setDeleteConfirmPending(false);
  }, []);

  return {
    selectedTaskIds,
    selectedSet,
    deleteConfirmPending,
    setDeleteConfirmPending,
    toggleTaskSelect,
    handleBoardCardClick,
    handleBulkMoveToColumn,
    handleBulkArchive,
    handleBulkDelete,
    confirmBulkDelete,
    clearSelection,
    archiveMutation,
    deleteMutation,
    syncMutation,
  };
}
