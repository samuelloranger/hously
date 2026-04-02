import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { RecipeListContent } from '@/pages/kitchen/_component/RecipeListContent';
import { MealPlanView } from '@/pages/kitchen/_component/MealPlanView';
import { UtensilsCrossed, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'recipes' | 'mealPlan';

export function KitchenPage() {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<TabType>('recipes');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(Date.now());
    setTimeout(() => setIsRefreshing(false), 100);
  };

  const tabs = [
    { key: 'recipes' as TabType, label: t('kitchen.tabs.recipes', 'Recipes'), icon: UtensilsCrossed },
    { key: 'mealPlan' as TabType, label: t('kitchen.tabs.mealPlan', 'Meal Plan'), icon: CalendarRange },
  ];

  return (
    <PageLayout>
      <PageHeader
        icon="🍳"
        iconColor="text-orange-600"
        title={t('kitchen.title', 'Kitchen')}
        subtitle={t('kitchen.subtitle', 'Manage recipes and plan your meals')}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-800/60 p-1 rounded-xl w-fit border border-neutral-200/50 dark:border-neutral-700/40">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab.key
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'recipes' ? (
        <RecipeListContent refreshKey={refreshKey} />
      ) : (
        <MealPlanView refreshKey={refreshKey} />
      )}
    </PageLayout>
  );
}
