import { useTranslation } from "react-i18next";
import { Archive, Trash2, X } from "lucide-react";
import {
  BOARD_KANBAN_STATUSES,
  type BoardKanbanStatusApi,
  type BoardTaskStatusApi,
} from "@hously/shared/types";
import { Button } from "@/components/ui/button";

interface BulkActionsBarProps {
  selectedCount: number;
  statusLabel: (s: BoardTaskStatusApi) => string;
  syncPending: boolean;
  archivePending: boolean;
  deletePending: boolean;
  deleteConfirmPending: boolean;
  onMoveToColumn: (status: BoardKanbanStatusApi) => void;
  onArchive: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onClear: () => void;
}

export function BulkActionsBar({
  selectedCount,
  statusLabel,
  syncPending,
  archivePending,
  deletePending,
  deleteConfirmPending,
  onMoveToColumn,
  onArchive,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onClear,
}: BulkActionsBarProps) {
  const { t } = useTranslation("common");

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary-200/80 bg-primary-50/90 px-3 py-2.5 dark:border-primary-800/60 dark:bg-primary-950/40"
      role="region"
      aria-label={t("board.bulk.barLabel")}
    >
      <span className="text-xs font-medium text-primary-900 dark:text-primary-100">
        {t("board.bulk.selectedCount", { count: selectedCount })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-primary-800 dark:text-primary-200">
          <span className="sr-only">{t("board.bulk.moveToColumn")}</span>
          <select
            className="max-w-[11rem] rounded-md border border-primary-200/80 bg-white px-2 py-1 text-xs font-medium text-neutral-800 outline-none dark:border-primary-700/60 dark:bg-neutral-900 dark:text-neutral-100"
            defaultValue=""
            disabled={syncPending}
            onChange={(e) => {
              const v = e.target.value as BoardKanbanStatusApi;
              if (!v) return;
              onMoveToColumn(v);
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
          className="h-7 border-primary-200 bg-white text-xs dark:border-primary-700 dark:bg-neutral-900"
          disabled={archivePending}
          onClick={onArchive}
        >
          <Archive className="mr-1 h-3.5 w-3.5" />
          {t("board.bulk.archive")}
        </Button>
        {deleteConfirmPending ? (
          <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs dark:border-red-900 dark:bg-red-950/40">
            <span className="text-red-800 dark:text-red-300">
              {t("board.bulk.deleteConfirm", { count: selectedCount })}
            </span>
            <button
              type="button"
              disabled={deletePending}
              onClick={onConfirmDelete}
              className="font-semibold text-red-700 hover:underline dark:text-red-400"
            >
              {t("board.bulk.confirmYes")}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
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
            disabled={deletePending}
            onClick={onDelete}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("board.bulk.delete")}
          </Button>
        )}
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100/80 dark:text-primary-300 dark:hover:bg-primary-900/50"
        >
          <X className="h-3.5 w-3.5" />
          {t("board.bulk.clear")}
        </button>
      </div>
    </div>
  );
}
