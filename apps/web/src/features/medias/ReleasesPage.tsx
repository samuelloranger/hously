import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { queryKeys, useC411Releases, useC411Sync, useC411Drafts } from '@hously/shared';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { Dialog } from '@/components/dialog';
import { C411ReleasesList } from './components/c411/C411ReleasesList';
import { C411ReleaseEditor } from './components/c411/C411ReleaseEditor';
import { C411DraftsList } from './components/c411/C411DraftsList';

type Tab = 'releases' | 'drafts';

export function ReleasesPage() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: queryKeys.c411.releases() });

  const [activeTab, setActiveTab] = useState<Tab>('releases');
  const [editingReleaseId, setEditingReleaseId] = useState<number | null>(null);

  const releases = useC411Releases();
  const drafts = useC411Drafts({ enabled: activeTab === 'drafts' });
  const sync = useC411Sync();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
    if (activeTab === 'drafts') {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.drafts() });
    }
  };

  return (
    <PageLayout>
      <PageHeader
        icon="📦"
        iconColor="text-indigo-600"
        title={t('nav.releases')}
        subtitle="C411 releases & drafts"
        actions={
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {sync.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            Sync from C411
          </button>
        }
        onRefresh={handleRefresh}
        isRefreshing={isFetching > 0}
      />

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-2">
        {(['releases', 'drafts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150 ${
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {tab === 'releases' ? `Releases (${releases.data?.releases.length ?? 0})` : `Drafts (${drafts.data?.count ?? 0})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 p-4 sm:p-5">
        {activeTab === 'releases' && (
          <C411ReleasesList
            releases={releases.data?.releases ?? []}
            isLoading={releases.isLoading}
            onEdit={(id) => setEditingReleaseId(id)}
          />
        )}
        {activeTab === 'drafts' && (
          <C411DraftsList
            data={drafts.data ?? null}
            isLoading={drafts.isLoading}
          />
        )}
      </div>

      {/* Release editor dialog */}
      {editingReleaseId !== null && (
        <Dialog
          isOpen
          onClose={() => setEditingReleaseId(null)}
          title="Edit Release"
          panelClassName="max-w-5xl"
        >
          <C411ReleaseEditor
            releaseId={editingReleaseId}
            onBack={() => setEditingReleaseId(null)}
          />
        </Dialog>
      )}
    </PageLayout>
  );
}
