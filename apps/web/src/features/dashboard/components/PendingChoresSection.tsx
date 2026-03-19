import { EmptyState } from '@/components/EmptyState';
import { ListItemSkeleton } from '@/components/Skeleton';
import { ChoreRow } from '@/features/chores/components/ChoreRow';
import { useChores } from '@hously/shared';
import { useTranslation } from 'react-i18next';
import { useModalSearchParams } from '@/hooks/useModalSearchParams';
import type { ChoresSearchParams } from '@/router';

const PendingChoresSection = () => {
  const { t } = useTranslation('common');
  const { data: choresData, isLoading: choresLoading } = useChores();
  const { setParams, resetParams } = useModalSearchParams<ChoresSearchParams>('/chores', {});

  const users = choresData?.users || [];
  const chores = choresData?.chores || [];

  const pendingChores = chores.filter(chore => !chore.completed);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-200/80 dark:border-emerald-700/40 bg-gradient-to-br from-[#ecfdf5] via-[#e6faf0] to-[#d1fae5] dark:from-emerald-950/50 dark:via-green-950/35 dark:to-emerald-900/25 shadow-sm">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-700/50">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-200/80 dark:bg-emerald-800/40 text-[10px]">
            ✅
          </div>
          <h3 className="text-[11px] font-semibold text-emerald-950 dark:text-white">{t('dashboard.pendingChores')}</h3>
        </div>
        {pendingChores.length > 5 && (
          <a href="/chores" className="text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:underline">
            {t('dashboard.view')} ({pendingChores.length})
          </a>
        )}
      </div>
      <div className="divide-y divide-emerald-200/60 dark:divide-emerald-700/50">
        {choresLoading ? (
          <div className="p-4 space-y-2">
            <ListItemSkeleton />
            <ListItemSkeleton />
            <ListItemSkeleton />
          </div>
        ) : pendingChores.length > 0 ? (
          pendingChores.slice(0, 5).map(chore => (
            <ChoreRow 
              key={chore.id} 
              chore={chore} 
              users={users} 
              setParams={setParams}
              resetParams={resetParams}
              searchParams={{}}
            />
          ))
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
