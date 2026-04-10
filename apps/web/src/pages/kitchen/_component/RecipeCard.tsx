import { Star, Clock, Users } from "lucide-react";
import { useToggleFavorite } from "@/hooks/recipes/useRecipes";
import type { Recipe } from "@hously/shared/types";
import { getRecipeImageUrl } from "@hously/shared/utils";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const toggleFavorite = useToggleFavorite();

  const imageUrl = getRecipeImageUrl(recipe.image_path);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite.mutate(recipe.id);
  };

  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div
      onClick={() => navigate({ to: `/kitchen/${recipe.id}` })}
      className="group bg-white dark:bg-neutral-800/80 rounded-2xl overflow-hidden border border-neutral-200/60 dark:border-neutral-700/50 hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-300 cursor-pointer"
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={recipe.name}
            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex items-center justify-center">
            <span className="text-6xl drop-shadow-sm">🍽️</span>
          </div>
        )}

        {/* Favorite button overlay */}
        <button
          onClick={handleToggleFavorite}
          className={cn(
            "absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition-all duration-200",
            recipe.is_favorite
              ? "bg-yellow-400/20 shadow-sm"
              : "bg-black/20 opacity-0 group-hover:opacity-100",
          )}
        >
          <Star
            className={cn(
              "w-4 h-4 transition-colors",
              recipe.is_favorite
                ? "fill-yellow-400 text-yellow-400"
                : "text-white hover:text-yellow-300",
            )}
          />
        </button>

        {/* Category badge */}
        {recipe.category && (
          <span className="absolute bottom-3 left-3 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide rounded-lg bg-black/40 backdrop-blur-sm text-white">
            {t(`recipes.category.${recipe.category}`, recipe.category)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1 mb-2">
          {recipe.name}
        </h3>

        <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{totalTime} min</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{recipe.servings}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
