import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Plus, ShoppingCart, Trash2, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import { LoadingState } from '@/components/LoadingState';
import { useAddToShopping, useDeleteMealPlan, useMealPlans, useRecipes } from '@/hooks/useRecipes';
import { formatDateOnly, getRecipeImageUrl, getWeekDates, isToday, type MealPlan } from '@hously/shared';
import { AddMealModal } from '@/pages/kitchen/_component/AddMealModal';
import { cn } from '@/lib/utils';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = (typeof MEAL_TYPES)[number];

const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
};

interface MealPlanViewProps {
  refreshKey?: number;
}

export function MealPlanView({ refreshKey }: MealPlanViewProps) {
  const { t, i18n } = useTranslation('common');
  const [weekOffset, setWeekOffset] = useState(0);
  const [addMealModalOpen, setAddMealModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

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

  const mealPlansByDateAndType = useMemo(() => {
    const grouped: Record<string, Record<MealType, MealPlan[]>> = {};

    weekDates.forEach(date => {
      const dateStr = formatDateOnly(date);
      grouped[dateStr] = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      };
    });

    mealPlans.forEach(plan => {
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
      toast.success(t('kitchen.mealPlan.mealRemoved', 'Meal removed'));
    } catch {
      toast.error(t('kitchen.mealPlan.removeError', 'Failed to remove meal'));
    }
  };

  const handleAddToShopping = async (mealPlanId: number) => {
    try {
      const result = await addToShopping.mutateAsync(mealPlanId);
      if ('data' in result && result.data) {
        toast.success(
          t('kitchen.mealPlan.addedToShopping', 'Added {{count}} items to shopping list', {
            count: result.data.count,
          })
        );
      }
    } catch {
      toast.error(t('kitchen.mealPlan.addToShoppingError', 'Failed to add ingredients'));
    }
  };

  const handleAddAllToShopping = async () => {
    const allMealPlans = mealPlans.filter(plan => plan.id);
    if (allMealPlans.length === 0) {
      toast.info(t('kitchen.mealPlan.noMealsToAdd', 'No meals planned for this week'));
      return;
    }

    let totalAdded = 0;
    for (const plan of allMealPlans) {
      try {
        const result = await addToShopping.mutateAsync(plan.id);
        if ('data' in result && result.data) {
          totalAdded += result.data.count;
        }
      } catch {
        // Continue with other meals
      }
    }

    if (totalAdded > 0) {
      toast.success(
        t('kitchen.mealPlan.addedAllToShopping', 'Added {{count}} items to shopping list', {
          count: totalAdded,
        })
      );
    }
  };

  const formatDayName = (date: Date) => {
    return date.toLocaleDateString(i18n.language, { weekday: 'short' });
  };

  const formatDayNumber = (date: Date) => {
    return date.getDate();
  };

  const formatMonthYear = () => {
    const firstDate = weekDates[0];
    const lastDate = weekDates[6];

    if (firstDate.getMonth() === lastDate.getMonth()) {
      return firstDate.toLocaleDateString(i18n.language, {
        month: 'long',
        year: 'numeric',
      });
    }

    return `${firstDate.toLocaleDateString(i18n.language, { month: 'short' })} - ${lastDate.toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' })}`;
  };

  if (loadingMealPlans || loadingRecipes) {
    return <LoadingState />;
  }

  return (
    <>
      {/* Week Navigation */}
      <div className="bg-white dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl border border-neutral-200/60 dark:border-neutral-700/50 px-5 py-4 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-all duration-200 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                weekOffset === 0
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              )}
            >
              {t('kitchen.mealPlan.thisWeek', 'This Week')}
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-all duration-200 active:scale-95"
            >
              <ChevronRight className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            </button>
            <span className="ml-2 text-sm font-semibold text-neutral-900 dark:text-white">{formatMonthYear()}</span>
          </div>

          <button
            onClick={handleAddAllToShopping}
            disabled={mealPlans.length === 0 || addToShopping.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-xl transition-all duration-200 text-sm font-medium shadow-sm shadow-emerald-600/20 active:scale-[0.98]"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">{t('kitchen.mealPlan.addWeekToShopping', 'Add Week to Shopping')}</span>
          </button>
        </div>
      </div>

      {/* Meal Plan Grid */}
      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {weekDates.map(date => {
              const todayDate = isToday(date);
              return (
                <div
                  key={formatDateOnly(date)}
                  className={cn(
                    'text-center py-3 rounded-xl border transition-colors',
                    todayDate
                      ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40'
                      : 'bg-white dark:bg-neutral-800/80 border-neutral-200/60 dark:border-neutral-700/50'
                  )}
                >
                  <div
                    className={cn(
                      'text-xs font-medium uppercase tracking-wider',
                      todayDate ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-400 dark:text-neutral-500'
                    )}
                  >
                    {formatDayName(date)}
                  </div>
                  <div
                    className={cn(
                      'text-lg font-bold mt-0.5',
                      todayDate ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-900 dark:text-white'
                    )}
                  >
                    {formatDayNumber(date)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meal Type Rows */}
          {MEAL_TYPES.map(mealType => (
            <div key={mealType} className="mb-3">
              <div className="flex items-center gap-2 mb-2 pl-1">
                <span className="text-base">{MEAL_TYPE_ICONS[mealType]}</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {t(`kitchen.mealPlan.mealTypes.${mealType}`, mealType)}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {weekDates.map(date => {
                  const dateStr = formatDateOnly(date);
                  const meals = mealPlansByDateAndType[dateStr]?.[mealType] || [];

                  return (
                    <div
                      key={`${dateStr}-${mealType}`}
                      className="min-h-[80px] bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/50 rounded-xl p-2 transition-colors"
                    >
                      {meals.length > 0 ? (
                        <div className="space-y-2">
                          {meals.map(meal => (
                            <MealCard
                              key={meal.id}
                              meal={meal}
                              onDelete={() => handleDeleteMeal(meal.id)}
                              onAddToShopping={() => handleAddToShopping(meal.id)}
                            />
                          ))}
                          <button
                            onClick={() => handleAddMeal(dateStr, mealType)}
                            className="w-full flex items-center justify-center gap-1 py-1 text-xs text-neutral-300 dark:text-neutral-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddMeal(dateStr, mealType)}
                          className="w-full h-full flex flex-col items-center justify-center text-neutral-300 dark:text-neutral-600 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 rounded-lg transition-all duration-200"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="text-[10px] font-medium mt-0.5">{t('kitchen.mealPlan.addMeal', 'Add')}</span>
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
        <div className="text-center py-10 mt-2">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
            <CalendarRange className="w-6 h-6 text-neutral-300 dark:text-neutral-600" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-1.5">
            {t('kitchen.mealPlan.noMeals', 'No meals planned')}
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
            {t('kitchen.mealPlan.startPlanning', 'Click on any slot to start planning your meals for the week')}
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
        date={selectedDate || ''}
        mealType={selectedMealType || 'dinner'}
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
  const imageUrl = getRecipeImageUrl(meal.recipe_image_path);

  return (
    <div className="group relative bg-neutral-50 dark:bg-neutral-700/60 rounded-lg overflow-hidden">
      {imageUrl && <img src={imageUrl} alt={meal.recipe_name || ''} className="w-full h-12 object-cover" />}
      <div className="p-1.5">
        <p className="text-[11px] font-medium text-neutral-900 dark:text-white truncate leading-tight">
          {meal.recipe_name}
        </p>
      </div>

      {/* Actions overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-1.5">
        <button
          onClick={onAddToShopping}
          className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          title="Add to shopping"
        >
          <ShoppingCart className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          title="Remove"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
