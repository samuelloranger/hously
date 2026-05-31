import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Plus, ListChecks } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ChoreRow } from "@/pages/chores/_component/ChoreRow";
import { CreateChoreModal } from "@/pages/chores/_component/CreateChoreModal";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/SortableList";
import { useChores } from "@/pages/chores/useChores";
import { useClearAllCompletedChores } from "@/pages/chores/useClearAllCompletedChores";
import { useReorderChores } from "@/pages/chores/useReorderChores";
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
        icon={ListChecks}
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

      <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-700/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-white">
                {t("chores.currentChores")}
              </h3>
              <span className="text-xs font-medium text-neutral-500">
                {pendingChores.length}{" "}
                {pendingChores.length !== 1
                  ? t("chores.choresPlural")
                  : t("chores.chore")}
              </span>
            </div>
          </div>
        </div>

        {isFetching && chores.length === 0 ? (
          <div className="divide-y divide-neutral-700/50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 pl-6 pr-6">
                <div className="w-4 h-4 rounded bg-neutral-800 animate-pulse shrink-0" />
                <div className="w-5 h-5 rounded-full border-2 border-neutral-700 shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div
                    className="h-3.5 w-3/4 rounded-full bg-neutral-800 animate-pulse"
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                  <div
                    className="h-2.5 w-1/3 rounded-full bg-neutral-800 animate-pulse"
                    style={{ animationDelay: `${i * 40 + 20}ms` }}
                  />
                </div>
                <div
                  className="h-7 w-7 rounded-lg bg-neutral-800 animate-pulse shrink-0"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              </div>
            ))}
          </div>
        ) : pendingChores.length > 0 ? (
          <SortableList
            items={pendingChores}
            onReorder={(newOrder) => {
              const choreIds = newOrder.map((chore) => chore.id);
              reorderMutation.mutate(choreIds);
            }}
            className="divide-y divide-neutral-700/50"
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
            icon={ListChecks}
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
        <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800 overflow-hidden mt-6">
          <div className="px-5 py-3.5 border-b border-neutral-700/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-white">
                  {t("chores.recentlyCompleted")}
                </h3>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-700/60 px-1.5 text-[11px] font-semibold text-neutral-400">
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
            className="divide-y divide-neutral-700/50"
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
