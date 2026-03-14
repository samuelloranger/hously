import { Loader2, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useC411DeleteRelease } from '@hously/shared';
import type { C411LocalRelease } from '@hously/shared';
import { formatSize, STATUS_BADGE, BADGE_BASE, BADGE_NEUTRAL, BADGE_SKY, BADGE_VIOLET, CARD_HOVER, STAT_LINE, STAT_SEED, STAT_LEECH } from './c411-utils';

interface Props {
  releases: C411LocalRelease[];
  isLoading: boolean;
  onEdit: (id: number) => void;
  prepareStatus?: 'pending' | 'success' | null;
  emptyMessage?: string;
}

export function C411ReleasesList({ releases, isLoading, onEdit, prepareStatus, emptyMessage }: Props) {
  const deleteRelease = useC411DeleteRelease();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <FolderOpen className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No releases</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {emptyMessage ?? 'Use "Prepare Release" to create one, or "Sync" to import from C411'}
        </p>
      </div>
    );
  }

  const renderRelease = (r: C411LocalRelease) => (
    <div key={r.id} className={cn('p-3', CARD_HOVER)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{r.name}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={cn(BADGE_BASE, STATUS_BADGE[r.status] ?? STATUS_BADGE.local)}>{r.status}</span>
            {r.resolution && <span className={BADGE_NEUTRAL}>{r.resolution}</span>}
            {r.language && <span className={BADGE_NEUTRAL}>{r.language}</span>}
            {r.has_presentation && <span className={BADGE_SKY}>prez</span>}
            {r.has_torrent && <span className={BADGE_VIOLET}>.torrent</span>}
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
        <div className={cn(STAT_LINE, 'mt-1.5')}>
          <span className={STAT_SEED}>{r.seeders}S</span>
          <span className={STAT_LEECH}>{r.leechers}L</span>
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
      <div className="space-y-2">{releases.map(renderRelease)}</div>
    </div>
  );
}
