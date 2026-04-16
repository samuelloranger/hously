import { X } from "lucide-react";
import type { BoardTag, BoardTaskPriorityApi } from "@hously/shared/types";
import { cn } from "@/lib/utils";
import type { BoardFilters } from "@/pages/board/_utils/filters";
import { EMPTY_FILTERS } from "@/pages/board/_utils/filters";
import { FilterSelect } from "@/pages/board/_components/FilterSelect";

interface FilterBarProps {
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
  hasActiveFilters: boolean;
  allTags: BoardTag[];
  users: Array<{
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  }>;
  onManageTags: () => void;
}

export function FilterBar({
  filters,
  onChange,
  hasActiveFilters,
  allTags,
  users,
  onManageTags,
}: FilterBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-4 py-3 dark:border-neutral-700/60 dark:bg-neutral-800">
      {/* Priority */}
      <FilterSelect
        label="Priority"
        value={filters.priority ?? ""}
        onChange={(v) =>
          onChange({
            ...filters,
            priority: (v || null) as BoardTaskPriorityApi | null,
          })
        }
      >
        <option value="">Any priority</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </FilterSelect>

      {/* Assignee */}
      {users.length > 0 && (
        <FilterSelect
          label="Assignee"
          value={filters.assigneeId?.toString() ?? ""}
          onChange={(v) =>
            onChange({ ...filters, assigneeId: v ? Number(v) : null })
          }
        >
          <option value="">Any assignee</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.first_name
                ? `${u.first_name}${u.last_name ? " " + u.last_name : ""}`
                : u.email}
            </option>
          ))}
        </FilterSelect>
      )}

      {/* Due date filter */}
      <FilterSelect
        label="Due date"
        value={filters.dueDateFilter ?? ""}
        onChange={(v) =>
          onChange({
            ...filters,
            dueDateFilter: (v || null) as BoardFilters["dueDateFilter"],
          })
        }
      >
        <option value="">Any date</option>
        <option value="overdue">Overdue</option>
        <option value="this_week">Due this week</option>
      </FilterSelect>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() =>
                onChange(
                  filters.tags.includes(tag.id)
                    ? {
                        ...filters,
                        tags: filters.tags.filter((id) => id !== tag.id),
                      }
                    : { ...filters, tags: [...filters.tags, tag.id] },
                )
              }
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                filters.tags.includes(tag.id)
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600",
              )}
            >
              {tag.color && (
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: filters.tags.includes(tag.id)
                      ? "white"
                      : tag.color,
                  }}
                />
              )}
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Manage tags link */}
      <button
        onClick={onManageTags}
        className="ml-auto text-[11px] text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        Manage tags
      </button>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      )}
    </div>
  );
}
