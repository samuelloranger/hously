import { Star, Clock, Users } from "lucide-react";
import { Recipe } from "../../../types";
import { recipesApi } from "../api";
import { useNavigate } from "@tanstack/react-router";
import { useToggleFavorite } from "../hooks/useToggleFavorite";

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const navigate = useNavigate();
  const toggleFavorite = useToggleFavorite();

  const imageUrl = recipesApi.getImageUrl(recipe.image_path);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite.mutate(recipe.id);
  };

  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div
      onClick={() => navigate({ to: `/kitchen/${recipe.id}` })}
      className="bg-white dark:bg-neutral-800 rounded-xl shadow-md overflow-hidden border border-neutral-200 dark:border-neutral-700 hover:shadow-lg transition-shadow cursor-pointer"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={recipe.name}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
          <span className="text-6xl">🍽️</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white line-clamp-1">
            {recipe.name}
          </h3>
          <button onClick={handleToggleFavorite} className="ml-2 flex-shrink-0">
            <Star
              className={`w-5 h-5 ${
                recipe.is_favorite
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-neutral-400 hover:text-yellow-400"
              } transition-colors`}
            />
          </button>
        </div>

        {recipe.category && (
          <span className="inline-block bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded text-xs font-medium mb-2">
            {recipe.category}
          </span>
        )}

        <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400 mt-3">
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{totalTime} min</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{recipe.servings} servings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
