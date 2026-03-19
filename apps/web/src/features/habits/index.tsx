import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { useHabits, useDeleteHabit, Habit } from '@hously/shared';
import { HouseLoader } from '@/components/HouseLoader';
import { EmptyState } from '@/components/EmptyState';
import { HabitCard } from './components/HabitCard';
import { CreateHabitModal } from './components/CreateHabitModal';
import { EditHabitModal } from './components/EditHabitModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatLocalDate, addDays } from '@/lib/date';
import { useSearch } from '@tanstack/react-router';
import { useModalSearchParams } from '@/hooks/useModalSearchParams';
import type { HabitsSearchParams } from '@/router';

export const HabitsList: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  
  const searchParams = useSearch({ from: '/habits' }) as HabitsSearchParams;
  const { setParams, resetParams } = useModalSearchParams('/habits', searchParams);
  const isCreateModalOpen = searchParams.modal === 'create';
  
  const todayStr = formatLocalDate(new Date());
  const [selectedDate, setSelectedDate] = React.useState(todayStr);
  const isToday = selectedDate === todayStr;

  const { data, isLoading, refetch, isRefetching } = useHabits(isToday ? undefined : selectedDate);
  const deleteMutation = useDeleteHabit();

  const lastSeenDateKeyRef = useRef(new Date().toDateString());

  const habits = data?.habits || [];
  const editingHabit = useMemo(
    () => habits.find(h => h.id === searchParams.habitId) || null,
    [habits, searchParams.habitId]
  );

  useEffect(() => {
    const refreshIfDateChanged = () => {
      const nextDateKey = new Date().toDateString();

      if (nextDateKey === lastSeenDateKeyRef.current) {
        return;
      }

      lastSeenDateKeyRef.current = nextDateKey;
      void refetch();
    };

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);

      return window.setTimeout(() => {
        refreshIfDateChanged();
        timeoutId = scheduleMidnightRefresh();
      }, nextMidnight.getTime() - now.getTime() + 1000);
    };

    let timeoutId = scheduleMidnightRefresh();

    window.addEventListener('focus', refreshIfDateChanged);
    document.addEventListener('visibilitychange', refreshIfDateChanged);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('focus', refreshIfDateChanged);
      document.removeEventListener('visibilitychange', refreshIfDateChanged);
    };
  }, [refetch]);

  const handleDelete = (habit: Habit) => {
    if (!confirm(t('habits.deleteConfirm'))) return;
    deleteMutation.mutate(habit.id, {
      onSuccess: () => {
        toast.success(t('habits.habitDeleted'));
      }
    });
  };

  const formattedDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(i18n.language, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate, i18n.language]);

  return (
    <PageLayout>
      <PageHeader
        title={t('habits.title')}
        subtitle={t('habits.subtitle')}
        icon="🎯"
        iconColor="text-orange-600"
        onRefresh={refetch}
        isRefreshing={isRefetching || isLoading}
        actions={
          <button
            onClick={() => setParams({ modal: 'create' })}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-md shadow-primary-600/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{t('habits.addHabit')}</span>
          </button>
        }
      />

      {/* Date navigator */}
      <div className="flex items-center justify-between mt-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(prev => addDays(prev, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <span className={cn(
            "text-sm font-semibold capitalize",
            isToday
              ? "text-primary-600 dark:text-primary-400"
              : "text-neutral-700 dark:text-neutral-300"
          )}>
            {isToday ? t('calendar.today', 'Today') : formattedDate}
          </span>

          <button
            onClick={() => setSelectedDate(prev => addDays(prev, 1))}
            disabled={isToday}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors",
              isToday && "opacity-30 cursor-not-allowed"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {!isToday && (
          <button
            onClick={() => setSelectedDate(todayStr)}
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t('calendar.today', 'Today')}
          </button>
        )}
      </div>

      <div>
        {isLoading && habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <HouseLoader />
          </div>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <EmptyState
              title={t('habits.noHabits')}
              description={t('habits.addFirstHabit')}
              icon="🎯"
            />
            <button
              onClick={() => setParams({ modal: 'create' })}
              className="flex items-center gap-2 px-6 h-12 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-lg shadow-primary-600/20 transition-all active:scale-95"
            >
              <Plus size={20} />
              {t('habits.addHabit')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {habits.map((habit: Habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                date={isToday ? undefined : selectedDate}
                onEdit={(h) => setParams({ modal: 'edit', habitId: h.id })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <CreateHabitModal
        isOpen={isCreateModalOpen}
        onClose={() => resetParams(['modal'])}
      />

      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          isOpen={searchParams.modal === 'edit'}
          onClose={() => resetParams(['modal', 'habitId'])}
        />
      )}
    </PageLayout>
  );
};
