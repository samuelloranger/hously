import { EmptyState } from '@/components/EmptyState';
import { ListItemSkeleton } from '@/components/Skeleton';
import { ChoreRow } from '@/features/chores/components/ChoreRow';
import { useChores } from '@hously/shared';
import { useTranslation } from 'react-i18next';

const PendingChoresSection = () => {
  const { t } = useTranslation('common');
  const { data: choresData, isLoading: choresLoading } = useChores();

  const users = choresData?.users || [];
  const chores = choresData?.chores || [];

  const pendingChores = chores.filter(chore => !chore.completed);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/30 dark:from-neutral-800 dark:via-neutral-800/80 dark:to-neutral-900/60 shadow-sm">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-700/50">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100/80 dark:bg-emerald-900/30 text-[10px]">
            ✅
          </div>
          <h3 className="text-[11px] font-semibold text-neutral-900 dark:text-white">{t('dashboard.pendingChores')}</h3>
        </div>
        {pendingChores.length > 5 && (
          <a href="/chores" className="text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline">
            {t('dashboard.view')} ({pendingChores.length})
          </a>
        )}
      </div>
      <div className="divide-y divide-neutral-200/60 dark:divide-neutral-700/50">
        {choresLoading ? (
          <div className="p-4 space-y-2">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : pendingChores.length > 0 ? (
          pendingChores.slice(0, 5).map(chore => <ChoreRow key={chore.id} chore={chore} users={users} />)
        ) : (
          <div className="p-6">
            <EmptyState icon="✅" title={t('chores.noChores')} description={t('chores.addFirstChore')} />
          </div>
        )}
      </div>
    </section>
  );
};

export default PendingChoresSection;
