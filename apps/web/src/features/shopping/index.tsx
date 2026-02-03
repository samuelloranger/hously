import { useTranslation } from "react-i18next";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PageLayout } from "../../components/PageLayout";
import { PageHeader } from "../../components/PageHeader";
import { ShoppingItemRow } from "./components/ShoppingItemRow";
import { CreateShoppingItemForm } from "./components/CreateShoppingItemForm";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/ui/button";
import { SortableList } from "../../components/SortableList";
import {
  useShoppingItems,
  useClearAllCompletedShoppingItems,
  useReorderShoppingItems,
  useDeleteShoppingItems,
} from "./hooks";
import { useMemo, useState, useEffect } from "react";

export function ShoppingList() {
  const { t } = useTranslation("common");
  const [completedItemsRef] = useAutoAnimate();

  const { data, refetch, isFetching } = useShoppingItems();
  const clearCompletedMutation = useClearAllCompletedShoppingItems();
  const reorderMutation = useReorderShoppingItems();
  const deleteItemsMutation = useDeleteShoppingItems();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const items = data?.items || [];
  const activeItems = useMemo(
    () =>
      items
        .filter((item) => !item.completed)
        .sort((a, b) => a.position - b.position),
    [items]
  );
  const completedItems = items.filter((item) => item.completed);
  const selectedCount = selectedIds.size;

  useEffect(() => {
    if (!isSelectionMode) {
      return;
    }
    setSelectedIds((prev) => {
      const validIds = new Set(items.map((item) => item.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [items, isSelectionMode]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleSelectToggle = (itemId: number) => {
    setSelectedIds((prev) => {
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
    if (!confirm(t("shopping.deleteSelectedConfirm", { count: selectedCount }))) {
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
        title={t("shopping.title")}
        subtitle={t("shopping.subtitle")}
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      <CreateShoppingItemForm />

      <div className="bg-white dark:bg-neutral-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
              {t("shopping.currentList")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                {activeItems.length}{" "}
                {activeItems.length !== 1
                  ? t("shopping.itemsPlural")
                  : t("shopping.items")}
              </div>
              {isSelectionMode && selectedCount > 0 && (
                <Button
                  onClick={handleDeleteSelected}
                  disabled={deleteItemsMutation.isPending}
                  variant="destructive"
                  size="sm"
                >
                  {t("shopping.deleteSelected", { count: selectedCount })}
                </Button>
              )}
              <Button
                onClick={handleToggleSelectionMode}
                variant="secondary"
                size="sm"
              >
                {isSelectionMode
                  ? t("shopping.cancelSelection")
                  : t("shopping.selectItems")}
              </Button>
            </div>
          </div>
        </div>
        {activeItems.length > 0 ? (
          <SortableList
            items={activeItems}
            onReorder={(newOrder) => {
              const itemIds = newOrder.map((item) => item.id);
              reorderMutation.mutate(itemIds);
            }}
            className="divide-y divide-neutral-200 dark:divide-neutral-700"
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
          <EmptyState
            icon="🛒"
            title={t("shopping.noItems")}
            description={t("shopping.addFirstItem")}
          />
        )}
      </div>

      {completedItems.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 shadow rounded-lg mt-8">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
                {t("shopping.recentlyCompleted")} ({completedItems.length})
              </h3>
              <Button
                onClick={() => clearCompletedMutation.mutate()}
                disabled={clearCompletedMutation.isPending}
                variant="secondary"
                size="sm"
              >
                {t("shopping.clearAll")}
              </Button>
            </div>
          </div>
          <div
            className="divide-y divide-neutral-200 dark:divide-neutral-700"
            ref={completedItemsRef}
          >
            {completedItems.map((item) => (
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
