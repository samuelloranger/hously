import React from 'react';
import { cn } from '../../../lib/utils';

interface HabitProgressProps {
  current: number;
  target: number;
}

export const HabitProgress: React.FC<HabitProgressProps> = ({ current, target }) => {
  const dots = Array.from({ length: target }, (_, i) => i < current);

  return (
    <div className="flex gap-1.5" aria-label={`${current}/${target} completed`}>
      {dots.map((isFilled, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-all duration-300",
            isFilled 
              ? "bg-primary-500 dark:bg-primary-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
              : "bg-neutral-200 dark:bg-neutral-700"
          )}
        />
      ))}
    </div>
  );
};
