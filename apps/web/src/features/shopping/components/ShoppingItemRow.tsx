import { useState, useRef, useEffect, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CompleteCheckbox } from '@/components/CompleteCheckbox';
import { ActionMenu } from '@/components/ActionMenu';
import { DragHandle } from '@/components/SortableList';
import {
  formatUsername,
  formatDate,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useUpdateShoppingItem,
  type ShoppingItem,
} from '@hously/shared';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  dragHandleProps?: {
    setNodeRef: (node: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    style: CSSProperties;
    isDragging: boolean;
  };
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: (itemId: number) => void;
}

export function ShoppingItemRow({
  item,
  dragHandleProps,
  isSelectionMode = false,
  isSelected = false,
  onSelectToggle,
}: ShoppingItemRowProps) {
  const { t, i18n } = useTranslation('common');
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editValue, setEditValue] = useState(item.item_name);
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  const toggleMutation = useToggleShoppingItem();
  const deleteMutation = useDeleteShoppingItem();
  const updateMutation = useUpdateShoppingItem();

  const [isCompletingAnimation, setIsCompletingAnimation] = useState(false);
  const [wasCompleted, setWasCompleted] = useState(item.completed);

  // Track completion state changes for animation
  useEffect(() => {
    if (item.completed && !wasCompleted) {
      setIsCompletingAnimation(true);
      const timer = setTimeout(() => setIsCompletingAnimation(false), 800);
      setWasCompleted(item.completed);
      return () => clearTimeout(timer);
    }
    setWasCompleted(item.completed);
    return undefined;
  }, [item.completed, wasCompleted]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditingNotes && notesInputRef.current) {
      notesInputRef.current.focus();
      notesInputRef.current.select();
    }
  }, [isEditingNotes]);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(item.item_name);
    }
    if (!isEditingNotes) {
      setEditNotes(item.notes || '');
    }
  }, [item.item_name, item.notes, isEditing, isEditingNotes]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(item.item_name);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(item.item_name);
  };

  const handleSubmit = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== item.item_name) {
      updateMutation.mutate(
        { itemId: item.id, itemName: trimmedValue },
        {
          onSuccess: () => {
            setIsEditing(false);
          },
        }
      );
    } else {
      handleCancel();
    }
  };

  const handleNotesSubmit = () => {
    const trimmedNotes = editNotes.trim() || null;
    if (trimmedNotes !== (item.notes || null)) {
      updateMutation.mutate(
        { itemId: item.id, notes: trimmedNotes },
        {
          onSuccess: () => {
            setIsEditingNotes(false);
          },
        }
      );
    } else {
      setIsEditingNotes(false);
      setEditNotes(item.notes || '');
    }
  };

  const handleNotesCancel = () => {
    setIsEditingNotes(false);
    setEditNotes(item.notes || '');
  };

  const handleBlur = () => {
    handleSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const actionMenuItems = [
    {
      label: item.completed ? t('shopping.undo') : t('shopping.markDone'),
      icon: '✓',
      onClick: () => toggleMutation.mutate(item.id),
      variant: 'success' as const,
    },
    {
      label: t('shopping.delete'),
      icon: '🗑️',
      onClick: () => {
        if (confirm(t('shopping.deleteConfirm'))) {
          deleteMutation.mutate(item.id);
        }
      },
      variant: 'danger' as const,
    },
  ];

  return (
    <div
      ref={dragHandleProps?.setNodeRef}
      style={dragHandleProps?.style}
      className={`item-row p-3 pl-6 pr-6 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${
        isCompletingAnimation ? 'row-complete-flash' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-start space-x-2">
          {dragHandleProps && !item.completed && !isSelectionMode && (
            <DragHandle listeners={dragHandleProps.listeners} attributes={dragHandleProps.attributes} />
          )}
          <div className="flex items-start space-x-4">
            {isSelectionMode ? (
              <div className="mt-1">
                <input
                  type="checkbox"
                  className="h-7 w-7 rounded border-2 border-neutral-300 text-primary-600 focus:ring-2 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700"
                  checked={isSelected}
                  onChange={() => onSelectToggle?.(item.id)}
                  aria-label={t('shopping.selectItem')}
                />
              </div>
            ) : (
              <div className="mt-1">
                <CompleteCheckbox
                  completed={!!item.completed}
                  onToggle={() => toggleMutation.mutate(item.id)}
                  disabled={toggleMutation.isPending}
                />
              </div>
            )}
          </div>
          <div className="flex-grow">
            {isEditing ? (
              <div className="flex items-center space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  disabled={updateMutation.isPending}
                  className={`flex-grow px-3 py-1 border border-neutral-300 dark:border-neutral-600 rounded-md text-lg font-medium text-neutral-900 dark:text-white bg-white dark:bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                    item.completed ? 'line-through text-neutral-500 dark:text-neutral-400' : ''
                  }`}
                />
                <button
                  onClick={handleSubmit}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 transition-colors disabled:opacity-50"
                  title={t('shopping.save') || 'Save'}
                >
                  ✓
                </button>
              </div>
            ) : (
              <h4
                onClick={handleEdit}
                className={`text-base font-medium cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                  item.completed
                    ? 'line-through text-neutral-500 dark:text-neutral-400'
                    : 'text-neutral-900 dark:text-white'
                }`}
              >
                {item.item_name}
              </h4>
            )}
            {isEditingNotes ? (
              <div className="mt-2 flex items-start space-x-2">
                <textarea
                  ref={notesInputRef}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  onBlur={handleNotesSubmit}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleNotesSubmit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleNotesCancel();
                    }
                  }}
                  disabled={updateMutation.isPending}
                  rows={2}
                  className="flex-grow px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md text-neutral-900 dark:text-white bg-white dark:bg-neutral-700 focus:outline-none focus:ring-primary-500 focus:border-primary-500 resize-none"
                  placeholder={t('shopping.notesPlaceholder') || 'Notes...'}
                />
                <button
                  onClick={handleNotesSubmit}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 transition-colors disabled:opacity-50"
                  title={t('shopping.save') || 'Save'}
                >
                  ✓
                </button>
              </div>
            ) : (
              item.notes && (
                <p
                  onClick={() => setIsEditingNotes(true)}
                  className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-pre-wrap"
                >
                  {item.notes}
                </p>
              )
            )}
            {!item.notes && !isEditingNotes && (
              <button
                onClick={() => setIsEditingNotes(true)}
                className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {t('shopping.addNotes') || '+ Add notes'}
              </button>
            )}
            <div className="flex flex-col items-start space-y-2 mt-1">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('shopping.addedBy')} {formatUsername(item.added_by_username, t('shopping.unknown'))}{' '}
                {t('shopping.on')} {formatDate(item.created_at, i18n.language)}
              </p>
              {!!item.completed && !!item.completed_by_username && (
                <p className="ml-0 text-xs text-green-600 dark:text-green-400">
                  <span className="mr-1">✅</span>
                  {t('shopping.completedBy')} {formatUsername(item.completed_by_username, t('shopping.unknown'))}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ActionMenu items={actionMenuItems} />
        </div>
      </div>
    </div>
  );
}
