import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Clock, Users, Edit, Trash2, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { PageLayout } from '../../../components/PageLayout';
import { LoadingState } from '../../../components/LoadingState';
import { getRecipeImageUrl, useDeleteRecipe, useRecipe, useToggleFavorite } from '@hously/shared';
import { useState } from 'react';
import { EditRecipeModal } from './EditRecipeModal';

export function RecipeDetail() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { recipeId } = useParams({ strict: false }) as { recipeId: string };
  const id = parseInt(recipeId, 10);

  const [showEditModal, setShowEditModal] = useState(false);

  const { data, isLoading } = useRecipe(id);
  const deleteRecipe = useDeleteRecipe();
  const toggleFavorite = useToggleFavorite();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!data?.recipe) {
    return (
      <PageLayout>
        <div className="text-center py-16">
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            {t('recipes.notFound', 'Recipe not found')}
          </h3>
          <button onClick={() => navigate({ to: '/kitchen' })} className="text-orange-600 hover:text-orange-700">
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
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: '/kitchen' })}
          className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{t('recipes.backToList', 'Back to recipes')}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <Star
              className={`w-6 h-6 ${recipe.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-400'}`}
            />
          </button>

          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <Edit className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-red-600" />
          </button>
        </div>
      </div>

      {/* Hero Image */}
      {imageUrl ? (
        <img src={imageUrl} alt={recipe.name} className="w-full h-64 md:h-96 object-cover rounded-xl mb-6" />
      ) : (
        <div className="w-full h-64 md:h-96 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center mb-6">
          <span className="text-9xl">🍽️</span>
        </div>
      )}

      {/* Recipe Info */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-4">{recipe.name}</h1>

        {recipe.description && <p className="text-neutral-600 dark:text-neutral-400 mb-4">{recipe.description}</p>}

        <div className="flex flex-wrap items-center gap-4 mb-4">
          {recipe.category && (
            <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-lg text-sm font-medium">
              {t(`recipes.category.${recipe.category}`, recipe.category)}
            </span>
          )}

          {totalTime > 0 && (
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <Clock className="w-5 h-5" />
              <span>{totalTime} min</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
            <Users className="w-5 h-5" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>

        {(recipe.prep_time_minutes || recipe.cook_time_minutes) && (
          <div className="flex gap-6 text-sm text-neutral-600 dark:text-neutral-400">
            {recipe.prep_time_minutes && (
              <div>
                <span className="font-medium">Prep:</span> {recipe.prep_time_minutes} min
              </div>
            )}
            {recipe.cook_time_minutes && (
              <div>
                <span className="font-medium">Cook:</span> {recipe.cook_time_minutes} min
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
            {t('recipes.ingredients', 'Ingredients')}
          </h2>
          <ul className="space-y-2">
            {recipe.ingredients.map(ingredient => (
              <li key={ingredient.id} className="flex items-start gap-2 text-neutral-700 dark:text-neutral-300">
                <span className="text-orange-600 mt-1">•</span>
                <span>
                  {ingredient.quantity && ingredient.unit && (
                    <span className="font-medium">
                      {ingredient.quantity} {ingredient.unit}{' '}
                    </span>
                  )}
                  {ingredient.quantity && !ingredient.unit && (
                    <span className="font-medium">{ingredient.quantity} </span>
                  )}
                  {ingredient.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-neutral-200 dark:border-neutral-700 p-6 mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('recipes.instructions', 'Instructions')}
        </h2>
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{recipe.instructions}</ReactMarkdown>
        </div>
      </div>

      <EditRecipeModal recipe={recipe} onClose={() => setShowEditModal(false)} isOpen={showEditModal} />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-4">
              {t('recipes.confirmDelete', 'Delete Recipe?')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {t(
                'recipes.confirmDeleteMessage',
                'Are you sure you want to delete this recipe? This action cannot be undone.'
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteRecipe.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {deleteRecipe.isPending ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
