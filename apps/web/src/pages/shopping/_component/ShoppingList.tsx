import { useTranslation } from 'react-i18next';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Search, X } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { ShoppingItemRow } from '@/pages/shopping/_component/ShoppingItemRow';
import { CreateShoppingItemForm } from '@/pages/shopping/_component/CreateShoppingItemForm';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SortableList } from '@/components/SortableList';
import {
  useShoppingItems,
  useClearAllCompletedShoppingItems,
  useReorderShoppingItems,
  useDeleteShoppingItems,
} from '@/hooks/useShopping';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

type ShoppingStatusFilter = 'all' | 'active' | 'completed' | 'notes';

export function ShoppingList() {
  const { t } = useTranslation('common');
  const [completedItemsRef] = useAutoAnimate();

  const { data, refetch, isFetching } = useShoppingItems();
  const clearCompletedMutation = useClearAllCompletedShoppingItems();
  const reorderMutation = useReorderShoppingItems();
  const deleteItemsMutation = useDeleteShoppingItems();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShoppingStatusFilter>('all');
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const items = data?.items || [];
  const filteredItems = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return items.filter(item => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.item_name.toLowerCase().includes(normalizedQuery) ||
        item.notes?.toLowerCase().includes(normalizedQuery);

      const matchesFilter =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !item.completed) ||
        (statusFilter === 'completed' && item.completed) ||
        (statusFilter === 'notes' && Boolean(item.notes?.trim()));

      return matchesQuery && matchesFilter;
    });
  }, [deferredQuery, items, statusFilter]);
  const activeItems = useMemo(
    () => filteredItems.filter(item => !item.completed).sort((a, b) => a.position - b.position),
    [filteredItems]
  );
  const completedItems = useMemo(() => filteredItems.filter(item => item.completed), [filteredItems]);
  const validSelectedIds = useMemo(() => {
    const validIds = new Set(items.map(item => item.id));
    return new Set([...selectedIds].filter(id => validIds.has(id)));
  }, [items, selectedIds]);
  const selectedCount = validSelectedIds.size;
  const totalMatches = activeItems.length + completedItems.length;
  const hasFilters = query.trim().length > 0 || statusFilter !== 'all';

  const filterOptions = [
    { id: 'all' as const, label: t('shopping.filters.all') },
    { id: 'active' as const, label: t('shopping.filters.active') },
    { id: 'completed' as const, label: t('shopping.filters.completed') },
    { id: 'notes' as const, label: t('shopping.filters.notes') },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

      if (!isTypingField && event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current && query) {
        setQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [query]);

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
    deleteItemsMutation.mutate(Array.from(validSelectedIds), {
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

      <section className="mb-6 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-700/60 dark:bg-neutral-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('shopping.searchPlaceholder')}
              className="pl-9 pr-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                aria-label={t('shopping.clearSearch')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map(option => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={statusFilter === option.id ? 'default' : 'secondary'}
                onClick={() => setStatusFilter(option.id)}
              >
                {option.label}
              </Button>
            ))}
            {hasFilters && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
              >
                {t('shopping.clearFilters')}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <p>{t('shopping.results', { count: totalMatches, total: items.length })}</p>
          <p>{t('shopping.searchShortcut')}</p>
        </div>
      </section>

      <CreateShoppingItemForm />

      {items.length === 0 ? (
        <EmptyState icon="🛒" title={t('shopping.noItems')} description={t('shopping.addFirstItem')} />
      ) : totalMatches === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200/80 bg-white px-6 py-12 text-center dark:border-neutral-700/60 dark:bg-neutral-800">
          <p className="text-base font-semibold text-neutral-900 dark:text-white">{t('shopping.emptyFilteredTitle')}</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t('shopping.emptyFilteredDescription')}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              setQuery('');
              setStatusFilter('all');
            }}
          >
            {t('shopping.clearFilters')}
          </Button>
        </div>
      ) : (
        <>
          {activeItems.length > 0 && (
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {t('shopping.currentList')}
                    </h3>
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
                    isSelected={validSelectedIds.has(item.id)}
                    onSelectToggle={handleSelectToggle}
                  />
                )}
              </SortableList>
            </div>
          )}

          {completedItems.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white dark:border-neutral-700/60 dark:bg-neutral-800">
              <div className="border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {t('shopping.recentlyCompleted')}
                    </h3>
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400">
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
                    isSelected={validSelectedIds.has(item.id)}
                    onSelectToggle={handleSelectToggle}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
