import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Trash2,
  Archive,
  RotateCcw,
  ChevronDown,
  Calendar,
  User,
  Tag,
  Flag,
  Hash,
  Clock,
} from "lucide-react";
import { localDateYmd } from "@hously/shared/utils/date";
import { MinimalTiptap } from "@/components/ui/minimal-tiptap";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/pages/settings/useUsers";
import type {
  BoardTask,
  BoardTaskStatusApi,
  BoardTaskPriorityApi,
} from "@hously/shared/types";
import {
  BOARD_TASK_STATUSES,
  BOARD_TASK_PRIORITIES,
} from "@hously/shared/types";
import { useBoardTags } from "@/pages/board/_hooks/useBoardTags";
import { TagPicker } from "./TagPicker";
import { ActivityLog } from "./ActivityLog";
import { CommentInput } from "./CommentInput";
import { DependencySection } from "./DependencySection";
import { TimeEstimateField } from "./TimeEstimateField";
import { LogTimeForm } from "./LogTimeForm";
import { TimeLogHistory } from "./TimeLogHistory";
import { formatMinutes } from "@/pages/board/_utils/time";
import { cn } from "@/lib/utils";

interface TaskDrawerProps {
  task: BoardTask | null;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<BoardTask>) => void;
  onDelete: (id: number) => void;
  onArchive?: (id: number) => void;
  allTasks: BoardTask[];
}

const STATUS_COLORS: Record<BoardTaskStatusApi, string> = {
  backlog: "bg-neutral-400",
  on_hold: "bg-gray-400",
  todo: "bg-blue-500",
  in_progress: "bg-primary-500",
  done: "bg-emerald-500",
};

const STATUS_LABELS: Record<BoardTaskStatusApi, string> = {
  backlog: "Backlog",
  on_hold: "On Hold",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_BG: Record<BoardTaskPriorityApi, string> = {
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const PRIORITY_LABELS: Record<BoardTaskPriorityApi, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function TaskDrawer({
  task,
  onClose,
  onUpdate,
  onDelete,
  onArchive,
  allTasks,
}: TaskDrawerProps) {
  const { t } = useTranslation("common");
  const { data: usersData } = useUsers();
  const users = usersData?.users ?? [];

  const [titleDraft, setTitleDraft] = useState(task?.title ?? "");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const { data: tagsData } = useBoardTags();
  const availableTags = tagsData?.tags ?? [];
  const titleRef = useRef<HTMLInputElement>(null);

  const commitTitle = useCallback(() => {
    if (!task) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(task.title);
      return;
    }
    if (trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed });
    }
  }, [task, titleDraft, onUpdate]);

  const handleFieldChange = useCallback(
    <K extends keyof BoardTask>(field: K, value: BoardTask[K]) => {
      if (!task) return;
      onUpdate(task.id, { [field]: value } as Partial<BoardTask>);
    },
    [task, onUpdate],
  );

  const handleTagsChange = useCallback(
    (tagIds: number[]) => {
      if (!task) return;
      onUpdate(task.id, { tag_ids: tagIds } as unknown as Partial<BoardTask>);
    },
    [task, onUpdate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  const isOverdue = task?.due_date ? task.due_date < localDateYmd() : false;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300",
          task ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Delete confirm dialog */}
      {task && (
        <Dialog
          isOpen={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          title={t("board.deleteTask")}
          panelClassName="max-w-sm"
          showCloseButton={false}
        >
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-300">
            {t("board.deleteConfirm")}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDeleteOpen(false);
                onDelete(task.id);
              }}
            >
              Delete
            </Button>
          </div>
        </Dialog>
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={task?.title ?? "Task details"}
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-900 sm:w-[480px] lg:w-[560px]",
          task ? "translate-x-0" : "translate-x-full",
        )}
      >
        {task && (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-700/60">
              <span className="flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-1 font-mono text-[11px] font-semibold tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <Hash className="h-3 w-3" />
                {task.slug}
              </span>
              <div className="flex-1" />
              {onArchive && (
                <button
                  onClick={() => onArchive(task.id)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors",
                    task.archived
                      ? "hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/20 dark:hover:text-primary-400"
                      : "hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400",
                  )}
                  aria-label={task.archived ? "Restore task" : "Archive task"}
                  title={task.archived ? "Restore task" : "Archive task"}
                >
                  {task.archived ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                aria-label={t("board.deleteTask")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Title */}
              <div className="px-5 pt-5">
                <input
                  ref={titleRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTitle();
                      titleRef.current?.blur();
                    }
                    if (e.key === "Escape") {
                      setTitleDraft(task.title);
                      titleRef.current?.blur();
                    }
                  }}
                  className="w-full bg-transparent text-xl font-semibold text-neutral-900 placeholder-neutral-300 outline-none dark:text-white dark:placeholder-neutral-600 focus:ring-0"
                  placeholder="Task title"
                />
              </div>

              {/* Meta fields grid */}
              <div className="mt-5 grid grid-cols-1 gap-0 border-y border-neutral-100 dark:border-neutral-800">
                {/* Status */}
                <DrawerField
                  icon={<ChevronDown className="h-3.5 w-3.5" />}
                  label="Status"
                >
                  <select
                    value={task.status}
                    onChange={(e) =>
                      handleFieldChange(
                        "status",
                        e.target.value as BoardTaskStatusApi,
                      )
                    }
                    className="w-full bg-transparent text-sm font-medium text-neutral-800 outline-none dark:text-neutral-100"
                  >
                    {BOARD_TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <span
                    className={cn(
                      "ml-auto h-2 w-2 shrink-0 rounded-full",
                      STATUS_COLORS[task.status],
                    )}
                  />
                </DrawerField>

                {/* Priority */}
                <DrawerField
                  icon={<Flag className="h-3.5 w-3.5" />}
                  label="Priority"
                >
                  <select
                    value={task.priority}
                    onChange={(e) =>
                      handleFieldChange(
                        "priority",
                        e.target.value as BoardTaskPriorityApi,
                      )
                    }
                    className="w-full bg-transparent text-sm font-medium text-neutral-800 outline-none dark:text-neutral-100"
                  >
                    {BOARD_TASK_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                      PRIORITY_BG[task.priority],
                    )}
                  >
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </DrawerField>

                {/* Assignee */}
                <DrawerField
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Assignee"
                >
                  <select
                    value={task.assignee_id ?? ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "assignee_id",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full bg-transparent text-sm text-neutral-800 outline-none dark:text-neutral-100"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name
                          ? `${u.first_name}${u.last_name ? " " + u.last_name : ""}`
                          : u.email}
                      </option>
                    ))}
                  </select>
                </DrawerField>

                {/* Start date */}
                <DrawerField
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Start date"
                >
                  <input
                    type="date"
                    value={task.start_date ?? ""}
                    onChange={(e) =>
                      handleFieldChange("start_date", e.target.value || null)
                    }
                    className="w-full bg-transparent text-sm text-neutral-800 outline-none dark:text-neutral-100 dark:[color-scheme:dark]"
                  />
                </DrawerField>

                {/* Due date */}
                <DrawerField
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  label="Due date"
                >
                  <input
                    type="date"
                    value={task.due_date ?? ""}
                    onChange={(e) =>
                      handleFieldChange("due_date", e.target.value || null)
                    }
                    className={cn(
                      "w-full bg-transparent text-sm outline-none dark:[color-scheme:dark]",
                      isOverdue
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-neutral-800 dark:text-neutral-100",
                    )}
                  />
                </DrawerField>

                {/* Time estimate */}
                <DrawerField
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Estimate"
                >
                  <TimeEstimateField
                    estimatedMinutes={task.estimated_minutes}
                    onUpdate={(mins) =>
                      onUpdate(task.id, { estimated_minutes: mins })
                    }
                  />
                  {task.logged_minutes > 0 && (
                    <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
                      {formatMinutes(task.logged_minutes)} logged
                    </span>
                  )}
                </DrawerField>

                {/* Tags */}
                <DrawerField
                  icon={<Tag className="h-3.5 w-3.5" />}
                  label="Tags"
                >
                  <TagPicker
                    selectedTags={task.tags}
                    availableTags={availableTags}
                    onChange={handleTagsChange}
                  />
                </DrawerField>
              </div>

              {/* Description */}
              <div className="px-5 py-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  Description
                </p>
                <MinimalTiptap
                  key={task.id}
                  content={task.description ?? ""}
                  onChange={(html) => {
                    const value = html === "<p></p>" ? null : html;
                    if (value !== task.description) {
                      onUpdate(task.id, { description: value });
                    }
                  }}
                  placeholder="Add a description…"
                  compact
                  className="min-h-[160px] rounded-xl border-neutral-200/80 dark:border-neutral-700/60"
                />
              </div>

              {/* Time tracking */}
              <div className="border-t border-neutral-100 px-5 py-5 dark:border-neutral-800">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  Log Time
                </p>
                <LogTimeForm taskId={task.id} />
                <TimeLogHistory taskId={task.id} />
              </div>

              {/* Dependencies */}
              <div className="border-t border-neutral-100 px-5 py-5 dark:border-neutral-800">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  Dependencies
                </p>
                <DependencySection task={task} allTasks={allTasks} />
              </div>

              {/* Activity */}
              <div className="border-t border-neutral-100 px-5 py-5 dark:border-neutral-800">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  Activity
                </p>
                <ActivityLog taskId={task.id} />
                <div className="mt-4">
                  <CommentInput taskId={task.id} />
                </div>
              </div>

              {/* Footer meta */}
              <div className="border-t border-neutral-100 px-5 py-4 dark:border-neutral-800">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  Created by{" "}
                  <span className="font-medium text-neutral-600 dark:text-neutral-300">
                    {task.created_by_username}
                  </span>
                  {task.created_at && (
                    <>
                      {" "}
                      ·{" "}
                      {new Date(task.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </>
                  )}
                </p>
                {task.updated_at && task.updated_at !== task.created_at && (
                  <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
                    Updated{" "}
                    {new Date(task.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DrawerField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3 last:border-b-0 dark:border-neutral-800">
      <div className="flex w-28 shrink-0 items-center gap-2 text-neutral-400 dark:text-neutral-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}
