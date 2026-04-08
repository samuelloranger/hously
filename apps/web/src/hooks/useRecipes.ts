import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import {
  MEAL_PLAN_ENDPOINTS,
  RECIPES_ENDPOINTS,
} from "@hously/shared/endpoints";
import type {
  Recipe,
  RecipeIngredient,
  RecipesResponse,
  RecipeDetailResponse,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  MealPlansResponse,
  CreateMealPlanRequest,
  ApiResult,
} from "@hously/shared/types";
export function useRecipes() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.recipes.list(),
    queryFn: async () => {
      const response = await fetcher<RecipesResponse>(RECIPES_ENDPOINTS.LIST);
      return { recipes: response.recipes };
    },
  });
}

export function useRecipe(id: number) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.recipes.detail(id),
    queryFn: async (): Promise<{
      recipe: Recipe;
      ingredients: RecipeIngredient[];
    }> => {
      const response = await fetcher<RecipeDetailResponse>(
        RECIPES_ENDPOINTS.DETAIL(id),
      );
      return {
        recipe: response.recipe,
        ingredients: response.ingredients ?? [],
      };
    },
    enabled: id > 0,
  });
}

export function useCreateRecipe() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeRequest) =>
      fetcher<ApiResult<{ id: number }>>(RECIPES_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() });
    },
  });
}

export function useUpdateRecipe() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      recipeId,
      data,
    }: {
      recipeId: number;
      data: UpdateRecipeRequest;
    }) =>
      fetcher<ApiResult<{ message: string }>>(
        RECIPES_ENDPOINTS.UPDATE(recipeId),
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.recipes.detail(variables.recipeId),
      });
    },
  });
}

export function useDeleteRecipe() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: number) =>
      fetcher<ApiResult<{ message: string }>>(
        RECIPES_ENDPOINTS.DELETE(recipeId),
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() });
    },
  });
}

export function useToggleFavorite() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: number) =>
      fetcher<ApiResult<{ is_favorite: number }>>(
        RECIPES_ENDPOINTS.TOGGLE_FAVORITE(recipeId),
        {
          method: "POST",
        },
      ),
    onSuccess: (_data, recipeId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.list() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.recipes.detail(recipeId),
      });
    },
  });
}

export function useUploadRecipeImage() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (fileOrFormData: File | FormData) => {
      const formData =
        fileOrFormData instanceof FormData
          ? fileOrFormData
          : (() => {
              const next = new FormData();
              next.append("image", fileOrFormData);
              return next;
            })();

      return fetcher<ApiResult<{ image_path: string }>>(
        RECIPES_ENDPOINTS.UPLOAD_IMAGE,
        {
          method: "POST",
          body: formData,
        },
      );
    },
  });
}

export function useMealPlans(start_date?: string, end_date?: string) {
  const fetcher = useFetcher();

  const params = new URLSearchParams();
  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);
  const queryString = params.toString();

  return useQuery({
    queryKey: queryKeys.mealPlans.list(start_date, end_date),
    queryFn: async () => {
      const response = await fetcher<MealPlansResponse>(
        `${MEAL_PLAN_ENDPOINTS.LIST}${queryString ? `?${queryString}` : ""}`,
      );
      return { meal_plans: response.meal_plans };
    },
  });
}

export function useCreateMealPlan() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMealPlanRequest) =>
      fetcher<ApiResult<{ id: number }>>(MEAL_PLAN_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.lists() });
    },
  });
}

export function useDeleteMealPlan() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealPlanId: number) =>
      fetcher<ApiResult<{ message: string }>>(
        MEAL_PLAN_ENDPOINTS.DELETE(mealPlanId),
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.lists() });
    },
  });
}

export function useAddToShopping() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealPlanId: number) =>
      fetcher<ApiResult<{ message: string; count: number }>>(
        MEAL_PLAN_ENDPOINTS.ADD_TO_SHOPPING(mealPlanId),
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
    },
  });
}
