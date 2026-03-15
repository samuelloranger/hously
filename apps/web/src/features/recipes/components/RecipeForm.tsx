import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Upload, Loader2 } from 'lucide-react';
import {
  getRecipeImageUrl,
  useCreateRecipe,
  useUpdateRecipe,
  useUploadRecipeImage,
  COOKING_UNITS,
  type Recipe,
  type RecipeIngredient,
} from '@hously/shared';
interface RecipeFormProps {
  recipe?: Recipe;
  onSuccess?: (recipeId: number) => void;
  onCancel?: () => void;
}

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];

export function RecipeForm({ recipe, onSuccess, onCancel }: RecipeFormProps) {
  const { t } = useTranslation('common');
  const isEditing = !!recipe?.id;

  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const uploadImage = useUploadRecipeImage();

  // Form state
  const [name, setName] = useState(recipe?.name || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [instructions, setInstructions] = useState(recipe?.instructions || '');
  const [category, setCategory] = useState(recipe?.category || '');
  const [servings, setServings] = useState(recipe?.servings || 4);
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes || null);
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes || null);
  const [imagePath, setImagePath] = useState(recipe?.image_path || null);
  const [ingredients, setIngredients] = useState<Omit<RecipeIngredient, 'id'>[]>(
    recipe?.ingredients?.map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit || null,
      position: ing.position,
    })) || [{ name: '', quantity: null, unit: null, position: 0 }]
  );

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await uploadImage.mutateAsync(file);
      if (result.success && result.data) {
        setImagePath(result.data.image_path);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: null, unit: null, position: ingredients.length }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | number | null) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const data = {
      name,
      description: description || null,
      instructions,
      category: category || null,
      servings,
      prep_time_minutes: prepTime,
      cook_time_minutes: cookTime,
      image_path: imagePath,
      ingredients: ingredients
        .filter(ing => ing.name.trim())
        .map((ing, idx) => ({
          ...ing,
          position: idx,
        })),
    };

    try {
      if (isEditing) {
        if (!recipe?.id) return;
        await updateRecipe.mutateAsync({ recipeId: recipe.id, data });
        if (onSuccess) {
          onSuccess(recipe.id);
        } else {
          onCancel?.();
        }
      } else {
        const result = await createRecipe.mutateAsync(data);
        if (result.success && result.data?.id) {
          if (onSuccess) {
            onSuccess(result.data.id);
          } else {
            onCancel?.();
          }
        }
      }
    } catch (error) {
      console.error('Failed to save recipe:', error);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
  };

  const imageUrl = getRecipeImageUrl(imagePath);

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('recipes.recipeName', 'Recipe Name')} *
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('recipes.description', 'Description')}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* Category & Servings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('recipes.category.label', 'Category')}
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select...</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {t(`recipes.category.${cat}`, cat)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('recipes.servings', 'Servings')} *
          </label>
          <input
            type="number"
            value={servings}
            onChange={e => setServings(parseInt(e.target.value))}
            required
            min="1"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Prep & Cook Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('recipes.prepTime', 'Prep Time (minutes)')}
          </label>
          <input
            type="number"
            value={prepTime || ''}
            onChange={e => setPrepTime(e.target.value ? parseInt(e.target.value) : null)}
            min="0"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('recipes.cookTime', 'Cook Time (minutes)')}
          </label>
          <input
            type="number"
            value={cookTime || ''}
            onChange={e => setCookTime(e.target.value ? parseInt(e.target.value) : null)}
            min="0"
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('recipes.image', 'Recipe Image')}
        </label>
        {imageUrl ? (
          <div className="relative">
            <img src={imageUrl} alt="Recipe" className="w-full h-48 object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => setImagePath(null)}
              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg cursor-pointer hover:border-orange-500 transition-colors">
            <div className="text-center">
              {uploadingImage ? (
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-neutral-400" />
              ) : (
                <Upload className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
              )}
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {uploadingImage
                  ? t('common.uploading', 'Uploading...')
                  : t('recipes.uploadImage', 'Click to upload image')}
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploadingImage}
            />
          </label>
        )}
      </div>

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('recipes.ingredients', 'Ingredients')}
          </label>
          <button
            type="button"
            onClick={addIngredient}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('recipes.addIngredient', 'Add Ingredient')}
          </button>
        </div>

        <div className="space-y-2">
          {ingredients.map((ingredient, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/50 p-2 transition-colors hover:border-orange-300 dark:hover:border-orange-700/50"
            >
              <input
                type="text"
                placeholder={t('recipes.ingredientName', 'Name')}
                value={ingredient.name}
                onChange={e => updateIngredient(index, 'name', e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
              />
              <input
                type="number"
                placeholder={t('recipes.quantity', 'Qty')}
                value={ingredient.quantity || ''}
                onChange={e => updateIngredient(index, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-20 shrink-0 px-3 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow tabular-nums"
                step="0.1"
              />
              <select
                value={ingredient.unit || ''}
                onChange={e => updateIngredient(index, 'unit', e.target.value || null)}
                className="w-28 shrink-0 px-2 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
              >
                <option value="">{t('recipes.unitSelect', 'Unit...')}</option>
                {(['volume', 'weight', 'other'] as const).map(category => (
                  <optgroup key={category} label={t(`recipes.units.${category}`, category)}>
                    {COOKING_UNITS.filter(u => u.category === category).map(u => (
                      <option key={u.key} value={u.key}>
                        {t(`recipes.units.${u.key}`, u.key)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="p-2 shrink-0 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('recipes.instructions', 'Instructions')} *
          <span className="text-xs text-neutral-500 ml-2">(Markdown supported)</span>
        </label>
        <textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder={t(
            'recipes.instructionsPlaceholder',
            'Enter cooking instructions... (Markdown supported: **bold**, *italic*, - lists, etc.)'
          )}
          required
          rows={12}
          className="w-full px-4 py-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-mono text-sm resize-vertical"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-4">
        <button
          type="button"
          onClick={handleCancel}
          className="px-6 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={createRecipe.isPending || updateRecipe.isPending || !name || !instructions}
          className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createRecipe.isPending || updateRecipe.isPending
            ? t('common.saving', 'Saving...')
            : isEditing
              ? t('common.save', 'Save')
              : t('recipes.create', 'Create Recipe')}
        </button>
      </div>
    </form>
  );
}
