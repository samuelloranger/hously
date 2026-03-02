import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import { Habit, useCompleteHabit, useUncompleteHabit } from '@hously/shared';
import { cn } from '../../../lib/utils';
import { HabitProgress } from './HabitProgress';
import { StreakBadge } from './StreakBadge';
import { ActionMenu } from '../../../components/ActionMenu';

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export const HabitCard: React.FC<HabitCardProps> = ({ habit, onEdit, onDelete }) => {
  const { t } = useTranslation('common');
  const completeMutation = useCompleteHabit();
  const uncompleteMutation = useUncompleteHabit();
  
  const isFullyCompleted = habit.today_completions >= habit.times_per_day;

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullyCompleted) return;
    completeMutation.mutate(habit.id);
  };

  const handleUncomplete = () => {
    if (habit.today_completions <= 0) return;
    uncompleteMutation.mutate(habit.id);
  };

  const actionMenuItems = [
    {
      label: t('common.update'),
      icon: '✏️',
      onClick: () => onEdit(habit),
    },
    ...(habit.today_completions > 0 ? [{
      label: t('shopping.undo'),
      icon: '↩️',
      onClick: handleUncomplete,
    }] : []),
    {
      label: t('common.delete'),
      icon: '🗑️',
      onClick: () => onDelete(habit),
      variant: 'danger' as const,
    },
  ];

  return (
    <div
      className={cn(
        "group relative overflow-hidden p-4 rounded-2xl bg-white dark:bg-neutral-800 border transition-all duration-300",
        isFullyCompleted
          ? "border-green-500/30 bg-green-50/10 dark:bg-green-500/5 shadow-sm"
          : "border-neutral-200/80 dark:border-neutral-700/60 hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5",
        !habit.active && "opacity-60 grayscale-[0.3]"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60 text-2xl shrink-0 group-hover:scale-110 transition-transform duration-300">
            {habit.emoji}
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 dark:text-white leading-tight">
              {habit.name}
            </h3>
            {habit.description && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                {habit.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ActionMenu items={actionMenuItems} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="space-y-2">
          <HabitProgress current={habit.today_completions} target={habit.times_per_day} />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {habit.schedules.map((s) => (
              <span 
                key={s.id} 
                className="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700/60 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700"
              >
                {s.time}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <StreakBadge streak={habit.current_streak} />
          
          <button
            onClick={handleComplete}
            disabled={isFullyCompleted || completeMutation.isPending}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300",
              isFullyCompleted
                ? "bg-green-500/20 text-green-600 dark:text-green-400 cursor-default"
                : "bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/20 active:scale-90"
            )}
          >
            {isFullyCompleted ? (
              <Check size={20} strokeWidth={3} />
            ) : (
              <Plus size={20} strokeWidth={3} className={cn(completeMutation.isPending && "animate-pulse")} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
