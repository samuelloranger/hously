import { useCallback, useState } from "react";
import type { BoardTaskStatusApi } from "@hously/shared/types";
import { useCreateBoardTask } from "@/pages/board/_hooks/useBoardTasks";

export type ViewMode = "board" | "backlog" | "archive";

export function useBoardCreateForm(viewMode: ViewMode) {
  const createMutation = useCreateBoardTask();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [createStatusByView, setCreateStatusByView] = useState<
    Record<ViewMode, BoardTaskStatusApi>
  >({
    board: "todo",
    backlog: "backlog",
    archive: "todo",
  });
  const createStatus =
    viewMode === "backlog" ? "backlog" : createStatusByView[viewMode];
  const setCreateStatus = useCallback(
    (nextStatus: BoardTaskStatusApi) => {
      if (viewMode === "backlog") {
        return;
      }

      setCreateStatusByView((prev) => ({
        ...prev,
        [viewMode]: nextStatus,
      }));
    },
    [viewMode],
  );

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

  return {
    showCreate,
    setShowCreate,
    newTitle,
    setNewTitle,
    createStatus,
    setCreateStatus,
    handleCreate,
    isPending: createMutation.isPending,
  };
}
