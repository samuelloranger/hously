import React from 'react';
import { cn } from '../../../lib/utils';

interface HabitProgressProps {
  completed: number;
  skipped: number;
  target: number;
}

export const HabitProgress: React.FC<HabitProgressProps> = ({ completed, skipped, target }) => {
  const dots = Array.from({ length: target }, (_, i) => {
    if (i < completed) return 'done';
    if (i < completed + skipped) return 'skipped';
    return 'remaining';
  });

  return (
    <div className="flex gap-1.5" aria-label={`${completed} done, ${skipped} skipped, ${target} total`}>
      {dots.map((status, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-all duration-300",
            status === 'done' && "bg-primary-500 dark:bg-primary-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]",
            status === 'skipped' && "bg-rose-400 dark:bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.25)]",
            status === 'remaining' && "bg-neutral-200 dark:bg-neutral-700"
          )}
        />
      ))}
    </div>
  );
};
