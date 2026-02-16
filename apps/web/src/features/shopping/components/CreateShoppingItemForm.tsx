import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCreateShoppingItem } from '@hously/shared';
import { FormInput, FormTextarea } from '../../../components/ui/form-field';
import { Button } from '../../../components/ui/button';

interface FormData {
  item_name: string;
  notes: string;
}

export function CreateShoppingItemForm() {
  const { t } = useTranslation('common');
  const createMutation = useCreateShoppingItem();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      item_name: '',
      notes: '',
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        item_name: data.item_name.trim(),
        notes: data.notes.trim() || null,
      },
      {
        onSuccess: () => {
          reset();
        },
      }
    );
  };

  return (
    <div className="bg-white dark:bg-neutral-800 shadow rounded-lg mb-8">
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white">{t('shopping.addNewItem')}</h3>
      </div>
      <div className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-grow">
              <FormInput
                {...register('item_name', { required: true })}
                placeholder={t('shopping.placeholder')}
                error={errors.item_name ? t('shopping.itemNameRequired') || 'Item name is required' : undefined}
              />
            </div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
              <span className="mr-2">➕</span>
              {t('shopping.addItem')}
            </Button>
          </div>
          <FormTextarea {...register('notes')} rows={2} placeholder={t('shopping.notesPlaceholder')} />
        </form>
      </div>
    </div>
  );
}
