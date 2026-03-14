import { Loader2, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useC411DeleteRelease } from '@hously/shared';
import type { C411ReleasesResponse } from '@hously/shared';

interface Props {
  data: C411ReleasesResponse | null;
  isLoading: boolean;
  tmdbId: number | null;
  onEdit: (id: number) => void;
  prepareStatus: 'pending' | 'success' | null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

const STATUS_STYLES: Record<string, string> = {
  local: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
  pending: 'bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
};

export function C411ReleasesList({ data, isLoading, tmdbId, onEdit, prepareStatus }: Props) {
  const deleteRelease = useC411DeleteRelease();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const releases = data?.releases ?? [];
  const filtered = tmdbId ? releases.filter((r) => r.tmdb_id === tmdbId) : [];
  const others = tmdbId ? releases.filter((r) => r.tmdb_id !== tmdbId) : releases;

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <FolderOpen className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No releases</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Use "Prepare Release" to create one, or "Sync" to import from C411
        </p>
      </div>
    );
  }

  const renderRelease = (r: (typeof releases)[0]) => (
    <div
      key={r.id}
      className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 p-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{r.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium', STATUS_STYLES[r.status] ?? STATUS_STYLES.local)}>
              {r.status}
            </span>
            {r.resolution && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                {r.resolution}
              </span>
            )}
            {r.language && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                {r.language}
              </span>
            )}
            {r.has_presentation && (
              <span className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                prez
              </span>
            )}
            {r.has_torrent && (
              <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                .torrent
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {r.size && <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-2">{formatSize(r.size)}</span>}
          <button
            onClick={() => onEdit(r.id)}
            className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {r.status === 'local' && (
            <button
              onClick={() => { if (confirm('Delete this release? This will also remove the hardlink and .torrent file.')) deleteRelease.mutate(r.id); }}
              disabled={deleteRelease.isPending}
              className="rounded-lg p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {r.seeders !== null && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
          <span className="text-emerald-600 dark:text-emerald-400">{r.seeders}S</span>
          <span className="text-red-500 dark:text-red-400">{r.leechers}L</span>
          <span>{r.completions}C</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {prepareStatus === 'success' && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Release prepared successfully!
        </div>
      )}
      {filtered.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            This movie
          </p>
          <div className="space-y-2">{filtered.map(renderRelease)}</div>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
            {filtered.length > 0 ? 'Other releases' : 'All releases'}
          </p>
          <div className="space-y-2">{others.map(renderRelease)}</div>
        </div>
      )}
    </div>
  );
}
