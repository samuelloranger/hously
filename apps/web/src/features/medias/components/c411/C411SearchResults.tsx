import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { C411SearchResponse } from '@hously/shared';
import { formatReleaseSize as formatSize, capitalizeStatus } from '@hously/shared';
import { STATUS_BADGE, BADGE_BASE, BADGE_NEUTRAL, BADGE_INDIGO, CARD, CARD_HIGHLIGHT, STAT_LINE, STAT_SEED, STAT_LEECH } from './c411-utils';

interface Props {
  data: C411SearchResponse | null;
  isLoading: boolean;
  query: string;
}

export function C411SearchResults({ data, isLoading, query }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No results</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {query ? `No torrents found for "${query}"` : 'Enter a search query'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {data.meta.total} result{data.meta.total !== 1 ? 's' : ''}
      </p>
      {data.data.map((torrent) => (
        <div key={torrent.id} className={cn('p-3', torrent.isOwner ? CARD_HIGHLIGHT : CARD)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{torrent.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={BADGE_NEUTRAL}>{torrent.category.name}</span>
                <span className={cn(BADGE_BASE, STATUS_BADGE[torrent.status] ?? STATUS_BADGE.local)}>{capitalizeStatus(torrent.status)}</span>
                {torrent.isOwner && <span className={BADGE_INDIGO}>yours</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="text-xs font-medium text-neutral-900 dark:text-white">{formatSize(torrent.size)}</span>
              <div className={STAT_LINE}>
                <span className={STAT_SEED}>{torrent.seeders}S</span>
                <span className={STAT_LEECH}>{torrent.leechers}L</span>
                <span>{torrent.completions}C</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
