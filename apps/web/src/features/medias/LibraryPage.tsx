import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { queryKeys, useProwlarrPlugin } from '@hously/shared';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { Search } from 'lucide-react';
import { MediasLibrary } from './components/MediasLibrary';
import { InteractiveSearchDialog } from './components/InteractiveSearchDialog';

export function LibraryPage() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: queryKeys.medias.list() });
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const { data: prowlarrData, isLoading: isLoadingProwlarr } = useProwlarrPlugin();
  const isProwlarrEnabled = Boolean(prowlarrData?.plugin.enabled && prowlarrData.plugin.website_url);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.medias.list() });
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🎞️"
        iconColor="text-indigo-600"
        title={t('medias.library.pageTitle')}
        subtitle={t('medias.library.pageSubtitle')}
        actions={
          <button
            type="button"
            onClick={() => setIsGlobalSearchOpen(true)}
            disabled={!isProwlarrEnabled || isLoadingProwlarr}
            title={!isProwlarrEnabled ? t('medias.interactive.notConfigured') : t('medias.interactive.globalButton')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search size={15} />
            {t('medias.interactive.globalButton')}
          </button>
        }
        onRefresh={handleRefresh}
        isRefreshing={isFetching > 0}
      />
      <MediasLibrary />
      <InteractiveSearchDialog isOpen={isGlobalSearchOpen} onClose={() => setIsGlobalSearchOpen(false)} mode="prowlarr" />
    </PageLayout>
  );
}
