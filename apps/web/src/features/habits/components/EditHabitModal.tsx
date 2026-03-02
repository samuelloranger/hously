import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../../components/dialog';
import { EditHabitForm } from './EditHabitForm';
import { useUpdateHabit, Habit } from '@hously/shared';
import { toast } from 'sonner';

interface EditHabitModalProps {
  habit: Habit;
  isOpen: boolean;
  onClose: () => void;
}

export const EditHabitModal: React.FC<EditHabitModalProps> = ({ habit, isOpen, onClose }) => {
  const { t } = useTranslation('common');
  const updateHabit = useUpdateHabit();

  const handleSubmit = (data: any) => {
    updateHabit.mutate({ id: habit.id, data }, {
      onSuccess: () => {
        toast.success(t('habits.habitUpdated'));
        onClose();
      },
      onError: () => {
        toast.error('Failed to update habit');
      }
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('habits.editHabit')}
      showCloseButton
    >
      <div className="p-1">
        <EditHabitForm habit={habit} onSubmit={handleSubmit} isLoading={updateHabit.isPending} />
      </div>
    </Dialog>
  );
};
