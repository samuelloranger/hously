import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Trash2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "../../../components/LoadingState";
import { getWeekDates, formatDateOnly, isToday } from "../../../lib/date-utils";
import { useMealPlans } from "../hooks/useMealPlans";
import { useRecipes } from "../hooks/useRecipes";
import { useDeleteMealPlan } from "../hooks/useDeleteMealPlan";
import { useAddToShopping } from "../hooks/useAddToShopping";
import { AddMealModal } from "./AddMealModal";
import { recipesApi } from "../api";
import type { MealPlan } from "@/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍿",
};

interface MealPlanViewProps {
  refreshKey?: number;
}

export function MealPlanView({ refreshKey }: MealPlanViewProps) {
  const { t, i18n } = useTranslation("common");
  const [weekOffset, setWeekOffset] = useState(0);
  const [addMealModalOpen, setAddMealModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(
    null
  );

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const startDate = formatDateOnly(weekDates[0]);
  const endDate = formatDateOnly(weekDates[6]);

  const { data: mealPlansData, isLoading: loadingMealPlans, refetch } = useMealPlans(startDate, endDate);
  const { data: recipesData, isLoading: loadingRecipes } = useRecipes();
  const deleteMealPlan = useDeleteMealPlan();
  const addToShopping = useAddToShopping();

  useEffect(() => {
    if (refreshKey) {
      refetch();
    }
  }, [refreshKey, refetch]);

  const mealPlans = mealPlansData?.meal_plans || [];
  const recipes = recipesData?.recipes || [];

  // Group meal plans by date and meal type
  const mealPlansByDateAndType = useMemo(() => {
    const grouped: Record<string, Record<MealType, MealPlan[]>> = {};

    weekDates.forEach((date) => {
      const dateStr = formatDateOnly(date);
      grouped[dateStr] = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      };
    });

    mealPlans.forEach((plan) => {
      if (grouped[plan.planned_date] && grouped[plan.planned_date][plan.meal_type as MealType]) {
        grouped[plan.planned_date][plan.meal_type as MealType].push(plan);
      }
    });

    return grouped;
  }, [mealPlans, weekDates]);

  const handleAddMeal = (date: string, mealType: MealType) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    setAddMealModalOpen(true);
  };

  const handleDeleteMeal = async (mealPlanId: number) => {
    try {
      await deleteMealPlan.mutateAsync(mealPlanId);
      toast.success(t("kitchen.mealPlan.mealRemoved", "Meal removed"));
    } catch {
      toast.error(t("kitchen.mealPlan.removeError", "Failed to remove meal"));
    }
  };

  const handleAddToShopping = async (mealPlanId: number) => {
    try {
      const result = await addToShopping.mutateAsync(mealPlanId);
      if ("data" in result && result.data) {
        toast.success(
          t("kitchen.mealPlan.addedToShopping", "Added {{count}} items to shopping list", {
            count: result.data.count,
          })
        );
      }
    } catch {
      toast.error(t("kitchen.mealPlan.addToShoppingError", "Failed to add ingredients"));
    }
  };

  const handleAddAllToShopping = async () => {
    const allMealPlans = mealPlans.filter((plan) => plan.id);
    if (allMealPlans.length === 0) {
      toast.info(t("kitchen.mealPlan.noMealsToAdd", "No meals planned for this week"));
      return;
    }

    let totalAdded = 0;
    for (const plan of allMealPlans) {
      try {
        const result = await addToShopping.mutateAsync(plan.id);
        if ("data" in result && result.data) {
          totalAdded += result.data.count;
        }
      } catch {
        // Continue with other meals
      }
    }

    if (totalAdded > 0) {
      toast.success(
        t("kitchen.mealPlan.addedAllToShopping", "Added {{count}} items to shopping list", {
          count: totalAdded,
        })
      );
    }
  };

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString(i18n.language, { weekday: "short" });
  };

  const formatDayNumber = (date: Date) => {
    return date.getDate();
  };

  const formatMonthYear = () => {
    const firstDate = weekDates[0];
    const lastDate = weekDates[6];

    if (firstDate.getMonth() === lastDate.getMonth()) {
      return firstDate.toLocaleDateString(i18n.language, {
        month: "long",
        year: "numeric",
      });
    }

    return `${firstDate.toLocaleDateString(i18n.language, { month: "short" })} - ${lastDate.toLocaleDateString(i18n.language, { month: "short", year: "numeric" })}`;
  };

  if (loadingMealPlans || loadingRecipes) {
    return <LoadingState />;
  }

  return (
    <>
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              weekOffset === 0
                ? "bg-orange-600 text-white"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            {t("kitchen.mealPlan.thisWeek", "This Week")}
          </button>
          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
          </button>
          <span className="ml-2 text-lg font-semibold text-neutral-900 dark:text-white">
            {formatMonthYear()}
          </span>
        </div>

        <button
          onClick={handleAddAllToShopping}
          disabled={mealPlans.length === 0 || addToShopping.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-400 text-white rounded-lg transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="hidden sm:inline">
            {t("kitchen.mealPlan.addWeekToShopping", "Add Week to Shopping")}
          </span>
        </button>
      </div>

      {/* Meal Plan Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {weekDates.map((date) => (
              <div
                key={formatDateOnly(date)}
                className={`text-center p-2 rounded-lg ${
                  isToday(date)
                    ? "bg-orange-100 dark:bg-orange-900/30"
                    : "bg-neutral-50 dark:bg-neutral-800"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
                    isToday(date)
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  {formatDayName(date)}
                </div>
                <div
                  className={`text-lg font-bold ${
                    isToday(date)
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-neutral-900 dark:text-white"
                  }`}
                >
                  {formatDayNumber(date)}
                </div>
              </div>
            ))}
          </div>

          {/* Meal Type Rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{MEAL_TYPE_ICONS[mealType]}</span>
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 capitalize">
                  {t(`kitchen.mealPlan.mealTypes.${mealType}`, mealType)}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDates.map((date) => {
                  const dateStr = formatDateOnly(date);
                  const meals = mealPlansByDateAndType[dateStr]?.[mealType] || [];

                  return (
                    <div
                      key={`${dateStr}-${mealType}`}
                      className="min-h-[80px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2"
                    >
                      {meals.length > 0 ? (
                        <div className="space-y-2">
                          {meals.map((meal) => (
                            <MealCard
                              key={meal.id}
                              meal={meal}
                              onDelete={() => handleDeleteMeal(meal.id)}
                              onAddToShopping={() => handleAddToShopping(meal.id)}
                            />
                          ))}
                          <button
                            onClick={() => handleAddMeal(dateStr, mealType)}
                            className="w-full flex items-center justify-center gap-1 py-1 text-xs text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddMeal(dateStr, mealType)}
                          className="w-full h-full flex flex-col items-center justify-center text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 rounded-md transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-xs mt-1">
                            {t("kitchen.mealPlan.addMeal", "Add")}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {mealPlans.length === 0 && (
        <div className="text-center py-8 mt-4">
          <div className="bg-neutral-100 dark:bg-neutral-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            {t("kitchen.mealPlan.noMeals", "No meals planned")}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
            {t(
              "kitchen.mealPlan.startPlanning",
              "Click on any slot to start planning your meals for the week"
            )}
          </p>
        </div>
      )}

      {/* Add Meal Modal */}
      <AddMealModal
        isOpen={addMealModalOpen}
        onClose={() => {
          setAddMealModalOpen(false);
          setSelectedDate(null);
          setSelectedMealType(null);
        }}
        date={selectedDate || ""}
        mealType={selectedMealType || "dinner"}
        recipes={recipes}
      />
    </>
  );
}

interface MealCardProps {
  meal: MealPlan;
  onDelete: () => void;
  onAddToShopping: () => void;
}

function MealCard({ meal, onDelete, onAddToShopping }: MealCardProps) {
  const imageUrl = recipesApi.getImageUrl(meal.recipe_image_path);

  return (
    <div className="group relative bg-neutral-50 dark:bg-neutral-700 rounded-md overflow-hidden">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={meal.recipe_name || ""}
          className="w-full h-12 object-cover"
        />
      )}
      <div className="p-1.5">
        <p className="text-xs font-medium text-neutral-900 dark:text-white truncate">
          {meal.recipe_name}
        </p>
      </div>

      {/* Actions overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
        <button
          onClick={onAddToShopping}
          className="p-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          title="Add to shopping"
        >
          <ShoppingCart className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          title="Remove"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
