import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Lock } from "lucide-react";
import { useAddDependency } from "@/pages/board/_hooks/useAddDependency";
import { useRemoveDependency } from "@/pages/board/_hooks/useRemoveDependency";
import type { BoardTask, TaskDependencyRef } from "@hously/shared/types";
interface DependencySectionProps {
  task: BoardTask;
  allTasks: BoardTask[];
}

function DepList({
  label,
  items,
  onRemove,
  isRemoving,
}: {
  label: string;
  items: TaskDependencyRef[];
  onRemove: (depId: number) => void;
  isRemoving: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      {items.length === 0 && (
        <p className="text-[12px] text-neutral-500">
          {t("common.none")}
        </p>
      )}
      {items.map((dep) => (
        <div key={dep.id} className="flex items-center gap-2 py-1">
          <span className="font-mono text-[10px] text-neutral-400">
            {dep.slug}
          </span>
          <span className="flex-1 truncate text-[12px] text-neutral-200">
            {dep.title}
          </span>
          {"is_resolved" in dep && !dep.is_resolved && (
            <Lock
              className="h-3 w-3 shrink-0 text-amber-400"
              aria-label="Blocking"
            />
          )}
          <button
            onClick={() => onRemove(dep.id)}
            disabled={isRemoving}
            className="text-neutral-400 hover:text-rose-400"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AddDepInput({
  label,
  allTasks,
  excludeIds,
  onAdd,
  isPending,
}: {
  label: string;
  allTasks: BoardTask[];
  excludeIds: number[];
  onAdd: (taskId: number) => void;
  isPending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const lower = query.trim().toLowerCase();
  const matches = lower
    ? allTasks
        .filter(
          (t) =>
            !excludeIds.includes(t.id) &&
            (t.slug.toLowerCase().includes(lower) ||
              t.title.toLowerCase().includes(lower)),
        )
        .slice(0, 6)
    : [];

  return (
    <div className="relative mt-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1.5 border-neutral-700">
        <Plus className="h-3 w-3 shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Add "${label}" by slug or title…`}
          className="flex-1 bg-transparent text-[12px] placeholder-neutral-400 outline-none text-neutral-300"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg border-neutral-700/60 bg-neutral-800">
          {matches.map((t) => (
            <button
              key={t.id}
              onMouseDown={() => {
                onAdd(t.id);
                setQuery("");
                setOpen(false);
              }}
              disabled={isPending}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-700/60"
            >
              <span className="font-mono text-[10px] text-neutral-400">
                {t.slug}
              </span>
              <span className="truncate text-[12px] text-neutral-200">
                {t.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DependencySection({ task, allTasks }: DependencySectionProps) {
  const addDep = useAddDependency();
  const removeDep = useRemoveDependency();

  const blocksIds = task.blocks.map((d) => d.task_id);
  const blockedByIds = task.blocked_by.map((d) => d.task_id);
  const excludeForBlocks = [task.id, ...blocksIds, ...blockedByIds];
  const excludeForBlockedBy = [task.id, ...blocksIds, ...blockedByIds];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DepList
          label="Blocks"
          items={task.blocks}
          onRemove={(depId) => removeDep.mutate({ id: task.id, depId })}
          isRemoving={removeDep.isPending}
        />
        <AddDepInput
          label="blocks"
          allTasks={allTasks}
          excludeIds={excludeForBlocks}
          onAdd={(targetId) =>
            addDep.mutate({ id: task.id, data: { blocked_task_id: targetId } })
          }
          isPending={addDep.isPending}
        />
      </div>

      <div className="border-t pt-4 border-neutral-800">
        <DepList
          label="Blocked by"
          items={task.blocked_by}
          onRemove={(depId) => removeDep.mutate({ id: task.id, depId })}
          isRemoving={removeDep.isPending}
        />
        <AddDepInput
          label="blocked by"
          allTasks={allTasks}
          excludeIds={excludeForBlockedBy}
          onAdd={(targetId) =>
            addDep.mutate({ id: task.id, data: { blocking_task_id: targetId } })
          }
          isPending={addDep.isPending}
        />
      </div>
    </div>
  );
}
