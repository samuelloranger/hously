import { useSortable } from '@dnd-kit/react/sortable';
import type { BoardTask, BoardTaskPriorityApi, BoardTaskStatusApi } from '@hously/shared';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock } from 'lucide-react';

interface BoardTaskCardProps {
  task: BoardTask;
  columnId: BoardTaskStatusApi;
  index: number;
  onClick: (task: BoardTask) => void;
}

const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: 'bg-sky-400',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

export function BoardTaskCard({ task, columnId, index, onClick }: BoardTaskCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: 'item',
    accept: 'item',
  });

  const today = new Date(new Date().toDateString());
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate ? dueDate < today : false;
  const isDueToday = dueDate ? dueDate.getTime() === today.getTime() : false;
  const isDueSoon =
    dueDate && !isOverdue && !isDueToday
      ? (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 3
      : false;

  const dueDateLabel = dueDate
    ? isOverdue
      ? `Overdue · ${dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : isDueToday
        ? 'Due today'
        : dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const initials = task.assignee_name
    ? task.assignee_name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : null;

  return (
    <div
      ref={(node: HTMLDivElement | null) => {
        (ref as React.RefCallback<HTMLDivElement>)(node);
        (handleRef as React.RefCallback<HTMLDivElement>)(node);
      }}
      style={{ opacity: isDragging ? 0.75 : 1, zIndex: isDragging ? 20 : undefined }}
      onClick={() => onClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(task)}
      className="group cursor-pointer rounded-lg border border-neutral-200/90 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:border-neutral-600/60 dark:bg-neutral-800 dark:hover:border-neutral-500/60"
    >
      {/* Top row: slug + priority dot */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
          {task.slug}
        </span>
        <span
          className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[task.priority])}
          title={task.priority}
        />
      </div>

      {/* Title */}
      <p className="text-sm font-medium leading-snug text-neutral-900 dark:text-white">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Bottom row: due date + assignee */}
      {(dueDateLabel || initials) && (
        <div className="mt-2.5 flex items-center gap-2">
          {dueDateLabel && (
            <span
              className={cn(
                'flex items-center gap-1 text-[11px] font-medium',
                isOverdue
                  ? 'text-red-500 dark:text-red-400'
                  : isDueToday
                    ? 'text-orange-500 dark:text-orange-400'
                    : isDueSoon
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-neutral-400 dark:text-neutral-500'
              )}
            >
              {isOverdue ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {dueDateLabel}
            </span>
          )}
          <div className="flex-1" />
          {task.assignee_avatar ? (
            <img
              src={task.assignee_avatar}
              alt={task.assignee_name ?? ''}
              title={task.assignee_name ?? ''}
              className="h-5 w-5 rounded-full object-cover ring-1 ring-white dark:ring-neutral-800"
            />
          ) : initials ? (
            <span
              title={task.assignee_name ?? ''}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600 ring-1 ring-white dark:bg-indigo-900/40 dark:text-indigo-400 dark:ring-neutral-800"
            >
              {initials}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
