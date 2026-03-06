import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, LayoutGrid, CalendarDays } from 'lucide-react';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { useHabits, useDeleteHabit, Habit, WeeklyHabit } from '@hously/shared';
import { HouseLoader } from '../../components/HouseLoader';
import { EmptyState } from '../../components/EmptyState';
import { HabitCard } from './components/HabitCard';
import { WeeklyView } from './components/WeeklyView';
import { CreateHabitModal } from './components/CreateHabitModal';
import { EditHabitModal } from './components/EditHabitModal';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

type ViewMode = 'weekly' | 'cards';

export const HabitsList: React.FC = () => {
  const { t } = useTranslation('common');
  const { data, isLoading, refetch, isRefetching } = useHabits();
  const deleteMutation = useDeleteHabit();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const lastSeenDateKeyRef = useRef(new Date().toDateString());

  const habits = data?.habits || [];

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

  const handleDelete = (habit: Habit | WeeklyHabit) => {
    if (!confirm(t('habits.deleteConfirm'))) return;
    deleteMutation.mutate(habit.id, {
      onSuccess: () => {
        toast.success(t('habits.habitDeleted'));
      }
    });
  };

  const handleEditFromWeekly = (weeklyHabit: WeeklyHabit) => {
    const fullHabit = habits.find(h => h.id === weeklyHabit.id);
    if (fullHabit) {
      setEditingHabit(fullHabit);
    }
  };

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
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-xl bg-neutral-100 dark:bg-neutral-800 p-0.5">
              <button
                onClick={() => setViewMode('weekly')}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                  viewMode === 'weekly'
                    ? "bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
                title={t('habits.weeklyView', 'Weekly view')}
              >
                <CalendarDays size={16} />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                  viewMode === 'cards'
                    ? "bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300"
                )}
                title={t('habits.cardView', 'Card view')}
              >
                <LayoutGrid size={16} />
              </button>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-md shadow-primary-600/20 transition-all active:scale-95"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">{t('habits.addHabit')}</span>
            </button>
          </div>
        }
      />

      <div className="mt-8">
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
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-6 h-12 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-lg shadow-primary-600/20 transition-all active:scale-95"
            >
              <Plus size={20} />
              {t('habits.addHabit')}
            </button>
          </div>
        ) : viewMode === 'weekly' ? (
          <WeeklyView
            onEdit={handleEditFromWeekly}
            onDelete={handleDelete}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {habits.map((habit: Habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onEdit={setEditingHabit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <CreateHabitModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          isOpen={!!editingHabit}
          onClose={() => setEditingHabit(null)}
        />
      )}
    </PageLayout>
  );
};
