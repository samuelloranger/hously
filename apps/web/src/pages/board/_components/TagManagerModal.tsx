import { useState } from "react";
import { Pencil, Trash2, Check, Merge } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import type { BoardTagWithCount } from "@hously/shared/types";
import {
  useBoardTags,
  useUpdateBoardTag,
  useDeleteBoardTag,
} from "@/pages/board/_hooks/useBoardTags";
import { cn } from "@/lib/utils";

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TAG_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#06b6d4",
  "#a3a3a3",
];

export function TagManagerModal({ isOpen, onClose }: TagManagerModalProps) {
  const { data } = useBoardTags();
  const tags = data?.tags ?? [];
  const updateTag = useUpdateBoardTag();
  const deleteTag = useDeleteBoardTag();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [mergeIntoId, setMergeIntoId] = useState<number | "">("");

  const startEdit = (tag: BoardTagWithCount) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor(null);
  };

  const commitEdit = (id: number) => {
    const name = editName.trim();
    if (!name) return;
    updateTag.mutate(
      { id, data: { name, color: editColor } },
      {
        onSuccess: () => {
          setEditingId(null);
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteTag.mutate(
      {
        id,
        data: mergeIntoId ? { merge_into_id: Number(mergeIntoId) } : undefined,
      },
      {
        onSuccess: () => {
          setDeleteConfirmId(null);
          setMergeIntoId("");
        },
      },
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Tags"
      panelClassName="max-w-md"
    >
      <div className="flex flex-col gap-1">
        {tags.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-400">
            No tags yet. Create tags from the task drawer.
          </p>
        )}

        {tags.map((tag) => {
          const isEditing = editingId === tag.id;
          const isDeleting = deleteConfirmId === tag.id;

          if (isEditing) {
            return (
              <div
                key={tag.id}
                className="flex flex-col gap-2 rounded-lg border p-3 border-primary-700/40 bg-primary-900/10"
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit(tag.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="rounded-md border px-2 py-1 text-sm outline-none focus:border-primary-400 border-neutral-600 bg-neutral-800 text-white"
                />
                {/* Color swatches */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setEditColor(null)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 bg-neutral-600",
                      editColor === null
                        ? "border-neutral-500"
                        : "border-transparent",
                    )}
                    title="No color"
                  />
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      className={cn(
                        "h-5 w-5 rounded-full border-2",
                        editColor === c
                          ? "border-white"
                          : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => commitEdit(tag.id)}
                    disabled={updateTag.isPending}
                    className="h-7 bg-primary-600 px-3 text-xs hover:bg-primary-700"
                  >
                    <Check className="mr-1 h-3 w-3" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEdit}
                    className="h-7 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            );
          }

          if (isDeleting) {
            const others = tags.filter((t) => t.id !== tag.id);
            return (
              <div
                key={tag.id}
                className="flex flex-col gap-2 rounded-lg border p-3 border-red-700/40 bg-red-900/10"
              >
                <p className="text-sm text-neutral-200">
                  Delete <strong>&ldquo;{tag.name}&rdquo;</strong>
                  {tag.task_count > 0 && (
                    <span className="ml-1 text-neutral-500">
                      ({tag.task_count} task{tag.task_count !== 1 ? "s" : ""})
                    </span>
                  )}
                  ?
                </p>
                {others.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Merge className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <select
                      value={mergeIntoId}
                      onChange={(e) =>
                        setMergeIntoId(
                          e.target.value ? Number(e.target.value) : "",
                        )
                      }
                      className="flex-1 rounded border px-2 py-1 text-xs border-neutral-600 bg-neutral-800 text-neutral-200"
                    >
                      <option value="">Just delete (remove from tasks)</option>
                      {others.map((t) => (
                        <option key={t.id} value={t.id}>
                          Merge into &ldquo;{t.name}&rdquo;
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(tag.id)}
                    disabled={deleteTag.isPending}
                    className="h-7 px-3 text-xs"
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeleteConfirmId(null);
                      setMergeIntoId("");
                    }}
                    className="h-7 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-800/60"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color ?? "#a3a3a3" }}
              />
              <span className="flex-1 text-sm font-medium text-neutral-100">
                {tag.name}
              </span>
              <span className="text-[11px] text-neutral-400">
                {tag.task_count} task{tag.task_count !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 [.group:hover_&]:opacity-100">
                <button
                  onClick={() => startEdit(tag)}
                  className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirmId(tag.id);
                    setEditingId(null);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-red-900/20 hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
