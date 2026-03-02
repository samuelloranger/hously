import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { CreateHabitRequest } from '@hously/shared';
import { EmojiPicker } from './EmojiPicker';
import { ScheduleTimePicker } from './ScheduleTimePicker';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { FormInput, FormTextarea } from '../../../components/ui/form-field';
import { Button } from '../../../components/ui/button';

interface CreateHabitFormProps {
  onSubmit: (data: CreateHabitRequest) => void;
  isLoading?: boolean;
}

export const CreateHabitForm: React.FC<CreateHabitFormProps> = ({ onSubmit, isLoading }) => {
  const { t } = useTranslation('common');
  const [selectedEmoji, setSelectedEmoji] = useState('💧');
  const [times, setTimes] = useState<string[]>(['08:00']);

  const { register, handleSubmit, formState: { errors } } = useForm<Omit<CreateHabitRequest, 'emoji' | 'schedules'>>();

  const handleFormSubmit = (data: Omit<CreateHabitRequest, 'emoji' | 'schedules'>) => {
    onSubmit({
      ...data,
      emoji: selectedEmoji,
      schedules: times,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('habits.emoji')}
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-md bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-2xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
              >
                {selectedEmoji}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
              <EmojiPicker selectedEmoji={selectedEmoji} onSelect={setSelectedEmoji} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex-1">
          <FormInput
            {...register('name', { required: t('habits.nameRequired') })}
            label={t('habits.name')}
            required
            placeholder={t('habits.namePlaceholder')}
            error={errors.name?.message}
          />
        </div>
      </div>

      <FormTextarea
        {...register('description')}
        label={t('habits.description')}
        placeholder={t('habits.descriptionPlaceholder')}
        rows={2}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScheduleTimePicker times={times} onChange={setTimes} />

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
          <div className="font-semibold text-neutral-800 dark:text-white">{t('habits.timesPerDay')}</div>
          <div className="mt-1">{t('habits.timesPerDayDerived', { count: times.length })}</div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? t('common.creating') : t('habits.addHabit')}
        </Button>
      </div>
    </form>
  );
};
