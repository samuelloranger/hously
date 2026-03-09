import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/dialog';
import { RecipeForm } from './RecipeForm';
import type { Recipe } from '@hously/shared';

interface EditRecipeModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

export function EditRecipeModal({ recipe, isOpen, onClose }: EditRecipeModalProps) {
  const { t } = useTranslation('common');

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('recipes.editRecipe', 'Edit recipe')} showCloseButton>
      <RecipeForm recipe={recipe} onCancel={onClose} onSuccess={onClose} />
    </Dialog>
  );
}
