import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog } from '../../../components/dialog';
import {
  useMediaInteractiveDownload,
  useMediaInteractiveSearch,
  type InteractiveReleaseItem,
  type MediaItem,
} from '@hously/shared';

interface InteractiveSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
}

const formatBytes = (bytes: number | null): string => {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
};

export function InteractiveSearchDialog({ isOpen, onClose, media }: InteractiveSearchDialogProps) {
  const { t } = useTranslation('common');
  const sourceId = media?.source_id ?? null;
  const service = media?.service ?? 'radarr';

  const releasesQuery = useMediaInteractiveSearch(
    { service, source_id: sourceId },
    {
      enabled: isOpen && Boolean(media),
    }
  );
  const downloadMutation = useMediaInteractiveDownload();

  const releases = useMemo(() => releasesQuery.data?.releases ?? [], [releasesQuery.data?.releases]);

  const downloadRelease = async (release: InteractiveReleaseItem) => {
    if (!media || !sourceId || !release.indexer_id || downloadMutation.isPending) return;

    try {
      await downloadMutation.mutateAsync({
        service,
        source_id: sourceId,
        guid: release.guid,
        indexer_id: release.indexer_id,
      });
      toast.success(t('medias.interactive.downloadStarted'));
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('medias.interactive.downloadFailed');
      toast.error(message);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('medias.interactive.title', {
        title: media?.title ?? '',
      })}
    >
      {!media ? null : (
        <div className="space-y-3">
          {releasesQuery.isLoading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.loading')}</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.empty')}</p>
          ) : (
            <div className="space-y-2 max-h-[60dvh] overflow-y-auto pr-1">
              {releases.map(release => (
                <div
                  key={`${release.guid}-${release.indexer_id ?? 'x'}`}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 bg-white dark:bg-neutral-900"
                >
                  <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-2">{release.title}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>{release.indexer || t('medias.interactive.unknownIndexer')}</span>
                    <span>{release.protocol || '-'}</span>
                    <span>{formatBytes(release.size_bytes)}</span>
                    <span>{t('medias.interactive.age', { age: release.age ?? '-' })}</span>
                    <span>
                      {t('medias.interactive.seedersLeechers', {
                        seeders: release.seeders ?? '-',
                        leechers: release.leechers ?? '-',
                      })}
                    </span>
                  </div>

                  {release.rejected && release.rejection_reason ? (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{release.rejection_reason}</p>
                  ) : null}

                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        void downloadRelease(release);
                      }}
                      disabled={downloadMutation.isPending || !release.indexer_id || release.rejected}
                      className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                    >
                      {downloadMutation.isPending ? t('medias.interactive.downloading') : t('medias.interactive.download')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
