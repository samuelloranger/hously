import { useTranslation } from "react-i18next";
import { DragDropProvider } from "@dnd-kit/react";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/dom";
import {
  BOARD_KANBAN_STATUSES,
  type BoardKanbanStatusApi,
  type BoardTask,
  type BoardTaskStatusApi,
} from "@hously/shared/types";
import { BoardColumn } from "@/pages/board/_components/BoardColumn";
import { BoardTaskCard } from "@/pages/board/_components/BoardTaskCard";

interface BoardKanbanProps {
  columns: Record<BoardKanbanStatusApi, BoardTask[]>;
  unfilteredColumns: Record<BoardKanbanStatusApi, BoardTask[]>;
  hasActiveFilters: boolean;
  sensors: React.ComponentProps<typeof DragDropProvider>["sensors"];
  dragHandlers: {
    onDragStart: () => void;
    onDragOver: (event: Parameters<DragOverEvent>[0]) => void;
    onDragEnd: (event: Parameters<DragEndEvent>[0]) => void;
  };
  selectedSet: Set<number>;
  onToggleSelect: (taskId: number) => void;
  onCardClick: (
    task: BoardTask,
    e: React.MouseEvent | React.KeyboardEvent,
  ) => void;
}

export function BoardKanban({
  columns,
  unfilteredColumns,
  hasActiveFilters,
  sensors,
  dragHandlers,
  selectedSet,
  onToggleSelect,
  onCardClick,
}: BoardKanbanProps) {
  const { t } = useTranslation("common");

  const statusLabel = (s: BoardTaskStatusApi) => t(`board.status.${s}`);

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDragEnd={dragHandlers.onDragEnd}
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
                  {columns[status].length}
                  {hasActiveFilters &&
                    unfilteredColumns[status].length !==
                      columns[status].length && (
                      <span className="text-neutral-400">
                        /{unfilteredColumns[status].length}
                      </span>
                    )}
                </span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {columns[status].map((task, index) => (
                <BoardTaskCard
                  key={task.id}
                  task={task}
                  columnId={status}
                  index={index}
                  isSelected={selectedSet.has(task.id)}
                  onToggleSelect={() => onToggleSelect(task.id)}
                  onCardClick={onCardClick}
                />
              ))}
              {columns[status].length === 0 && (
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
  );
}
