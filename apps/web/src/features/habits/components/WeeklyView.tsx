import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Check, X, Minus, Pencil, Trash2 } from 'lucide-react';
import {
  useWeeklyHabits,
  useCompleteHabitForDate,
  useUncompleteHabitForDate,
  WeeklyHabit,
} from '@hously/shared';
import { cn } from '../../../lib/utils';
import { StreakBadge } from './StreakBadge';

interface WeeklyViewProps {
  onEdit: (habit: WeeklyHabit) => void;
  onDelete: (habit: WeeklyHabit) => void;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return formatLocal(d);
}

function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return formatLocal(date);
}

function formatDayNumber(dateStr: string): string {
  const [, , d] = dateStr.split('-').map(Number);
  return String(d);
}

function formatMonthRange(days: string[]): string {
  if (days.length === 0) return '';
  const [startY, startM] = days[0].split('-').map(Number);
  const [endY, endM] = days[days.length - 1].split('-').map(Number);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (startY === endY && startM === endM) {
    return `${months[startM - 1]} ${startY}`;
  }
  if (startY === endY) {
    return `${months[startM - 1]} – ${months[endM - 1]} ${startY}`;
  }
  return `${months[startM - 1]} ${startY} – ${months[endM - 1]} ${endY}`;
}

type CellStatus = 'complete' | 'partial' | 'skipped' | 'mixed' | 'empty' | 'future';

function getCellStatus(
  day: { completions: number; skipped: number; target: number } | undefined,
  dateStr: string,
  todayStr: string
): CellStatus {
  if (!day) return dateStr > todayStr ? 'future' : 'empty';
  if (dateStr > todayStr) return 'future';
  if (day.completions >= day.target) return 'complete';
  if (day.completions > 0 && day.skipped > 0) return 'mixed';
  if (day.skipped >= day.target) return 'skipped';
  if (day.completions > 0) return 'partial';
  if (day.skipped > 0) return 'skipped';
  return 'empty';
}

export const WeeklyView: React.FC<WeeklyViewProps> = ({ onEdit, onDelete }) => {
  const { t, i18n } = useTranslation('common');
  const todayStr = formatLocal(new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const { data, isLoading } = useWeeklyHabits(weekStart);
  const completeMutation = useCompleteHabitForDate();
  const uncompleteMutation = useUncompleteHabitForDate();

  const days = useMemo(() => {
    if (data?.days) return data.days;
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [data?.days, weekStart]);

  const isCurrentWeek = weekStart === getMonday(new Date());

  const navigateWeek = (direction: -1 | 1) => {
    setWeekStart(prev => addDays(prev, direction * 7));
  };

  const goToCurrentWeek = () => {
    setWeekStart(getMonday(new Date()));
  };

  const handleCellClick = (habit: WeeklyHabit, dateStr: string) => {
    if (dateStr > todayStr) return;

    const dayData = habit.days[dateStr];
    if (!dayData) return;

    const accounted = dayData.completions + dayData.skipped;

    if (dayData.completions > 0) {
      uncompleteMutation.mutate({ id: habit.id, date: dateStr });
    } else if (accounted < dayData.target) {
      completeMutation.mutate({ id: habit.id, date: dateStr });
    }
  };

  const localizedDays = useMemo(() => {
    return days.map((dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const shortDay = date.toLocaleDateString(i18n.language, { weekday: 'short' });
      return { dateStr, shortDay, dayNum: formatDayNumber(dateStr) };
    });
  }, [days, i18n.language]);

  const habits = data?.habits || [];

  const weekCompletion = useMemo(() => {
    if (habits.length === 0) return 0;
    let total = 0;
    let completed = 0;
    for (const habit of habits) {
      for (const dateStr of days) {
        if (dateStr > todayStr) continue;
        const day = habit.days[dateStr];
        if (!day) continue;
        total += day.target;
        completed += Math.min(day.completions, day.target);
      }
    }
    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [habits, days, todayStr]);

  return (
    <div className="space-y-4">
      {/* Week Navigator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            onClick={goToCurrentWeek}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
              isCurrentWeek
                ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400"
                : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/60"
            )}
          >
            {formatMonthRange(days)}
          </button>

          <button
            onClick={() => navigateWeek(1)}
            disabled={isCurrentWeek}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors",
              isCurrentWeek && "opacity-30 cursor-not-allowed"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Week completion percentage */}
        <div className="flex items-center gap-3">
          {!isCurrentWeek && (
            <button
              onClick={goToCurrentWeek}
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('calendar.today', 'Today')}
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
                style={{ width: `${weekCompletion}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-neutral-500 dark:text-neutral-400">
              {weekCompletion}%
            </span>
          </div>
        </div>
      </div>

      {/* Weekly Matrix */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : habits.length === 0 ? null : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="grid grid-cols-[1fr_repeat(7,minmax(0,1fr))] gap-1.5 mb-2">
              <div /> {/* Spacer for habit column */}
              {localizedDays.map(({ dateStr, shortDay, dayNum }) => {
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "flex flex-col items-center py-1.5 rounded-xl transition-colors",
                      isToday && "bg-primary-50 dark:bg-primary-500/10"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      isToday
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-neutral-400 dark:text-neutral-500"
                    )}>
                      {shortDay}
                    </span>
                    <span className={cn(
                      "text-sm font-bold mt-0.5",
                      isToday
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-neutral-700 dark:text-neutral-300"
                    )}>
                      {dayNum}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Habit rows */}
            <div className="space-y-1.5">
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  days={days}
                  todayStr={todayStr}
                  onCellClick={(dateStr) => handleCellClick(habit, dateStr)}
                  onEdit={() => onEdit(habit)}
                  onDelete={() => onDelete(habit)}
                  isPending={completeMutation.isPending || uncompleteMutation.isPending}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface HabitRowProps {
  habit: WeeklyHabit;
  days: string[];
  todayStr: string;
  onCellClick: (dateStr: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  isPending: boolean;
}

const HabitRow: React.FC<HabitRowProps> = ({
  habit,
  days,
  todayStr,
  onCellClick,
  onEdit,
  onDelete,
  isPending,
}) => {
  const [showActions, setShowActions] = useState(false);

  const weekDone = days.reduce((sum, d) => {
    const day = habit.days[d];
    if (!day || d > todayStr) return sum;
    return sum + (day.completions >= day.target ? 1 : 0);
  }, 0);

  const weekDays = days.filter(d => d <= todayStr).length;

  return (
    <div
      className={cn(
        "group grid grid-cols-[1fr_repeat(7,minmax(0,1fr))] gap-1.5 items-center p-2 rounded-2xl transition-all duration-200",
        "bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/40",
        "hover:border-neutral-300 dark:hover:border-neutral-600/60 hover:shadow-sm"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Habit info */}
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700/50 text-lg shrink-0">
          {habit.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
              {habit.name}
            </span>
            <StreakBadge streak={habit.current_streak} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 tabular-nums">
              {weekDone}/{weekDays}
            </span>
            {/* Action buttons - visible on hover */}
            <div className={cn(
              "flex items-center gap-0.5 transition-opacity duration-150",
              showActions ? "opacity-100" : "opacity-0"
            )}>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Day cells */}
      {days.map((dateStr) => {
        const dayData = habit.days[dateStr];
        const status = getCellStatus(dayData, dateStr, todayStr);
        const isToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;

        return (
          <button
            key={dateStr}
            onClick={() => !isFuture && onCellClick(dateStr)}
            disabled={isFuture || isPending}
            className={cn(
              "relative flex items-center justify-center mx-auto rounded-xl transition-all duration-200",
              "h-10 w-10 sm:h-11 sm:w-11",
              isFuture && "cursor-default opacity-30",
              !isFuture && "cursor-pointer active:scale-90",
              isToday && "ring-2 ring-primary-400/40 dark:ring-primary-500/30",
              // Status-based styles
              status === 'complete' && "bg-primary-500/15 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400",
              status === 'partial' && "bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
              status === 'skipped' && "bg-rose-500/10 dark:bg-rose-500/15 text-rose-500 dark:text-rose-400",
              status === 'mixed' && "bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
              status === 'empty' && "bg-neutral-50 dark:bg-neutral-700/30 text-neutral-300 dark:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700/50",
              status === 'future' && "bg-neutral-50/50 dark:bg-neutral-800/30 text-neutral-200 dark:text-neutral-700",
            )}
          >
            {status === 'complete' && (
              <Check size={16} strokeWidth={3} className="drop-shadow-sm" />
            )}
            {status === 'partial' && dayData && (
              <span className="text-xs font-bold tabular-nums">{dayData.completions}</span>
            )}
            {status === 'skipped' && (
              <X size={14} strokeWidth={3} />
            )}
            {status === 'mixed' && dayData && (
              <span className="text-xs font-bold tabular-nums">{dayData.completions}</span>
            )}
            {status === 'empty' && (
              <Minus size={12} strokeWidth={2} className="opacity-40" />
            )}
            {status === 'future' && (
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            )}

            {/* Multi-completion indicator */}
            {dayData && dayData.target > 1 && status !== 'empty' && status !== 'future' && (
              <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-px">
                {Array.from({ length: dayData.target }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 w-1 rounded-full",
                      i < dayData.completions
                        ? "bg-primary-500 dark:bg-primary-400"
                        : i < dayData.completions + dayData.skipped
                          ? "bg-rose-400"
                          : "bg-neutral-300 dark:bg-neutral-600"
                    )}
                  />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
