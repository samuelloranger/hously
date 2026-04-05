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
import { useCreateMealPlan } from "@/hooks/useRecipes";
import type { Recipe } from "@hously/shared/types";
import { getRecipeImageUrl } from "@hously/shared/utils";
import { cn } from "@/lib/utils";

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

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedRecipes = [...filteredRecipes].sort(
    (a, b) => b.is_favorite - a.is_favorite,
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
        }),
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
      <Dialog
        as="div"
        className="relative z-[var(--z-modal)]"
        onClose={handleClose}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
              <DialogPanel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 shadow-2xl border border-neutral-200/60 dark:border-neutral-700/50 transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
                  <div>
                    <DialogTitle className="text-base font-semibold text-neutral-900 dark:text-white">
                      {t("kitchen.mealPlan.selectRecipe", "Select a Recipe")}
                    </DialogTitle>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {formatDate(date)} &middot;{" "}
                      {t(`kitchen.mealPlan.mealTypes.${mealType}`, mealType)}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
                  >
                    <X className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="px-5 py-3 border-b border-neutral-100 dark:border-neutral-700/50">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder={t(
                        "recipes.searchPlaceholder",
                        "Search recipes...",
                      )}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 text-neutral-900 dark:text-white text-sm placeholder:text-neutral-400 focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 dark:focus:border-orange-500 transition-all outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                        selectedCategory === null
                          ? "bg-orange-600 text-white shadow-sm shadow-orange-600/20"
                          : "bg-neutral-100 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600",
                      )}
                    >
                      {t("recipes.all", "All")}
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-200",
                          selectedCategory === category
                            ? "bg-orange-600 text-white shadow-sm shadow-orange-600/20"
                            : "bg-neutral-100 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600",
                        )}
                      >
                        {t(`recipes.category.${category}`, category)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipe List */}
                <div className="max-h-[400px] overflow-y-auto p-3 no-scrollbar">
                  {sortedRecipes.length > 0 ? (
                    <div className="space-y-1.5">
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
                    <div className="text-center py-10">
                      <span className="text-3xl block mb-3">🍽️</span>
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">
                        {t("recipes.noRecipesFiltered", "No recipes found")}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {t(
                          "recipes.tryDifferentFilter",
                          "Try adjusting your filters or search",
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
  const imageUrl = getRecipeImageUrl(recipe.image_path);
  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <button
      onClick={onSelect}
      disabled={isLoading}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Image */}
      <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xl bg-gradient-to-br from-orange-400/20 to-red-500/20">
            🍽️
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-neutral-900 dark:text-white truncate">
            {recipe.name}
          </h4>
          {recipe.is_favorite === 1 && (
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
          {recipe.category && (
            <span className="capitalize">
              {t(`recipes.category.${recipe.category}`, recipe.category)}
            </span>
          )}
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {totalTime} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {recipe.servings}
          </span>
        </div>
      </div>
    </button>
  );
}
