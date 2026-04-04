export interface RecipeIngredient {
  id?: number;
  recipe_id?: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  position: number;
}

export interface Recipe {
  id: number;
  name: string;
  description: string | null;
  instructions: string;
  category: string | null;
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  image_path: string | null;
  is_favorite: number;
  added_by: number;
  created_at: string;
  updated_at: string | null;
  added_by_username?: string | null;
  ingredient_count?: number;
  ingredients?: RecipeIngredient[];
}

export interface MealPlan {
  id: number;
  recipe_id: number;
  planned_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  notes: string | null;
  added_by: number;
  created_at: string;
  recipe_name?: string;
  recipe_image_path?: string | null;
  added_by_username?: string | null;
}

export interface RecipesResponse {
  recipes: Recipe[];
}

export interface RecipeDetailResponse {
  recipe: Recipe;
  ingredients?: RecipeIngredient[];
}

export interface CreateRecipeRequest {
  name: string;
  description?: string | null;
  instructions: string;
  category?: string | null;
  servings: number;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  image_path?: string | null;
  ingredients: Omit<RecipeIngredient, "id" | "recipe_id">[];
}

export interface UpdateRecipeRequest {
  name?: string;
  description?: string | null;
  instructions?: string;
  category?: string | null;
  servings?: number;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  image_path?: string | null;
  remove_image?: boolean;
  is_favorite?: boolean;
  ingredients?: Omit<RecipeIngredient, "id" | "recipe_id">[];
}

export interface MealPlansResponse {
  meal_plans: MealPlan[];
}

export interface CreateMealPlanRequest {
  recipe_id: number;
  planned_date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  notes?: string | null;
}
