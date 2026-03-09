import { useTranslation } from 'react-i18next';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { queryKeys } from '@hously/shared';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { MediasExplore } from './components/MediasExplore';

export function ExplorePage() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: queryKeys.medias.explore() });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.medias.explore() });
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🧭"
        iconColor="text-indigo-600"
        title={t('medias.explore.pageTitle')}
        subtitle={t('medias.explore.pageSubtitle')}
        onRefresh={handleRefresh}
        isRefreshing={isFetching > 0}
      />
      <MediasExplore />
    </PageLayout>
  );
}
