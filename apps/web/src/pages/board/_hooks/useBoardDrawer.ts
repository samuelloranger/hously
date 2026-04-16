import { useCallback, useEffect, useState } from "react";
import type {
  BoardTask,
  UpdateBoardTaskRequest,
} from "@hously/shared/types";
import {
  useDeleteBoardTask,
  useSetBoardTaskArchived,
  useUpdateBoardTask,
} from "@/pages/board/_hooks/useBoardTasks";

export function useBoardDrawer(allTasks: BoardTask[]) {
  const updateMutation = useUpdateBoardTask();
  const deleteMutation = useDeleteBoardTask();
  const archiveMutation = useSetBoardTaskArchived();

  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);

  // Keep drawer in sync with server data
  useEffect(() => {
    if (selectedTask) {
      const updated = allTasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [allTasks]);

  const openTaskDrawer = useCallback((task: BoardTask) => {
    setSelectedTask(task);
  }, []);

  const closeTaskDrawer = useCallback(() => {
    setSelectedTask(null);
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
      setSelectedTask(null);
    },
    [deleteMutation],
  );

  const handleArchive = useCallback(
    (id: number) => {
      const archived = !selectedTask?.archived;
      archiveMutation.mutate(
        { id, archived },
        { onSuccess: () => setSelectedTask(null) },
      );
    },
    [archiveMutation, selectedTask?.archived],
  );

  const closeIfMatches = useCallback((ids: number[]) => {
    setSelectedTask((cur) => (cur && ids.includes(cur.id) ? null : cur));
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
