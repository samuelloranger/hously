import type { MediaItem } from '../types/media';

export type MediaFilter = 'all' | 'movie' | 'series';
export type MediaSortKey = 'added_at' | 'title' | 'year' | 'service' | 'status' | 'downloaded' | 'monitored';
export type MediaSortDir = 'asc' | 'desc';

const getAddedTime = (item: MediaItem): number => {
  if (!item.added_at) return 0;
  const parsed = Date.parse(item.added_at);
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface MediaFilterParams {
  filter: MediaFilter;
  search: string;
  sortBy: MediaSortKey;
  sortDir: MediaSortDir;
}

/**
 * Filter and sort a list of media items.
 */
export function filterAndSortMediaItems(
  items: MediaItem[],
  params: MediaFilterParams
): MediaItem[] {
  const { filter, search, sortBy, sortDir } = params;
  const needle = search.trim().toLowerCase();

  return items
    .filter(item => (filter === 'all' ? true : item.media_type === filter))
    .filter(item => {
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'added_at') cmp = getAddedTime(a) - getAddedTime(b);
      else if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortBy === 'year') cmp = (a.year ?? 0) - (b.year ?? 0);
      else if (sortBy === 'service') cmp = a.service.localeCompare(b.service);
      else if (sortBy === 'status') cmp = (a.status ?? '').localeCompare(b.status ?? '');
      else if (sortBy === 'downloaded') cmp = Number(a.downloaded) - Number(b.downloaded);
      else if (sortBy === 'monitored') cmp = Number(a.monitored) - Number(b.monitored);

      if (cmp === 0) return a.title.localeCompare(b.title);
      return sortDir === 'asc' ? cmp : -cmp;
    });
}
