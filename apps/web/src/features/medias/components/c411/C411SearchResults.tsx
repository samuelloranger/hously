import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { C411SearchResponse } from '@hously/shared';

interface Props {
  data: C411SearchResponse | null;
  isLoading: boolean;
  query: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
  return `${(bytes / 1024).toFixed(0)} Ko`;
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
        <div
          key={torrent.id}
          className={cn(
            'rounded-xl border p-3 transition-colors',
            torrent.isOwner
              ? 'border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-500/20 dark:bg-indigo-950/10'
              : 'border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{torrent.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                  {torrent.category.name}
                </span>
                <span className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium',
                  torrent.status === 'approved' && 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
                  torrent.status === 'pending' && 'bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
                  torrent.status === 'rejected' && 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
                )}>
                  {torrent.status}
                </span>
                {torrent.isOwner && (
                  <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                    yours
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="text-xs font-medium text-neutral-900 dark:text-white">{formatSize(torrent.size)}</span>
              <div className="flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                <span className="text-emerald-600 dark:text-emerald-400">{torrent.seeders}S</span>
                <span className="text-red-500 dark:text-red-400">{torrent.leechers}L</span>
                <span>{torrent.completions}C</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
