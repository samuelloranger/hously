import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { parseTimeInput, formatMinutes } from '../utils/time';

interface TimeEstimateFieldProps {
  estimatedMinutes: number | null;
  onUpdate: (minutes: number | null) => void;
}

export function TimeEstimateField({ estimatedMinutes, onUpdate }: TimeEstimateFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(estimatedMinutes ? formatMinutes(estimatedMinutes) : '');
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
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="e.g. 2h 30m"
          className="w-28 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs outline-none focus:border-indigo-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        />
        <button onClick={commit} className="text-emerald-500 hover:text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={cancel} className="text-neutral-400 hover:text-neutral-600"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1.5 text-sm text-neutral-700 hover:text-indigo-600 dark:text-neutral-300 dark:hover:text-indigo-400"
    >
      {estimatedMinutes ? formatMinutes(estimatedMinutes) : <span className="text-neutral-400">Not set</span>}
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
    </button>
  );
}
