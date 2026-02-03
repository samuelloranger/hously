import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "../../../components/PageLayout";
import { PageHeader } from "../../../components/PageHeader";
import { RecipeListContent } from "./RecipeListContent";
import { MealPlanView } from "./MealPlanView";

type TabType = "recipes" | "mealPlan";

export function KitchenPage() {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<TabType>("recipes");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // The child components will handle their own refresh logic
    // We just trigger a re-render by toggling this state
    setTimeout(() => setIsRefreshing(false), 100);
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🍳"
        iconColor="text-orange-600"
        title={t("kitchen.title", "Kitchen")}
        subtitle={t("kitchen.subtitle", "Manage recipes and plan your meals")}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => handleTabChange("recipes")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "recipes"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          {t("kitchen.tabs.recipes", "Recipes")}
        </button>
        <button
          onClick={() => handleTabChange("mealPlan")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === "mealPlan"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
          }`}
        >
          {t("kitchen.tabs.mealPlan", "Meal Plan")}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "recipes" ? (
        <RecipeListContent refreshKey={isRefreshing ? Date.now() : 0} />
      ) : (
        <MealPlanView refreshKey={isRefreshing ? Date.now() : 0} />
      )}
    </PageLayout>
  );
}
