import { useTranslation } from 'react-i18next';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { ShoppingItemRow } from './components/ShoppingItemRow';
import { CreateShoppingItemForm } from './components/CreateShoppingItemForm';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { SortableList } from '@/components/SortableList';
import {
  useShoppingItems,
  useClearAllCompletedShoppingItems,
  useReorderShoppingItems,
  useDeleteShoppingItems,
} from '@hously/shared';
import { useMemo, useState, useEffect } from 'react';

export function ShoppingList() {
  const { t } = useTranslation('common');
  const [completedItemsRef] = useAutoAnimate();

  const { data, refetch, isFetching } = useShoppingItems();
  const clearCompletedMutation = useClearAllCompletedShoppingItems();
  const reorderMutation = useReorderShoppingItems();
  const deleteItemsMutation = useDeleteShoppingItems();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const items = data?.items || [];
  const activeItems = useMemo(
    () => items.filter(item => !item.completed).sort((a, b) => a.position - b.position),
    [items]
  );
  const completedItems = items.filter(item => item.completed);
  const selectedCount = selectedIds.size;

  useEffect(() => {
    if (!isSelectionMode) {
      return;
    }
    setSelectedIds(prev => {
      const validIds = new Set(items.map(item => item.id));
      const next = new Set<number>();
      prev.forEach(id => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [items, isSelectionMode]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev);
    setSelectedIds(new Set());
  };

  const handleSelectToggle = (itemId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedCount === 0) {
      return;
    }
    if (!confirm(t('shopping.deleteSelectedConfirm', { count: selectedCount }))) {
      return;
    }
    deleteItemsMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setSelectedIds(new Set());
      },
    });
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🛒"
        iconColor="text-blue-600"
        title={t('shopping.title')}
        subtitle={t('shopping.subtitle')}
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      <CreateShoppingItemForm />

      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('shopping.currentList')}</h3>
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                {activeItems.length} {activeItems.length !== 1 ? t('shopping.itemsPlural') : t('shopping.items')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isSelectionMode && selectedCount > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  disabled={deleteItemsMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  {t('shopping.deleteSelected', { count: selectedCount })}
                </Button>
              )}
              <Button onClick={handleToggleSelectionMode} variant="secondary" size="sm">
                {isSelectionMode ? t('shopping.cancelSelection') : t('shopping.selectItems')}
              </Button>
            </div>
          </div>
        </div>
        {activeItems.length > 0 ? (
          <SortableList
            items={activeItems}
            onReorder={newOrder => {
              const itemIds = newOrder.map(item => item.id);
              reorderMutation.mutate(itemIds);
            }}
            className="divide-y divide-neutral-100 dark:divide-neutral-700/50"
            disabled={isSelectionMode}
          >
            {(item, handleProps) => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                dragHandleProps={handleProps}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(item.id)}
                onSelectToggle={handleSelectToggle}
              />
            )}
          </SortableList>
        ) : (
          <EmptyState icon="🛒" title={t('shopping.noItems')} description={t('shopping.addFirstItem')} />
        )}
      </div>

      {completedItems.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden mt-6">
          <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t('shopping.recentlyCompleted')}
                </h3>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60 px-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {completedItems.length}
                </span>
              </div>
              <Button
                onClick={() => clearCompletedMutation.mutate()}
                disabled={clearCompletedMutation.isPending}
                variant="secondary"
                size="sm"
              >
                {t('shopping.clearAll')}
              </Button>
            </div>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50" ref={completedItemsRef}>
            {completedItems.map(item => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(item.id)}
                onSelectToggle={handleSelectToggle}
              />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
