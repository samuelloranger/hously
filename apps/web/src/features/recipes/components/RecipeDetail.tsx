import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Clock, Users, Pencil, Trash2, Star, ChefHat, ListChecks } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { PageLayout } from '@/components/PageLayout';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { getRecipeImageUrl, useDeleteRecipe, useRecipe, useToggleFavorite } from '@hously/shared';
import { EditRecipeModal } from './EditRecipeModal';
import { cn } from '@/lib/utils';
import { useModalSearchParams } from '@/hooks/useModalSearchParams';
import type { RecipeDetailSearchParams } from '@/router';

export function RecipeDetail() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { recipeId } = useParams({ strict: false }) as { recipeId: string };
  const id = parseInt(recipeId, 10);
  
  const searchParams = useSearch({ from: '/kitchen/$recipeId' }) as RecipeDetailSearchParams;
  const { setParams, resetParams } = useModalSearchParams('/kitchen/$recipeId', searchParams);

  const { data, isLoading } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const toggleFavorite = useToggleFavorite();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!data?.recipe) {
    return (
      <PageLayout>
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <ChefHat className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            {t('recipes.notFound', 'Recipe not found')}
          </h3>
          <button
            onClick={() => navigate({ to: '/kitchen' })}
            className="text-sm font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors"
          >
            {t('recipes.backToList', 'Back to recipes')}
          </button>
        </div>
      </PageLayout>
    );
  }

  const recipe = data.recipe;
  const imageUrl = getRecipeImageUrl(recipe.image_path);
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  const handleDelete = async () => {
    try {
      await deleteRecipe.mutateAsync(recipe.id);
      navigate({ to: '/kitchen' });
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    }
  };

  const handleToggleFavorite = () => {
    toggleFavorite.mutate(recipe.id);
  };

  return (
    <PageLayout>
      {/* Header Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: '/kitchen' })}
          className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('recipes.backToList', 'Back to recipes')}</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleFavorite}
            className="p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-all duration-200 active:scale-95"
          >
            <Star
              className={cn(
                'w-5 h-5 transition-colors',
                recipe.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400 hover:text-yellow-400'
              )}
            />
          </button>
          <button
            onClick={() => setParams({ modal: 'edit' })}
            className="p-2.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-all duration-200 active:scale-95"
          >
            <Pencil className="w-4.5 h-4.5 text-neutral-500 dark:text-neutral-400" />
          </button>
          <button
            onClick={() => setParams({ modal: 'delete' })}
            className="p-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-95"
          >
            <Trash2 className="w-4.5 h-4.5 text-red-500 dark:text-red-400" />
          </button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="rounded-2xl overflow-hidden mb-6">
        {imageUrl ? (
          <img src={imageUrl} alt={recipe.name} className="w-full h-64 md:h-96 object-cover" />
        ) : (
          <div className="w-full h-64 md:h-96 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex items-center justify-center">
            <span className="text-9xl drop-shadow-sm">🍽️</span>
          </div>
        )}
      </div>

      {/* Recipe Info Card */}
      <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 p-6 mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-3 tracking-tight">
          {recipe.name}
        </h1>

        {recipe.description && (
          <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed mb-4">{recipe.description}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3">
          {recipe.category && (
            <span className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
              {t(`recipes.category.${recipe.category}`, recipe.category)}
            </span>
          )}

          {totalTime > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              <Clock className="w-4 h-4" />
              <span>{totalTime} min</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            <Users className="w-4 h-4" />
            <span>
              {recipe.servings} {t('recipes.servings', 'servings')}
            </span>
          </div>
        </div>

        {/* Time breakdown */}
        {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
          <div className="flex gap-4 mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700/50 text-sm text-neutral-500 dark:text-neutral-400">
            {recipe.prep_time_minutes && (
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {t('recipes.prepTime', 'Prep')}:
                </span>{' '}
                {recipe.prep_time_minutes} min
              </div>
            )}
            {recipe.cook_time_minutes && (
              <div>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {t('recipes.cookTime', 'Cook')}:
                </span>{' '}
                {recipe.cook_time_minutes} min
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two-column layout for ingredients + instructions on desktop */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div className="lg:w-[340px] shrink-0">
            <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 p-6 lg:sticky lg:top-6">
              <div className="flex items-center gap-2 mb-4">
                <ListChecks className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  {t('recipes.ingredients', 'Ingredients')}
                </h2>
              </div>
              <ul className="space-y-2.5">
                {recipe.ingredients.map(ingredient => (
                  <li
                    key={ingredient.id}
                    className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <span>
                      {ingredient.quantity && ingredient.unit && (
                        <span className="font-semibold text-neutral-900 dark:text-white">
                          {ingredient.quantity} {t(`recipes.units.${ingredient.unit}`, ingredient.unit)}{' '}
                        </span>
                      )}
                      {ingredient.quantity && !ingredient.unit && (
                        <span className="font-semibold text-neutral-900 dark:text-white">{ingredient.quantity} </span>
                      )}
                      {ingredient.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-700/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <ChefHat className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                {t('recipes.instructions', 'Instructions')}
              </h2>
            </div>
            <div className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-a:text-orange-600 dark:prose-a:text-orange-400">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{recipe.instructions}</ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      <EditRecipeModal recipe={recipe} onClose={() => resetParams(['modal'])} isOpen={searchParams.modal === 'edit'} />

      {/* Delete Confirmation Modal */}
      {searchParams.modal === 'delete' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[var(--z-modal)] p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-neutral-200/60 dark:border-neutral-700/50">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
              {t('recipes.confirmDelete', 'Delete Recipe?')}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              {t(
                'recipes.confirmDeleteMessage',
                'Are you sure you want to delete this recipe? This action cannot be undone.'
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => resetParams(['modal'])} className="rounded-xl">
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteRecipe.isPending}
                className="rounded-xl"
              >
                {deleteRecipe.isPending ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
