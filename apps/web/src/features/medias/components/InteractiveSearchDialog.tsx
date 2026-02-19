import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDownAZ, ArrowUpZA } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

type InteractiveSortKey = 'seeders' | 'age' | 'size' | 'title';
type InteractiveSortDir = 'asc' | 'desc';

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
  const [hideRejected, setHideRejected] = useState(true);
  const [sortBy, setSortBy] = useState<InteractiveSortKey>('seeders');
  const [sortDir, setSortDir] = useState<InteractiveSortDir>('desc');
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const releasesQuery = useMediaInteractiveSearch(
    { service, source_id: sourceId },
    {
      enabled: isOpen && Boolean(media),
    }
  );
  const downloadMutation = useMediaInteractiveDownload();

  const releases = useMemo(() => {
    const raw = releasesQuery.data?.releases ?? [];
    const filtered = hideRejected ? raw.filter(release => !release.rejected) : raw;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'seeders') cmp = (a.seeders ?? -1) - (b.seeders ?? -1);
      else if (sortBy === 'age') cmp = (a.age ?? Number.MAX_SAFE_INTEGER) - (b.age ?? Number.MAX_SAFE_INTEGER);
      else if (sortBy === 'size') cmp = (a.size_bytes ?? -1) - (b.size_bytes ?? -1);
      else cmp = a.title.localeCompare(b.title);

      if (cmp === 0) return a.title.localeCompare(b.title);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [releasesQuery.data?.releases, hideRejected, sortBy, sortDir]);

  const rowVirtualizer = useVirtualizer({
    count: releases.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 170,
    overscan: 6,
  });

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
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={hideRejected}
                onChange={e => setHideRejected(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              {t('medias.interactive.hideRejected')}
            </label>

            <label className="text-xs text-neutral-500 dark:text-neutral-400">{t('medias.interactive.sortLabel')}</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as InteractiveSortKey)}
              className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-900 dark:text-neutral-100"
            >
              <option value="seeders">{t('medias.interactive.sortOptions.seeders')}</option>
              <option value="age">{t('medias.interactive.sortOptions.age')}</option>
              <option value="size">{t('medias.interactive.sortOptions.size')}</option>
              <option value="title">{t('medias.interactive.sortOptions.title')}</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
            >
              {sortDir === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
              <span>{sortDir === 'asc' ? t('medias.asc') : t('medias.desc')}</span>
            </button>
          </div>

          {releasesQuery.isLoading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.loading')}</p>
          ) : releases.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.empty')}</p>
          ) : (
            <div ref={setScrollElement} className="max-h-[60dvh] overflow-y-auto pr-1">
              <div
                className="relative w-full"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                }}
              >
                {rowVirtualizer.getVirtualItems().map(virtualRow => {
                  const release = releases[virtualRow.index];
                  if (!release) return null;

                  return (
                    <div
                      key={`${release.guid}-${release.indexer_id ?? 'x'}`}
                      className="absolute left-0 top-0 w-full px-0"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 bg-white dark:bg-neutral-900 mb-2">
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
                            {downloadMutation.isPending
                              ? t('medias.interactive.downloading')
                              : t('medias.interactive.download')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
