import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import type { BoardTag } from "@hously/shared/types";
import { useCreateBoardTag } from "@/pages/board/_hooks/useBoardTags";
import { cn } from "@/lib/utils";

interface TagPickerProps {
  selectedTags: BoardTag[];
  availableTags: BoardTag[];
  onChange: (tagIds: number[]) => void;
}

export function TagPicker({
  selectedTags,
  availableTags,
  onChange,
}: TagPickerProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const createTag = useCreateBoardTag();

  const query = input.trim().toLowerCase();
  const unselectedTags = availableTags.filter(
    (t) => !selectedTags.some((s) => s.id === t.id),
  );
  const matches = query
    ? unselectedTags.filter((t) => t.name.includes(query))
    : unselectedTags;
  const exactMatch = availableTags.some((t) => t.name === query);
  const showCreate = query.length > 0 && !exactMatch;

  const addTag = useCallback(
    (tag: BoardTag) => {
      onChange([...selectedTags.map((t) => t.id), tag.id]);
      setInput("");
      inputRef.current?.focus();
    },
    [selectedTags, onChange],
  );

  const removeTag = useCallback(
    (id: number) => {
      onChange(selectedTags.filter((t) => t.id !== id).map((t) => t.id));
    },
    [selectedTags, onChange],
  );

  const handleCreate = useCallback(async () => {
    if (!query || exactMatch) return;
    try {
      const result = (await createTag.mutateAsync({ name: query })) as
        | { tag?: BoardTag }
        | undefined;
      if (result?.tag) addTag(result.tag);
    } catch {
      // ignore
    }
    setInput("");
  }, [query, exactMatch, createTag, addTag]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (matches.length > 0 && !showCreate) {
          addTag(matches[0]);
        } else if (showCreate) {
          handleCreate();
        }
      }
      if (e.key === ",") {
        e.preventDefault();
        if (matches.length > 0) addTag(matches[0]);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setInput("");
      }
      if (e.key === "Backspace" && input === "" && selectedTags.length > 0) {
        removeTag(selectedTags[selectedTags.length - 1].id);
      }
    },
    [matches, showCreate, input, selectedTags, addTag, handleCreate, removeTag],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {/* Selected tag chips */}
      {selectedTags.map((tag) => (
        <span
          key={tag.id}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={
            tag.color
              ? { backgroundColor: tag.color + "22", color: tag.color }
              : undefined
          }
          // fallback styles when no color
          {...(!tag.color && {
            className:
              "flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
          })}
        >
          {tag.color && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
          )}
          {tag.name}
          <button
            onClick={() => removeTag(tag.id)}
            className="ml-0.5 opacity-60 hover:opacity-100"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      {/* Input */}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={selectedTags.length === 0 ? "Add tag…" : ""}
        className="w-24 min-w-[4rem] bg-transparent text-[12px] text-neutral-600 placeholder-neutral-300 outline-none dark:text-neutral-300 dark:placeholder-neutral-600"
      />

      {/* Dropdown */}
      {open && (matches.length > 0 || showCreate) && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-lg dark:border-neutral-700/60 dark:bg-neutral-800"
        >
          {matches.map((tag) => (
            <button
              key={tag.id}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(tag);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color ?? "#a3a3a3" }}
              />
              {tag.name}
            </button>
          ))}
          {showCreate && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20",
                matches.length > 0 &&
                  "border-t border-neutral-100 dark:border-neutral-700/60",
              )}
            >
              <Plus className="h-3 w-3" />
              Create &ldquo;{query}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
