import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Plus } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ChoreRow } from "@/pages/chores/_component/ChoreRow";
import { CreateChoreModal } from "@/pages/chores/_component/CreateChoreModal";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/SortableList";
import {
  useChores,
  useClearAllCompletedChores,
  useReorderChores,
} from "@/hooks/useChores";
import { HouseLoader } from "@/components/HouseLoader";
import { useSearch } from "@tanstack/react-router";
import { useModalSearchParams } from "@/lib/routing/useModalSearchParams";
import type { ChoresSearchParams } from "@/pages/chores/_component/ChoreRow";

export function ChoresList() {
  const { t } = useTranslation("common");
  const [completedChoresRef] = useAutoAnimate();

  const searchParams = useSearch({ from: "/chores/" }) as ChoresSearchParams;
  const { setParams, resetParams } = useModalSearchParams(
    "/chores",
    searchParams,
  );
  const isCreateModalOpen = searchParams.modal === "create";

  const { data, refetch, isFetching } = useChores();
  const clearCompletedMutation = useClearAllCompletedChores();
  const reorderMutation = useReorderChores();

  const chores = data?.chores || [];
  const users = data?.users || [];
  const pendingChores = useMemo(
    () =>
      chores
        .filter((chore) => !chore.completed)
        .sort((a, b) => a.position - b.position),
    [chores],
  );
  const completedChores = chores.filter((chore) => chore.completed);

  return (
    <PageLayout>
      <PageHeader
        icon="✅"
        iconColor="text-green-600"
        title={t("chores.title")}
        subtitle={t("chores.subtitle")}
        onRefresh={refetch}
        isRefreshing={isFetching}
        actions={
          <Button
            onClick={() => setParams({ modal: "create" })}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("chores.addNewChore")}
          </Button>
        }
      />

      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("chores.currentChores")}
              </h3>
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                {pendingChores.length}{" "}
                {pendingChores.length !== 1
                  ? t("chores.choresPlural")
                  : t("chores.chore")}
              </span>
            </div>
          </div>
        </div>

        {isFetching && chores.length === 0 ? (
          <HouseLoader size="md" />
        ) : pendingChores.length > 0 ? (
          <SortableList
            items={pendingChores}
            onReorder={(newOrder) => {
              const choreIds = newOrder.map((chore) => chore.id);
              reorderMutation.mutate(choreIds);
            }}
            className="divide-y divide-neutral-100 dark:divide-neutral-700/50"
          >
            {(chore, handleProps) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                users={users}
                dragHandleProps={handleProps}
                setParams={setParams}
                resetParams={resetParams}
                searchParams={searchParams}
              />
            )}
          </SortableList>
        ) : (
          <EmptyState
            icon="✅"
            title={t("chores.noChores")}
            description={t("chores.addFirstChore")}
          />
        )}
      </div>

      <CreateChoreModal
        isOpen={isCreateModalOpen}
        onClose={() => resetParams(["modal"])}
        users={users}
      />

      {completedChores.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden mt-6">
          <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t("chores.recentlyCompleted")}
                </h3>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60 px-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                  {completedChores.length}
                </span>
              </div>
              <Button
                onClick={() => clearCompletedMutation.mutate()}
                disabled={clearCompletedMutation.isPending}
                variant="secondary"
                size="sm"
              >
                {t("chores.clearAll")}
              </Button>
            </div>
          </div>
          <div
            className="divide-y divide-neutral-100 dark:divide-neutral-700/50"
            ref={completedChoresRef}
          >
            {completedChores.map((chore) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                users={users}
                setParams={setParams}
                resetParams={resetParams}
                searchParams={searchParams}
              />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
