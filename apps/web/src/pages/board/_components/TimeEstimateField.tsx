import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { parseTimeInput, formatMinutes } from "@/pages/board/_utils/time";

interface TimeEstimateFieldProps {
  estimatedMinutes: number | null;
  onUpdate: (minutes: number | null) => void;
}

export function TimeEstimateField({
  estimatedMinutes,
  onUpdate,
}: TimeEstimateFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(estimatedMinutes ? formatMinutes(estimatedMinutes) : "");
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseTimeInput(draft);
    onUpdate(parsed);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          placeholder="e.g. 2h 30m"
          className="w-28 rounded border px-2 py-0.5 text-xs outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/40 border-neutral-700 bg-neutral-900 text-neutral-100"
        />
        <button
          onClick={commit}
          className="text-emerald-500 hover:text-emerald-600"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={cancel}
          className="text-neutral-400 hover:text-neutral-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1.5 text-sm text-neutral-300 hover:text-primary-400"
    >
      {estimatedMinutes ? (
        formatMinutes(estimatedMinutes)
      ) : (
        <span className="text-neutral-400">Not set</span>
      )}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
    </button>
  );
}
