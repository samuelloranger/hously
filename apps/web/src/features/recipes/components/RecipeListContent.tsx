import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Star, X, UtensilsCrossed } from 'lucide-react';
import { LoadingState } from '../../../components/LoadingState';
import { RecipeCard } from './RecipeCard';
import { useRecipes, type Recipe } from '@hously/shared';
import { CreateRecipeModal } from './CreateRecipeModal';
import { EditRecipeModal } from './EditRecipeModal';
import { cn } from '@/lib/utils';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];

interface RecipeListContentProps {
  refreshKey?: number;
}

export function RecipeListContent({ refreshKey }: RecipeListContentProps) {
  const { t } = useTranslation('common');
  const { data, isLoading, refetch } = useRecipes();

  const [searchQuery, setSearchQuery] = useState('');
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (refreshKey) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const closeEditModal = () => {
    setEditRecipe(null);
  };

  const recipes = data?.recipes || [];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || recipe.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || recipe.is_favorite === 1;

    return matchesSearch && matchesCategory && matchesFavorites;
  });

  const hasActiveFilters = !!searchQuery || !!selectedCategory || showFavoritesOnly;

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <>
      {/* Search & Actions Bar */}
      <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-700/50 p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder={t('recipes.searchPlaceholder', 'Search recipes...')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:focus:border-orange-500 transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-neutral-400" />
              </button>
            )}
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn(
              'px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm font-medium transition-all duration-200 shrink-0',
              showFavoritesOnly
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/60'
            )}
          >
            <Star className={cn('w-4 h-4', showFavoritesOnly && 'fill-current')} />
            <span>{t('recipes.favorites', 'Favorites')}</span>
          </button>

          {/* Add recipe */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white rounded-xl flex items-center gap-2 text-sm font-medium transition-all duration-200 shadow-sm shadow-orange-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t('recipes.addRecipe', 'Add Recipe')}</span>
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              selectedCategory === null
                ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/20'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            )}
          >
            {t('recipes.all', 'All')}
          </button>
          {CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-200',
                selectedCategory === category
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              {t(`recipes.category.${category}`, category)}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredRecipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-700/50 py-16 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-7 h-7 text-neutral-300 dark:text-neutral-600" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1.5">
            {hasActiveFilters
              ? t('recipes.noRecipesFiltered', 'No recipes found')
              : t('recipes.noRecipes', 'No recipes yet')}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            {hasActiveFilters
              ? t('recipes.tryDifferentFilter', 'Try adjusting your filters or search')
              : t('recipes.startAdding', 'Start adding your favorite recipes')}
          </p>
          {!hasActiveFilters && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              + {t('recipes.addRecipe', 'Add Recipe')}
            </button>
          )}
        </div>
      )}

      <CreateRecipeModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {editRecipe && <EditRecipeModal recipe={editRecipe} isOpen={true} onClose={closeEditModal} />}
    </>
  );
}
