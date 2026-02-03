import { fetchApi } from "../../lib/api";
import type {
  ApiResult,
  RecipesResponse,
  RecipeDetailResponse,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  MealPlansResponse,
  CreateMealPlanRequest,
  UpdateMealPlanRequest,
} from "../../types";

// Recipes API - now using Elysia endpoints at /api/recipes
const RECIPES_API = "/api/recipes";

export const recipesApi = {
  async getRecipes(): Promise<RecipesResponse> {
    return fetchApi<RecipesResponse>(RECIPES_API);
  },

  async getRecipe(recipeId: number): Promise<RecipeDetailResponse> {
    return fetchApi<RecipeDetailResponse>(`${RECIPES_API}/${recipeId}`);
  },

  async createRecipe(
    data: CreateRecipeRequest,
  ): Promise<ApiResult<{ id: number }>> {
    return fetchApi<ApiResult<{ id: number }>>(RECIPES_API, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateRecipe(
    recipeId: number,
    data: UpdateRecipeRequest,
  ): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${RECIPES_API}/${recipeId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  async deleteRecipe(
    recipeId: number,
  ): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${RECIPES_API}/${recipeId}`,
      {
        method: "DELETE",
      },
    );
  },

  async toggleFavorite(
    recipeId: number,
  ): Promise<ApiResult<{ is_favorite: number }>> {
    return fetchApi<ApiResult<{ is_favorite: number }>>(
      `${RECIPES_API}/${recipeId}/toggle-favorite`,
      {
        method: "POST",
      },
    );
  },

  async uploadImage(file: File): Promise<ApiResult<{ image_path: string }>> {
    const formData = new FormData();
    formData.append("image", file);

    const headers: HeadersInit = {};

    const response = await fetch(`${RECIPES_API}/upload-image`, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Failed to upload image" }));
      throw new Error(error.error || "Failed to upload image");
    }

    return response.json();
  },

  getImageUrl(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;
    return `${RECIPES_API}/image/${imagePath}`;
  },
};

// Meal Plans API - now using Elysia endpoints at /api/meal-plans
const MEAL_PLANS_API = "/api/meal-plans";

export const mealPlansApi = {
  async getMealPlans(
    start_date?: string,
    end_date?: string,
  ): Promise<MealPlansResponse> {
    const params = new URLSearchParams();
    if (start_date) params.append("start_date", start_date);
    if (end_date) params.append("end_date", end_date);

    const query = params.toString();
    const url = query ? `${MEAL_PLANS_API}?${query}` : MEAL_PLANS_API;

    return fetchApi<MealPlansResponse>(url);
  },

  async createMealPlan(
    data: CreateMealPlanRequest,
  ): Promise<ApiResult<{ id: number }>> {
    return fetchApi<ApiResult<{ id: number }>>(MEAL_PLANS_API, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateMealPlan(
    mealPlanId: number,
    data: UpdateMealPlanRequest,
  ): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${MEAL_PLANS_API}/${mealPlanId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  async deleteMealPlan(
    mealPlanId: number,
  ): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(
      `${MEAL_PLANS_API}/${mealPlanId}`,
      {
        method: "DELETE",
      },
    );
  },

  async addToShopping(
    mealPlanId: number,
  ): Promise<ApiResult<{ message: string; count: number }>> {
    return fetchApi<ApiResult<{ message: string; count: number }>>(
      `${MEAL_PLANS_API}/${mealPlanId}/add-to-shopping`,
      {
        method: "POST",
      },
    );
  },
};
