import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { CompleteCheckbox } from "@/components/CompleteCheckbox";
import { ActionMenu } from "@/components/ActionMenu";
import { ImageModal } from "@/components/ImageModal";
import { EmotionModal } from "@/components/EmotionModal";
import { DragHandle } from "@/components/SortableList";
import { SafeHtml } from "@/components/SafeHtml";
import {
  useDeleteChore,
  useRemoveRecurrence,
  useToggleChore,
} from "@/hooks/useChores";
import { queryKeys } from "@/lib/queryKeys";
import type { Chore, ChoreUser } from "@hously/shared/types";
import { formatUsername, getChoreImageUrl, getChoreThumbnailUrl, isChoreOverdue, formatDate, formatDateTime } from "@hously/shared/utils";
import { EditChoreModal } from "@/pages/chores/_component/EditChoreModal";
import { RecurrenceBadge } from "@/pages/chores/_component/RecurrenceBadge";
import { syncBadge } from "@/lib/sw/registration";
export type ChoresSearchParams = {
  modal?: "create" | "edit";
  choreId?: number;
  viewImage?: string;
};

interface ChoreRowProps {
  chore: Chore;
  users: ChoreUser[];
  dragHandleProps?: {
    setNodeRef: (node: HTMLElement | null) => void;
    handleRef: (node: Element | null) => void;
    style: CSSProperties;
    isDragging: boolean;
  };
  setParams: (updates: Partial<ChoresSearchParams>) => void;
  resetParams: (keys: (keyof ChoresSearchParams)[]) => void;
  searchParams: ChoresSearchParams;
}

export function ChoreRow({
  chore,
  users,
  dragHandleProps,
  setParams,
  resetParams,
  searchParams,
}: ChoreRowProps) {
  const { t, i18n } = useTranslation("common");
  const isEditModalOpen =
    searchParams.modal === "edit" && searchParams.choreId === chore.id;
  const isImageModalOpen = searchParams.viewImage === chore.image_path;

  const [isEmotionModalOpen, setIsEmotionModalOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState(false);
  const queryClient = useQueryClient();

  const toggleMutation = useToggleChore();
  const deleteMutation = useDeleteChore();
  const removeRecurrenceMutation = useRemoveRecurrence();

  const isOverdue = isChoreOverdue(chore.reminder_datetime, chore.completed);
  const hasReminder = !!chore.reminder_datetime && !!chore.reminder_active;

  const handleToggle = async () => {
    if (!chore.completed) {
      setPendingToggle(true);
      setIsEmotionModalOpen(true);
    } else {
      await toggleMutation.mutateAsync({ choreId: chore.id });
      await handleToggleSuccess();
    }
  };

  const handleToggleSuccess = async () => {
    await queryClient.refetchQueries({ queryKey: queryKeys.analytics.all });
    syncBadge();
  };

  const handleEmotionModalClose = () => {
    setIsEmotionModalOpen(false);
    setPendingToggle(false);
  };

  const actionMenuItems = [
    {
      label: chore.completed ? t("chores.undo") : t("chores.markDone"),
      icon: "✓",
      onClick: () => {
        void handleToggle();
      },
      variant: "success" as const,
    },
    ...(chore.recurrence_type && !chore.completed
      ? [
          {
            label: t("chores.removeRecurrence") || "Retirer la récurrence",
            icon: "🔁",
            onClick: () => {
              if (
                confirm(
                  t("chores.removeRecurrenceConfirm") ||
                    "Voulez-vous retirer la récurrence de cette tâche ?",
                )
              ) {
                removeRecurrenceMutation.mutate(chore.id);
              }
            },
            variant: "default" as const,
          },
        ]
      : []),
    {
      label: t("chores.delete"),
      icon: "🗑️",
      onClick: () => {
        if (confirm(t("chores.deleteConfirm"))) {
          deleteMutation.mutate(chore.id);
        }
      },
      variant: "danger" as const,
    },
  ];

  return (
    <div
      ref={dragHandleProps?.setNodeRef}
      style={dragHandleProps?.style}
      className="item-row p-3 pl-6 pr-6 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 min-w-0 flex-1">
          {dragHandleProps && !chore.completed && (
            <DragHandle handleRef={dragHandleProps.handleRef} />
          )}
          <div className="flex items-start space-x-4">
            <CompleteCheckbox
              completed={!!chore.completed}
              onToggle={async () => {
                if (!chore.completed) {
                  setPendingToggle(true);
                  setIsEmotionModalOpen(true);
                  return;
                }

                await toggleMutation.mutateAsync({ choreId: chore.id });
                await handleToggleSuccess();
              }}
              disabled={toggleMutation.isPending}
              className="mt-1"
            />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2">
              {chore.image_path && (
                <img
                  key={`thumbnail-${chore.id}-${chore.image_path}`}
                  src={getChoreThumbnailUrl(chore.image_path) || ""}
                  alt={chore.chore_name}
                  onClick={() => setParams({ viewImage: chore.image_path! })}
                  className="w-8 h-8 object-cover rounded cursor-pointer hover:opacity-80 transition-all duration-300 border border-neutral-300 dark:border-neutral-600 flex-shrink-0"
                />
              )}
              <h4
                onClick={() =>
                  !chore.completed &&
                  setParams({ modal: "edit", choreId: chore.id })
                }
                className={`mb-1 text-sm font-medium ${
                  chore.completed
                    ? "line-through text-neutral-500 dark:text-neutral-400"
                    : "text-neutral-900 dark:text-white cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                }`}
              >
                {chore.chore_name}
              </h4>
            </div>
            {isOverdue && (
              <span className="px-2 py-1 mr-2 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                {t("chores.overdue")}
              </span>
            )}
            <RecurrenceBadge
              recurrence_type={chore.recurrence_type}
              recurrence_interval_days={chore.recurrence_interval_days}
              recurrence_weekday={chore.recurrence_weekday}
              className="py-1"
            />
            {chore.description && (
              <SafeHtml
                html={chore.description}
                className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 break-words prose prose-sm max-w-none dark:prose-invert prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline prose-a:break-all"
              />
            )}
            <div className="flex flex-col items-start space-y-2 mt-2">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("chores.addedBy")}{" "}
                {formatUsername(chore.added_by_username, t("chores.unknown"))}{" "}
                {t("chores.on")} {formatDate(chore.created_at, i18n.language)}
              </p>
              {chore.assigned_to_username ? (
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <span className="mr-1">👤</span>
                  {t("chores.assignedTo")}{" "}
                  {formatUsername(
                    chore.assigned_to_username,
                    t("chores.unknown"),
                  )}
                </p>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="mr-1">👥</span>
                  {t("chores.anyoneCanDoIt")}
                </p>
              )}
              {!!chore.completed && !!chore.completed_by_username && (
                <p className="text-sm text-green-600 dark:text-green-400">
                  <span className="mr-1">✅</span>
                  {t("chores.completedBy")}{" "}
                  {formatUsername(
                    chore.completed_by_username,
                    t("chores.unknown"),
                  )}
                </p>
              )}
              {hasReminder && (
                <p
                  className={`text-sm ${
                    isOverdue
                      ? "text-red-600 dark:text-red-400"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  <span className="mr-1">⏰</span>
                  {t("chores.reminder")}{" "}
                  {formatDateTime(chore.reminder_datetime, i18n.language)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <ActionMenu items={actionMenuItems} />
        </div>
      </div>
      <EditChoreModal
        isOpen={isEditModalOpen}
        onClose={() => resetParams(["modal", "choreId"])}
        chore={chore}
        users={users}
      />
      {chore.image_path && (
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => resetParams(["viewImage"])}
          imageUrl={getChoreImageUrl(chore.image_path) || ""}
          alt={chore.chore_name}
        />
      )}
      <EmotionModal
        isOpen={isEmotionModalOpen}
        onClose={handleEmotionModalClose}
        onSelectEmotion={async (emotion) => {
          if (!pendingToggle) {
            setIsEmotionModalOpen(false);
            return;
          }

          await toggleMutation.mutateAsync({ choreId: chore.id, emotion });
          setPendingToggle(false);
          setIsEmotionModalOpen(false);
          await handleToggleSuccess();
        }}
        taskName={chore.chore_name}
      />
    </div>
  );
}
