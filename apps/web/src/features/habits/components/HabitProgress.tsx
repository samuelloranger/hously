import React from 'react';
import { ScheduleStatus } from '@hously/shared';
import { cn } from '@/lib/utils';

interface HabitProgressProps {
  statuses: ScheduleStatus[];
}

export const HabitProgress: React.FC<HabitProgressProps> = ({ statuses }) => {
  return (
    <div className="flex gap-1.5" aria-label={`${statuses.filter(s => s.status === 'done').length} done, ${statuses.filter(s => s.status === 'skipped').length} skipped, ${statuses.length} total`}>
      {statuses.map((s, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full transition-all duration-300",
            s.status === 'done' && "bg-primary-500 dark:bg-primary-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]",
            s.status === 'skipped' && "bg-rose-400 dark:bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.25)]",
            s.status === 'pending' && "bg-neutral-200 dark:bg-neutral-700"
          )}
        />
      ))}
    </div>
  );
};
