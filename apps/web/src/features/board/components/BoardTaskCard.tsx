import { useSortable } from '@dnd-kit/react/sortable';
import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { BoardTask, BoardTaskStatusApi } from '@hously/shared';

interface BoardTaskCardProps {
  task: BoardTask;
  columnId: BoardTaskStatusApi;
  index: number;
  onDelete: (id: number) => void;
}

export function BoardTaskCard({ task, columnId, index, onDelete }: BoardTaskCardProps) {
  const { t } = useTranslation('common');
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: 'item',
    accept: 'item',
  });

  return (
    <div
      ref={ref as React.RefCallback<HTMLDivElement>}
      style={{ opacity: isDragging ? 0.85 : 1, zIndex: isDragging ? 20 : undefined }}
      className="group rounded-lg border border-neutral-200/90 bg-white p-3 shadow-sm dark:border-neutral-600/60 dark:bg-neutral-800"
    >
      <div className="flex gap-2">
        <button
          type="button"
          ref={handleRef as React.RefCallback<HTMLButtonElement>}
          className="mt-0.5 shrink-0 cursor-grab touch-manipulation text-neutral-400 hover:text-neutral-600 active:cursor-grabbing dark:text-neutral-500 dark:hover:text-neutral-300"
          aria-label={t('board.dragHandle')}
        >
          <span className="inline-block select-none text-base leading-none">⋮⋮</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">{task.title}</p>
          {task.description ? (
            <p className="mt-1 line-clamp-3 text-xs text-neutral-500 dark:text-neutral-400">
              {task.description}
            </p>
          ) : null}
          {task.created_by_username ? (
            <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {task.created_by_username}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onDelete(task.id)}
          aria-label={t('board.deleteTask')}
        >
          <Trash2 className="h-4 w-4 text-neutral-400 hover:text-red-600" />
        </Button>
      </div>
    </div>
  );
}
