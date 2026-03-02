import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Star } from 'lucide-react';
import { PageLayout } from '../../../components/PageLayout';
import { PageHeader } from '../../../components/PageHeader';
import { LoadingState } from '../../../components/LoadingState';
import { RecipeCard } from './RecipeCard';
import { useRecipes, type Recipe } from '@hously/shared';
import { CreateRecipeModal } from './CreateRecipeModal';
import { EditRecipeModal } from './EditRecipeModal';

const CATEGORIES = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];

export function RecipeList() {
  const { t } = useTranslation('common');
  const { data, isLoading, refetch, isFetching } = useRecipes();

  const [searchQuery, setSearchQuery] = useState('');
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const closeEditModal = () => {
    setEditRecipe(null);
  };

  const recipes = data?.recipes || [];

  // Filter recipes
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || recipe.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || recipe.is_favorite === 1;

    return matchesSearch && matchesCategory && matchesFavorites;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <PageLayout>
      <PageHeader
        icon="🍽️"
        iconColor="text-orange-600"
        title={t('recipes.title', 'Recipes')}
        subtitle={t('recipes.subtitle', 'Store and manage your recipes')}
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder={t('recipes.searchPlaceholder', 'Search recipes...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-colors ${
            showFavoritesOnly
              ? 'bg-yellow-100 dark:bg-yellow-900 border-yellow-400 text-yellow-700 dark:text-yellow-300'
              : 'border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          <span>{t('recipes.favorites', 'Favorites')}</span>
        </button>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>{t('recipes.addRecipe', 'Add Recipe')}</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-orange-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          {t('recipes.all', 'All')}
        </button>
        {CATEGORIES.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              selectedCategory === category
                ? 'bg-orange-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {t(`recipes.category.${category}`, category)}
          </button>
        ))}
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-neutral-400">🍽️</span>
          </div>
          <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
            {searchQuery || selectedCategory || showFavoritesOnly
              ? t('recipes.noRecipesFiltered', 'No recipes found')
              : t('recipes.noRecipes', 'No recipes yet')}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
            {searchQuery || selectedCategory || showFavoritesOnly
              ? t('recipes.tryDifferentFilter', 'Try adjusting your filters or search')
              : t('recipes.startAdding', 'Start adding your favorite recipes')}
          </p>
        </div>
      )}
      <CreateRecipeModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      {editRecipe && <EditRecipeModal recipe={editRecipe} isOpen={true} onClose={closeEditModal} />}
    </PageLayout>
  );
}
