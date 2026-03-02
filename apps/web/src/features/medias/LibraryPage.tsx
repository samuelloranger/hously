import { useTranslation } from 'react-i18next';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { queryKeys } from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { MediasLibrary } from './components/MediasLibrary';

export function LibraryPage() {
  const { t } = useTranslation('common');
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: queryKeys.medias.list() });

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
        onRefresh={handleRefresh}
        isRefreshing={isFetching > 0}
      />
      <MediasLibrary />
    </PageLayout>
  );
}
