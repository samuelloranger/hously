import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCreateShoppingItem } from '@/hooks/useShopping';
import { FormInput, FormTextarea } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';

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
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden mb-6">
      <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('shopping.addNewItem')}</h3>
      </div>
      <div className="p-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-grow">
              <FormInput
                {...register('item_name', { required: true })}
                placeholder={t('shopping.placeholder')}
                error={errors.item_name ? t('shopping.itemNameRequired') || 'Item name is required' : undefined}
              />
            </div>
            <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
              {t('shopping.addItem')}
            </Button>
          </div>
          <FormTextarea {...register('notes')} rows={2} placeholder={t('shopping.notesPlaceholder')} />
        </form>
      </div>
    </div>
  );
}
