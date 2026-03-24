import { Loader2, FolderOpen, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useC411DeleteRelease } from '@hously/shared';
import type { C411LocalRelease } from '@hously/shared';
import { formatReleaseSize as formatSize, capitalizeStatus } from '@hously/shared';
import {
  STATUS_BADGE,
  STATUS_BORDER,
  STATUS_BG,
  BADGE_BASE,
  BADGE_NEUTRAL,
  BADGE_SKY,
  BADGE_VIOLET,
  CARD_STATUS,
  STAT_LINE,
} from './c411-utils';

const PREPARE_STEPS = [
  { key: 'mediainfo',   label: 'Analyzing media' },
  { key: 'languages',   label: 'Detecting languages' },
  { key: 'tmdb',        label: 'Fetching metadata' },
  { key: 'hardlinking', label: 'Creating hardlinks' },
  { key: 'torrent',     label: 'Creating torrent' },
  { key: 'uploading',   label: 'Uploading' },
] as const;

function parseHardlinkStep(step: string): { done: number; total: number; eta: number | null } | null {
  const m = step.match(/^hardlinking:(\d+)\/(\d+)(?::(\d+))?$/);
  if (!m) return null;
  return { done: Number(m[1]), total: Number(m[2]), eta: m[3] != null ? Number(m[3]) : null };
}

function parseTorrentStep(step: string): number | null {
  const m = step.match(/^torrent:(\d+)$/);
  return m ? Number(m[1]) : null;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.round(seconds / 60);
  return `~${m}min`;
}

function PrepareStepTimeline({ step }: { step: string }) {
  const activeKey = step.startsWith('hardlinking') ? 'hardlinking' : step.startsWith('torrent') ? 'torrent' : step;
  const activeIndex = PREPARE_STEPS.findIndex(s => s.key === activeKey);
  const hlInfo = step.startsWith('hardlinking') ? parseHardlinkStep(step) : null;
  const torrentPct = step.startsWith('torrent') ? parseTorrentStep(step) : null;

  return (
    <div className="mt-2.5 space-y-1">
      {PREPARE_STEPS.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={s.key} className={cn('flex items-center gap-1.5 text-[11px]', done ? 'text-emerald-600 dark:text-emerald-400' : active ? 'text-indigo-500 dark:text-indigo-400' : 'text-neutral-400 dark:text-neutral-600')}>
            {done
              ? <CheckCircle2 className="h-3 w-3 shrink-0" />
              : active
                ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                : <Circle className="h-3 w-3 shrink-0 opacity-40" />}
            <span>
              {s.label}
              {active && s.key === 'hardlinking' && hlInfo && (
                <span className="ml-1 tabular-nums opacity-80">
                  ({hlInfo.done}/{hlInfo.total}
                  {hlInfo.eta !== null && hlInfo.eta > 0 && ` · ${formatEta(hlInfo.eta)}`})
                </span>
              )}
              {active && s.key === 'torrent' && torrentPct !== null && (
                <span className="ml-1 tabular-nums opacity-80">{torrentPct}%</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  releases: C411LocalRelease[];
  isLoading: boolean;
  onEdit: (id: number) => void;
  prepareStatus?: 'pending' | 'success' | null;
  prepareSteps?: Record<number, string>;
  emptyMessage?: string;
}

/** Tiny seeder/leecher bar — visual at-a-glance health. */
function SeedBar({ seeders, leechers }: { seeders: number; leechers: number }) {
  const total = seeders + leechers || 1;
  const pct = Math.round((seeders / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 rounded-full bg-neutral-200/80 dark:bg-neutral-700/60 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            pct >= 60 ? 'bg-emerald-500 dark:bg-emerald-400' : pct >= 30 ? 'bg-amber-400 dark:bg-amber-500' : 'bg-red-400 dark:bg-red-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={STAT_LINE}>
        <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">{seeders}<span className="opacity-60">S</span></span>
        <span className="text-red-500/80 dark:text-red-400/80 tabular-nums">{leechers}<span className="opacity-60">L</span></span>
      </span>
    </div>
  );
}

export function C411ReleasesList({ releases, isLoading, onEdit, prepareStatus, prepareSteps, emptyMessage }: Props) {
  const deleteRelease = useC411DeleteRelease();

  const handleDelete = (release: C411LocalRelease) => {
    const confirmation = release.c411_torrent_id
      ? 'Delete this local release copy? If it still exists on C411, a future sync will import it again.'
      : 'Delete this release? This will also remove the hardlink and .torrent file.';

    if (!confirm(confirmation)) return;
    deleteRelease.mutate(release.id);
  };

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

  const renderRelease = (r: C411LocalRelease) => {
    const borderColor = STATUS_BORDER[r.status] ?? STATUS_BORDER.local;
    const bgTint = STATUS_BG[r.status] ?? '';

    return (
      <div key={r.id} className={cn(CARD_STATUS, borderColor, bgTint, 'p-3.5')}>
        <div className="flex items-start justify-between gap-3">
          {/* Left content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate leading-snug">{r.name}</p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={cn(BADGE_BASE, STATUS_BADGE[r.status] ?? STATUS_BADGE.local, 'gap-1')}>
                {r.status === 'approved' && <CheckCircle2 className="h-2.5 w-2.5" />}
                {r.status === 'pending' && <ArrowUpCircle className="h-2.5 w-2.5" />}
                {r.status === 'rejected' && <ArrowDownCircle className="h-2.5 w-2.5" />}
                {capitalizeStatus(r.status)}
              </span>
              {r.resolution && <span className={BADGE_NEUTRAL}>{r.resolution}</span>}
              {r.language && <span className={BADGE_NEUTRAL}>{r.language}</span>}
              {r.has_presentation && <span className={BADGE_SKY}>prez</span>}
              {r.has_torrent && <span className={BADGE_VIOLET}>.torrent</span>}
            </div>

            {r.status === 'preparing' && prepareSteps?.[r.id] && (
              <PrepareStepTimeline step={prepareSteps[r.id]} />
            )}

            {typeof r.metadata?.prepareError === 'string' && r.metadata.prepareError && (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-300">{r.metadata.prepareError}</p>
            )}

            {/* Stats row */}
            <div className="mt-2 flex items-center gap-3">
              {r.seeders !== null && (
                <SeedBar seeders={r.seeders ?? 0} leechers={r.leechers ?? 0} />
              )}
              {r.completions !== null && r.completions !== undefined && (
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums">{r.completions} compl.</span>
              )}
              {r.size && (
                <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">{formatSize(r.size)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => onEdit(r.id)}
              className="rounded-lg p-1.5 text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              title="Edit release"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {r.status !== 'preparing' && (
              <button
                onClick={() => handleDelete(r)}
                disabled={deleteRelease.isPending}
                className="rounded-lg p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                title="Delete local release"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {prepareStatus === 'success' && (
        <div className="rounded-xl border border-sky-200/60 dark:border-sky-800/30 bg-sky-50/30 dark:bg-sky-950/10 p-3 text-xs text-sky-700 dark:text-sky-300">
          Release queued. Torrent generation is running in the background.
        </div>
      )}
      <div className="space-y-2">{releases.map(renderRelease)}</div>
    </div>
  );
}
