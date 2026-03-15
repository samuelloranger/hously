import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  X,
  Upload,
  Loader2,
  BookOpen,
  Clock,
  Camera,
  UtensilsCrossed,
  ListOrdered,
  ImageOff,
} from 'lucide-react';
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

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30">
        <Icon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 tracking-wide uppercase">
        {label}
      </h3>
      <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700 ml-2" />
    </div>
  );
}

const inputClasses =
  'w-full px-3.5 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 dark:focus:border-orange-500 transition-all placeholder:text-neutral-400';

const labelClasses = 'block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1.5';

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
    <form onSubmit={handleSubmit} className="relative">
      {/* Scrollable content area */}
      <div className="space-y-8 pb-20">
        {/* ── Details Section ── */}
        <section>
          <SectionHeader icon={BookOpen} label={t('recipes.sectionDetails', 'Details')} />
          <div className="space-y-4">
            <div>
              <label className={labelClasses}>
                {t('recipes.recipeName', 'Recipe Name')} <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder={t('recipes.recipeNamePlaceholder', 'e.g. Grandma\'s Apple Pie')}
                className={inputClasses}
              />
            </div>

            <div>
              <label className={labelClasses}>
                {t('recipes.description', 'Description')}
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder={t('recipes.descriptionPlaceholder', 'A short description of the dish...')}
                className={`${inputClasses} resize-none`}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClasses}>
                  {t('recipes.category.label', 'Category')}
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">{t('recipes.categorySelect', 'Select...')}</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {t(`recipes.category.${cat}`, cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>
                  {t('recipes.servings', 'Servings')} <span className="text-orange-500">*</span>
                </label>
                <input
                  type="number"
                  value={servings}
                  onChange={e => setServings(parseInt(e.target.value))}
                  required
                  min="1"
                  className={`${inputClasses} tabular-nums`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Timing Section ── */}
        <section>
          <SectionHeader icon={Clock} label={t('recipes.sectionTiming', 'Timing')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>
                {t('recipes.prepTime', 'Prep Time (minutes)')}
              </label>
              <input
                type="number"
                value={prepTime || ''}
                onChange={e => setPrepTime(e.target.value ? parseInt(e.target.value) : null)}
                min="0"
                placeholder="0"
                className={`${inputClasses} tabular-nums`}
              />
            </div>

            <div>
              <label className={labelClasses}>
                {t('recipes.cookTime', 'Cook Time (minutes)')}
              </label>
              <input
                type="number"
                value={cookTime || ''}
                onChange={e => setCookTime(e.target.value ? parseInt(e.target.value) : null)}
                min="0"
                placeholder="0"
                className={`${inputClasses} tabular-nums`}
              />
            </div>
          </div>
        </section>

        {/* ── Photo Section ── */}
        <section>
          <SectionHeader icon={Camera} label={t('recipes.sectionPhoto', 'Photo')} />
          {imageUrl ? (
            <div className="relative group rounded-xl overflow-hidden">
              <img
                src={imageUrl}
                alt="Recipe"
                className="w-full h-44 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                type="button"
                onClick={() => setImagePath(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/50 backdrop-blur-sm text-white rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="group flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all">
              {uploadingImage ? (
                <Loader2 className="w-8 h-8 mb-2 animate-spin text-orange-400" />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-700/50 flex items-center justify-center mb-2 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30 transition-colors">
                    <Upload className="w-5 h-5 text-neutral-400 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {t('recipes.uploadImage', 'Click to upload image')}
                  </span>
                  <span className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    JPG, PNG, WebP
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploadingImage}
              />
            </label>
          )}
        </section>

        {/* ── Ingredients Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <UtensilsCrossed className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 tracking-wide uppercase">
                {t('recipes.ingredients', 'Ingredients')}
              </h3>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700 ml-2" />
            </div>
            <button
              type="button"
              onClick={addIngredient}
              className="ml-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('recipes.addIngredient', 'Add')}
            </button>
          </div>

          <div className="space-y-2">
            {ingredients.map((ingredient, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/50 p-2.5 transition-all hover:border-orange-300 dark:hover:border-orange-700/50 hover:shadow-sm"
              >
                <span className="w-6 text-center text-xs font-medium text-neutral-400 dark:text-neutral-500 shrink-0 tabular-nums">
                  {index + 1}
                </span>
                <input
                  type="text"
                  placeholder={t('recipes.ingredientName', 'Name')}
                  value={ingredient.name}
                  onChange={e => updateIngredient(index, 'name', e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all"
                />
                <input
                  type="number"
                  placeholder={t('recipes.quantity', 'Qty')}
                  value={ingredient.quantity || ''}
                  onChange={e => updateIngredient(index, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-20 shrink-0 px-3 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all tabular-nums"
                  step="0.1"
                />
                <select
                  value={ingredient.unit || ''}
                  onChange={e => updateIngredient(index, 'unit', e.target.value || null)}
                  className="w-28 shrink-0 px-2 py-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all"
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

            {ingredients.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-neutral-400 dark:text-neutral-500">
                <ImageOff className="w-6 h-6 mb-2" />
                <p className="text-sm">{t('recipes.noIngredients', 'No ingredients yet')}</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Instructions Section ── */}
        <section>
          <SectionHeader icon={ListOrdered} label={t('recipes.sectionInstructions', 'Instructions')} />
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                {t('recipes.instructions', 'Instructions')} <span className="text-orange-500">*</span>
              </label>
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                Markdown
              </span>
            </div>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder={t(
                'recipes.instructionsPlaceholder',
                'Enter cooking instructions... (Markdown supported: **bold**, *italic*, - lists, etc.)'
              )}
              required
              rows={10}
              className={`${inputClasses} font-mono resize-vertical !py-3`}
            />
          </div>
        </section>
      </div>

      {/* ── Frosted Footer Actions ── */}
      <div className="absolute -bottom-6 -left-6 -right-6 px-6 py-4 bg-neutral-50/80 dark:bg-neutral-800/80 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-700 rounded-b-2xl flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="px-5 py-2.5 text-sm font-medium border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={createRecipe.isPending || updateRecipe.isPending || !name || !instructions}
          className="px-6 py-2.5 text-sm font-medium bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl shadow-sm shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
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
