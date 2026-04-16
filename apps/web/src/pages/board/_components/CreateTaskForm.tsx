import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  BOARD_TASK_STATUSES,
  type BoardTaskStatusApi,
} from "@hously/shared/types";
import { Button } from "@/components/ui/button";

interface CreateTaskFormProps {
  newTitle: string;
  onTitleChange: (title: string) => void;
  createStatus: BoardTaskStatusApi;
  onStatusChange: (status: BoardTaskStatusApi) => void;
  onCreate: () => void;
  onClose: () => void;
  isPending: boolean;
  statusLabel: (s: BoardTaskStatusApi) => string;
}

export function CreateTaskForm({
  newTitle,
  onTitleChange,
  createStatus,
  onStatusChange,
  onCreate,
  onClose,
  isPending,
  statusLabel,
}: CreateTaskFormProps) {
  const { t } = useTranslation("common");

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-700/60 dark:bg-neutral-800 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("board.newTaskTitle")}
        </label>
        <input
          autoFocus
          value={newTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCreate();
            if (e.key === "Escape") onClose();
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
            onStatusChange(e.target.value as BoardTaskStatusApi)
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
          onClick={onCreate}
          disabled={isPending || !newTitle.trim()}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("board.addTask")}
        </Button>
        <Button variant="ghost" onClick={onClose} className="shrink-0">
          Cancel
        </Button>
      </div>
    </div>
  );
}
