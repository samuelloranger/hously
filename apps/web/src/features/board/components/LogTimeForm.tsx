import { useEffect, useRef, useState } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogTime } from '@/hooks/useBoardTasks';
import { parseTimeInput, formatMinutes } from '../utils/time';

export function LogTimeForm({ taskId }: { taskId: number }) {
  const [timeInput, setTimeInput] = useState('');
  const [note, setNote] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { mutate, isPending } = useLogTime();

  const startTimer = () => {
    startRef.current = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);
    setIsRunning(true);
  };

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const mins = Math.max(1, Math.round(elapsed / 60));
    setTimeInput(formatMinutes(mins));
    setIsRunning(false);
    setElapsed(0);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const submit = () => {
    const mins = parseTimeInput(timeInput);
    if (!mins || mins <= 0) return;
    mutate(
      { taskId, data: { minutes: mins, note: note.trim() || undefined } },
      { onSuccess: () => { setTimeInput(''); setNote(''); } }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-700 dark:bg-neutral-800/60">
          <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <input
            value={isRunning ? `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')} (running…)` : timeInput}
            onChange={e => !isRunning && setTimeInput(e.target.value)}
            readOnly={isRunning}
            placeholder="e.g. 1h 30m"
            className="flex-1 bg-transparent text-sm outline-none placeholder-neutral-400 dark:text-neutral-100"
          />
        </div>
        <button
          onClick={isRunning ? stopTimer : startTimer}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            isRunning
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400'
              : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
          title={isRunning ? 'Stop timer' : 'Start timer'}
        >
          {isRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm outline-none placeholder-neutral-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-100"
      />
      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={isPending || !timeInput.trim()}
          className="h-7 bg-indigo-600 px-3 text-xs hover:bg-indigo-700"
        >
          Log time
        </Button>
      </div>
    </div>
  );
}
