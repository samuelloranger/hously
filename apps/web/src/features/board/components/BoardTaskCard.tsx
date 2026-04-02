import { useRef, useState } from 'react';
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
  onUpdate: (id: number, title: string, description: string | null) => void;
}

export function BoardTaskCard({ task, columnId, index, onDelete, onUpdate }: BoardTaskCardProps) {
  const { t } = useTranslation('common');
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: 'item',
    accept: 'item',
  });

  const [editingField, setEditingField] = useState<'title' | 'description' | null>(null);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(task.title);
    } else if (trimmed !== task.title) {
      onUpdate(task.id, trimmed, task.description ?? null);
    }
    setEditingField(null);
  };

  const commitDescription = () => {
    const trimmed = descriptionDraft.trim() || null;
    if (trimmed !== (task.description ?? null)) {
      onUpdate(task.id, task.title, trimmed);
    }
    setEditingField(null);
  };

  const startEdit = (field: 'title' | 'description') => {
    if (field === 'title') setTitleDraft(task.title);
    if (field === 'description') setDescriptionDraft(task.description ?? '');
    setEditingField(field);
    requestAnimationFrame(() => {
      if (field === 'title') titleRef.current?.select();
      if (field === 'description') descriptionRef.current?.focus();
    });
  };

  return (
    <div
      ref={(node: HTMLDivElement | null) => { (ref as React.RefCallback<HTMLDivElement>)(node); (handleRef as React.RefCallback<HTMLDivElement>)(node); }}
      style={{ opacity: isDragging ? 0.85 : 1, zIndex: isDragging ? 20 : undefined }}
      className="group cursor-grab rounded-lg border border-neutral-200/90 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-neutral-600/60 dark:bg-neutral-800"
    >
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          {editingField === 'title' ? (
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onPointerDown={e => e.stopPropagation()}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
                if (e.key === 'Escape') { setTitleDraft(task.title); setEditingField(null); }
              }}
              className="w-full rounded border border-indigo-400 bg-white px-1.5 py-0.5 text-sm font-medium text-neutral-900 outline-none ring-1 ring-indigo-400 dark:bg-neutral-700 dark:text-white"
            />
          ) : (
            <p
              role="button"
              tabIndex={0}
              onClick={() => startEdit('title')}
              onKeyDown={e => e.key === 'Enter' && startEdit('title')}
              className="cursor-text text-sm font-medium text-neutral-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
              title={t('board.clickToEdit')}
            >
              {task.title}
            </p>
          )}

          {editingField === 'description' ? (
            <textarea
              ref={descriptionRef}
              value={descriptionDraft}
              onChange={e => setDescriptionDraft(e.target.value)}
              onPointerDown={e => e.stopPropagation()}
              onBlur={commitDescription}
              onKeyDown={e => {
                if (e.key === 'Escape') { setDescriptionDraft(task.description ?? ''); setEditingField(null); }
              }}
              rows={3}
              placeholder={t('board.descriptionPlaceholder')}
              className="mt-1 w-full resize-none rounded border border-indigo-400 bg-white px-1.5 py-0.5 text-xs text-neutral-600 outline-none ring-1 ring-indigo-400 dark:bg-neutral-700 dark:text-neutral-300"
            />
          ) : (
            <p
              role="button"
              tabIndex={0}
              onClick={() => startEdit('description')}
              onKeyDown={e => e.key === 'Enter' && startEdit('description')}
              className={`mt-1 cursor-text text-xs ${
                task.description
                  ? 'line-clamp-3 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
                  : 'text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600'
              }`}
              title={t('board.clickToEdit')}
            >
              {task.description || t('board.addDescription')}
            </p>
          )}

          {task.created_by_username ? (
            <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
              {task.created_by_username}
            </p>
          ) : null}
        </div>

        <Button
          onPointerDown={e => e.stopPropagation()}
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
