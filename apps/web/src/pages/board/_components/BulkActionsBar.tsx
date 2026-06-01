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
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 border-primary-800/60 bg-primary-950/40"
      role="region"
      aria-label={t("board.bulk.barLabel")}
    >
      <span className="text-xs font-medium text-primary-100">
        {t("board.bulk.selectedCount", { count: selectedCount })}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-primary-200">
          <span className="sr-only">{t("board.bulk.moveToColumn")}</span>
          <select
            className="max-w-[11rem] rounded-md border px-2 py-1 text-xs font-medium outline-none border-primary-700/60 bg-neutral-900 text-neutral-100"
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
          className="h-7 text-xs border-primary-700 bg-neutral-900"
          disabled={archivePending}
          onClick={onArchive}
        >
          <Archive className="mr-1 h-3.5 w-3.5" />
          {t("board.bulk.archive")}
        </Button>
        {deleteConfirmPending ? (
          <div className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs border-red-900 bg-red-950/40">
            <span className="text-red-300">
              {t("board.bulk.deleteConfirm", { count: selectedCount })}
            </span>
            <button
              type="button"
              disabled={deletePending}
              onClick={onConfirmDelete}
              className="font-semibold hover:underline text-red-400"
            >
              {t("board.bulk.confirmYes")}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="hover:underline text-neutral-400"
            >
              {t("board.bulk.confirmNo")}
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs border-red-900 bg-neutral-900 text-red-400 hover:bg-red-950/40"
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
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-300 hover:bg-primary-900/50"
        >
          <X className="h-3.5 w-3.5" />
          {t("board.bulk.clear")}
        </button>
      </div>
    </div>
  );
}
