import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Plus } from "lucide-react";
import { PageLayout } from "../../components/PageLayout";
import { PageHeader } from "../../components/PageHeader";
import { ChoreRow } from "./components/ChoreRow";
import { CreateChoreModal } from "./components/CreateChoreModal";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/ui/button";
import { SortableList } from "../../components/SortableList";
import {
  useChores,
  useClearAllCompletedChores,
  useReorderChores,
} from "./hooks";
import { HouseLoader } from "@/components/HouseLoader";

export function ChoresList() {
  const { t } = useTranslation("common");
  const [completedChoresRef] = useAutoAnimate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
    [chores]
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
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t("chores.addNewChore")}
          </Button>
        }
      />


      <div className="bg-white dark:bg-neutral-800 shadow rounded-lg">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
              {t("chores.currentChores")}
            </h3>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {pendingChores.length}{" "}
              {pendingChores.length !== 1
                ? t("chores.choresPlural")
                : t("chores.chore")}
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
            className="divide-y divide-neutral-200 dark:divide-neutral-700"
          >
            {(chore, handleProps) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                users={users}
                dragHandleProps={handleProps}
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
        onClose={() => setIsCreateModalOpen(false)}
        users={users}
      />

      {completedChores.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 shadow rounded-lg mt-8">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
                {t("chores.recentlyCompleted")} ({completedChores.length})
              </h3>
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
            className="divide-y divide-neutral-200 dark:divide-neutral-700"
            ref={completedChoresRef}
          >
            {completedChores.map((chore) => (
              <ChoreRow key={chore.id} chore={chore} users={users} />
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
