import { useCallback, useMemo, useState } from "react";
import type { BoardTask, UpdateBoardTaskRequest } from "@hously/shared/types";
import {
  useDeleteBoardTask,
  useSetBoardTaskArchived,
  useUpdateBoardTask,
} from "@/pages/board/_hooks/useBoardTasks";

export function useBoardDrawer(allTasks: BoardTask[]) {
  const updateMutation = useUpdateBoardTask();
  const deleteMutation = useDeleteBoardTask();
  const archiveMutation = useSetBoardTaskArchived();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const selectedTask = useMemo(
    () => allTasks.find((task) => task.id === selectedTaskId) ?? null,
    [allTasks, selectedTaskId],
  );

  const openTaskDrawer = useCallback((task: BoardTask) => {
    setSelectedTaskId(task.id);
  }, []);

  const closeTaskDrawer = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

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
      setSelectedTaskId(null);
    },
    [deleteMutation],
  );

  const handleArchive = useCallback(
    (id: number) => {
      const archived = !selectedTask?.archived;
      archiveMutation.mutate(
        { id, archived },
        { onSuccess: () => setSelectedTaskId(null) },
      );
    },
    [archiveMutation, selectedTask?.archived],
  );

  const closeIfMatches = useCallback((ids: number[]) => {
    setSelectedTaskId((currentId) =>
      currentId !== null && ids.includes(currentId) ? null : currentId,
    );
  }, []);

  return {
    selectedTask,
    openTaskDrawer,
    closeTaskDrawer,
    handleDrawerUpdate,
    handleDelete,
    handleArchive,
    closeIfMatches,
  };
}
