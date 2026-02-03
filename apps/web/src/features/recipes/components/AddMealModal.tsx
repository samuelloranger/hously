import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { X, Search, Clock, Users, Star } from "lucide-react";
import { toast } from "sonner";
import { useCreateMealPlan } from "../hooks/useCreateMealPlan";
import { recipesApi } from "../api";
import type { Recipe } from "@/types";

interface AddMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  recipes: Recipe[];
}

export function AddMealModal({
  isOpen,
  onClose,
  date,
  mealType,
  recipes,
}: AddMealModalProps) {
  const { t, i18n } = useTranslation("common");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const createMealPlan = useCreateMealPlan();

  const categories = ["breakfast", "lunch", "dinner", "dessert", "snack"];

  // Filter recipes based on search and category
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Sort by favorites first
  const sortedRecipes = [...filteredRecipes].sort(
    (a, b) => b.is_favorite - a.is_favorite
  );

  const handleSelectRecipe = async (recipe: Recipe) => {
    try {
      await createMealPlan.mutateAsync({
        recipe_id: recipe.id,
        planned_date: date,
        meal_type: mealType,
      });
      toast.success(
        t("kitchen.mealPlan.mealAdded", "{{recipe}} added to {{mealType}}", {
          recipe: recipe.name,
          mealType: t(`kitchen.mealPlan.mealTypes.${mealType}`, mealType),
        })
      );
      handleClose();
    } catch {
      toast.error(t("kitchen.mealPlan.addError", "Failed to add meal"));
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSelectedCategory(null);
    onClose();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString(i18n.language, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[var(--z-modal)]" onClose={handleClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <div>
                    <DialogTitle className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {t("kitchen.mealPlan.selectRecipe", "Select a Recipe")}
                    </DialogTitle>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {formatDate(date)} -{" "}
                      {t(`kitchen.mealPlan.mealTypes.${mealType}`, mealType)}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-neutral-500" />
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder={t(
                        "recipes.searchPlaceholder",
                        "Search recipes..."
                      )}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === null
                          ? "bg-orange-600 text-white"
                          : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                      }`}
                    >
                      {t("recipes.all", "All")}
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                          selectedCategory === category
                            ? "bg-orange-600 text-white"
                            : "bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
                        }`}
                      >
                        {t(`recipes.category.${category}`, category)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipe List */}
                <div className="max-h-[400px] overflow-y-auto p-4">
                  {sortedRecipes.length > 0 ? (
                    <div className="space-y-2">
                      {sortedRecipes.map((recipe) => (
                        <RecipeOption
                          key={recipe.id}
                          recipe={recipe}
                          onSelect={() => handleSelectRecipe(recipe)}
                          isLoading={createMealPlan.isPending}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="bg-neutral-100 dark:bg-neutral-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">🍽️</span>
                      </div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
                        {t("recipes.noRecipesFiltered", "No recipes found")}
                      </h3>
                      <p className="text-neutral-600 dark:text-neutral-400">
                        {t(
                          "recipes.tryDifferentFilter",
                          "Try adjusting your filters or search"
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

interface RecipeOptionProps {
  recipe: Recipe;
  onSelect: () => void;
  isLoading: boolean;
}

function RecipeOption({ recipe, onSelect, isLoading }: RecipeOptionProps) {
  const { t } = useTranslation("common");
  const imageUrl = recipesApi.getImageUrl(recipe.image_path);
  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <button
      onClick={onSelect}
      disabled={isLoading}
      className="w-full flex items-center gap-4 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Image */}
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            🍽️
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-neutral-900 dark:text-white truncate">
            {recipe.name}
          </h4>
          {recipe.is_favorite === 1 && (
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {recipe.category && (
            <span className="capitalize">
              {t(`recipes.category.${recipe.category}`, recipe.category)}
            </span>
          )}
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {totalTime} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {recipe.servings}
          </span>
        </div>
      </div>
    </button>
  );
}
