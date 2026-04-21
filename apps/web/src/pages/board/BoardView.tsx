import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BOARD_KANBAN_STATUSES,
  type BoardTag,
  type BoardTaskStatusApi,
  type BoardTasksResponse,
} from "@hously/shared/types";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { HouseLoader } from "@/components/HouseLoader";
import { useJsonEventSource } from "@/lib/realtime/useEventSource";
import { useUsers } from "@/pages/settings/useUsers";
import { BOARD_TASKS_ENDPOINTS } from "@/lib/endpoints";
import { queryKeys } from "@/lib/queryKeys";
import {
  useArchivedBoardTasks,
  useBoardTasks,
} from "@/pages/board/_hooks/useBoardTasks";
import { useBoardTags } from "@/pages/board/_hooks/useBoardTags";
import { useBoardDragDrop } from "@/pages/board/_hooks/useBoardDragDrop";
import { useBoardSelection } from "@/pages/board/_hooks/useBoardSelection";
import { useBoardFilters } from "@/pages/board/_hooks/useBoardFilters";
import {
  useBoardCreateForm,
  type ViewMode,
} from "@/pages/board/_hooks/useBoardCreateForm";
import { useBoardDrawer } from "@/pages/board/_hooks/useBoardDrawer";
import { BoardToolbar } from "@/pages/board/_components/BoardToolbar";
import { BulkActionsBar } from "@/pages/board/_components/BulkActionsBar";
import { CreateTaskForm } from "@/pages/board/_components/CreateTaskForm";
import { FilterBar } from "@/pages/board/_components/FilterBar";
import { BoardKanban } from "@/pages/board/_components/BoardKanban";
import { BacklogView } from "@/pages/board/_components/BacklogView";
import { ArchiveView } from "@/pages/board/_components/ArchiveView";
import { TaskDrawer } from "@/pages/board/_components/TaskDrawer";
import { TagManagerModal } from "@/pages/board/_components/TagManagerModal";

export function BoardView() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const { data, isLoading } = useBoardTasks();
  const { data: usersData } = useUsers();
  const users = usersData?.users ?? [];

  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);

  const { data: archivedData } = useArchivedBoardTasks(viewMode === "archive");
  const archivedTasks = archivedData?.tasks ?? [];

  const { data: tagsData } = useBoardTags();
  const allTags: BoardTag[] = tagsData?.tags ?? [];

  useJsonEventSource<BoardTasksResponse>({
    url: BOARD_TASKS_ENDPOINTS.STREAM,
    logLabel: "Board tasks stream",
    onMessage: (payload) => {
      queryClient.setQueryData(queryKeys.boardTasks.list(), payload);
    },
  });

  const allTasks = data?.tasks ?? [];
  const kanbanTasks = useMemo(
    () =>
      allTasks.filter((t) =>
        (BOARD_KANBAN_STATUSES as readonly string[]).includes(t.status),
      ),
    [allTasks],
  );

  // Hooks
  const {
    columns,
    setColumns,
    columnsRef,
    sensors,
    syncMutation,
    dragHandlers,
  } = useBoardDragDrop(kanbanTasks);
  const drawer = useBoardDrawer(allTasks);
  const selection = useBoardSelection({
    kanbanTasks,
    columnsRef,
    setColumns,
    onTaskClosed: drawer.closeIfMatches,
  });
  const filterState = useBoardFilters(columns, allTasks);
  const createForm = useBoardCreateForm(viewMode);

  useEffect(() => {
    if (viewMode !== "board") selection.clearSelection();
  }, [viewMode]);

  const statusLabel = (s: BoardTaskStatusApi) => t(`board.status.${s}`);

  const activeFilterCount = [
    filterState.filters.tags.length > 0,
    filterState.filters.assigneeId !== null,
    filterState.filters.priority !== null,
    filterState.filters.dueDateFilter !== null,
  ].filter(Boolean).length;

  const handleCardClick = (
    task: Parameters<typeof selection.handleBoardCardClick>[0],
    e: Parameters<typeof selection.handleBoardCardClick>[1],
  ) => {
    const handled = selection.handleBoardCardClick(task, e);
    if (!handled) drawer.openTaskDrawer(task);
  };

  if (isLoading && !data) {
    return (
      <PageLayout>
        <HouseLoader size="md" />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        icon={LayoutGrid}
        iconColor="text-primary-600"
        title={t("board.title")}
        subtitle={t("board.subtitle")}
      />

      <BoardToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        backlogCount={allTasks.length}
        hasActiveFilters={filterState.hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onToggleFilters={() => filterState.setShowFilters((v) => !v)}
        backlogSort={filterState.backlogSort}
        onBacklogSortChange={filterState.setBacklogSort}
        backlogSortDir={filterState.backlogSortDir}
        onBacklogSortDirToggle={() =>
          filterState.setBacklogSortDir((d) => (d === "asc" ? "desc" : "asc"))
        }
        onCreateToggle={() => createForm.setShowCreate((v) => !v)}
      />

      {viewMode === "board" && selection.selectedTaskIds.length > 0 && (
        <BulkActionsBar
          selectedCount={selection.selectedTaskIds.length}
          statusLabel={statusLabel}
          syncPending={selection.syncMutation.isPending}
          archivePending={selection.archiveMutation.isPending}
          deletePending={selection.deleteMutation.isPending}
          deleteConfirmPending={selection.deleteConfirmPending}
          onMoveToColumn={selection.handleBulkMoveToColumn}
          onArchive={() => void selection.handleBulkArchive()}
          onDelete={selection.handleBulkDelete}
          onConfirmDelete={() => void selection.confirmBulkDelete()}
          onCancelDelete={() => selection.setDeleteConfirmPending(false)}
          onClear={selection.clearSelection}
        />
      )}

      {createForm.showCreate && (
        <CreateTaskForm
          newTitle={createForm.newTitle}
          onTitleChange={createForm.setNewTitle}
          createStatus={createForm.createStatus}
          onStatusChange={createForm.setCreateStatus}
          onCreate={createForm.handleCreate}
          onClose={() => createForm.setShowCreate(false)}
          isPending={createForm.isPending}
          statusLabel={statusLabel}
        />
      )}

      {filterState.showFilters && (
        <FilterBar
          filters={filterState.filters}
          onChange={filterState.setFilters}
          hasActiveFilters={filterState.hasActiveFilters}
          allTags={allTags}
          users={users}
          onManageTags={() => setShowTagManager(true)}
        />
      )}

      {viewMode === "board" && (
        <BoardKanban
          columns={filterState.filteredKanbanColumns}
          unfilteredColumns={columns}
          hasActiveFilters={filterState.hasActiveFilters}
          sensors={sensors}
          dragHandlers={dragHandlers}
          selectedSet={selection.selectedSet}
          onToggleSelect={selection.toggleTaskSelect}
          onCardClick={handleCardClick}
        />
      )}

      {viewMode === "backlog" && (
        <BacklogView
          tasks={filterState.filteredBacklogTasks}
          onTaskClick={drawer.openTaskDrawer}
        />
      )}

      {viewMode === "archive" && (
        <ArchiveView
          tasks={archivedTasks}
          onTaskClick={drawer.openTaskDrawer}
          onRestore={(id) => {
            setRestoringId(id);
            selection.archiveMutation.mutate(
              { id, archived: false },
              { onSettled: () => setRestoringId(null) },
            );
          }}
          restoringId={restoringId}
        />
      )}

      {(syncMutation.isPending || selection.syncMutation.isPending) && (
        <p className="mt-2 text-center text-xs text-neutral-400">
          {t("board.saving")}
        </p>
      )}

      <TaskDrawer
        key={drawer.selectedTask?.id ?? "none"}
        task={drawer.selectedTask}
        onClose={drawer.closeTaskDrawer}
        onUpdate={drawer.handleDrawerUpdate}
        onDelete={drawer.handleDelete}
        onArchive={drawer.handleArchive}
        allTasks={allTasks}
      />

      <TagManagerModal
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
      />
    </PageLayout>
  );
}
