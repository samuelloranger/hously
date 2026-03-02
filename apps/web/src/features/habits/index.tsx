import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { useHabits, useDeleteHabit, Habit } from '@hously/shared';
import { HouseLoader } from '../../components/HouseLoader';
import { EmptyState } from '../../components/EmptyState';
import { HabitCard } from './components/HabitCard';
import { CreateHabitModal } from './components/CreateHabitModal';
import { EditHabitModal } from './components/EditHabitModal';
import { toast } from 'sonner';

export const HabitsList: React.FC = () => {
  const { t } = useTranslation('common');
  const { data, isLoading, refetch, isRefetching } = useHabits();
  const deleteMutation = useDeleteHabit();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const habits = data?.habits || [];

  const handleDelete = (habit: Habit) => {
    if (!confirm(t('habits.deleteConfirm'))) return;
    deleteMutation.mutate(habit.id, {
      onSuccess: () => {
        toast.success(t('habits.habitDeleted'));
      }
    });
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
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-md shadow-primary-600/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{t('habits.addHabit')}</span>
          </button>
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
