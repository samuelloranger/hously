import { useTranslation } from 'react-i18next';
import { useSimilarMedias } from '@hously/shared';
import { Dialog } from '../../../components/dialog';
import { ExploreCard } from './ExploreCard';

interface SimilarMediasDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  title: string;
  onAdded: () => void;
}

export function SimilarMediasDialog({ isOpen, onClose, tmdbId, mediaType, title, onAdded }: SimilarMediasDialogProps) {
  const { t, i18n } = useTranslation('common');
  const { data, isLoading } = useSimilarMedias(tmdbId, mediaType, i18n.language, { enabled: isOpen });

  const items = data?.items ?? [];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('medias.similar.title', { title })}>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-neutral-500">{t('common.loading')}</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400 py-12">
          {t('medias.similar.empty')}
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[60dvh] overflow-y-auto py-1">
          {items.map(item => (
            <ExploreCard key={item.id} item={item} onAdded={onAdded} />
          ))}
        </div>
      )}
    </Dialog>
  );
}
