import { Loader2, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { C411MediaInfoResponse, C411ReleaseStatusResponse } from '@hously/shared';
import { formatSize, BADGE_BASE, CARD, STAT_SEED } from './c411-utils';
import { buildSlotStates, buildMediaSummary, type SlotState } from './c411-slot-matching';

interface Props {
  data: C411ReleaseStatusResponse | null;
  isLoading: boolean;
  enabled: boolean;
  mediaInfo: C411MediaInfoResponse | null;
}

const CARD_BY_STATE: Record<SlotState, string> = {
  neutral: CARD,
  occupied: 'rounded-xl border border-sky-200/60 bg-sky-50/20 dark:border-sky-800/30 dark:bg-sky-950/10',
  mine: 'rounded-xl border border-fuchsia-200/70 bg-fuchsia-50/30 dark:border-fuchsia-800/40 dark:bg-fuchsia-950/15',
  match: 'rounded-xl border border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-800/30 dark:bg-emerald-950/10',
  candidate: 'rounded-xl border border-amber-200/60 bg-amber-50/20 dark:border-amber-800/30 dark:bg-amber-950/10',
};

const BADGE_BY_STATE: Record<SlotState, string> = {
  neutral: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
  occupied: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300',
  mine: 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300',
  match: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  candidate: 'bg-amber-100/70 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
};

const LABEL_BY_STATE: Record<SlotState, string> = {
  neutral: 'Free',
  occupied: 'Occupied',
  mine: 'My Release',
  match: 'Best Match',
  candidate: 'Could Take',
};

export function C411SlotGrid({ data, isLoading, enabled, mediaInfo }: Props) {
  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No TMDB ID available for this movie</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data || data.slotGrid.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <Grid3X3 className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No release slots</p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">No slot data found for this movie</p>
      </div>
    );
  }

  const slotStates = buildSlotStates(data, mediaInfo);
  const mediaSummary = buildMediaSummary(mediaInfo);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{data.totalOccupied}/{data.totalSlots} slots occupied</span>
        <span className="text-emerald-600 dark:text-emerald-400">{data.totalFree} free</span>
        {mediaSummary && (
          <span className="rounded-full border border-neutral-200/80 px-2.5 py-1 text-[11px] text-neutral-600 dark:border-neutral-700/60 dark:text-neutral-300">
            {mediaSummary}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={cn(BADGE_BASE, BADGE_BY_STATE.occupied)}>Occupied</span>
        <span className={cn(BADGE_BASE, BADGE_BY_STATE.mine)}>My Release</span>
        <span className={cn(BADGE_BASE, BADGE_BY_STATE.match)}>Your Match</span>
        <span className={cn(BADGE_BASE, BADGE_BY_STATE.candidate)}>Could Take</span>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {data.profiles.map((profile) => (
          <div key={profile.profile} className={cn(CARD, 'px-2.5 py-1.5')}>
            <span className="text-xs font-medium text-neutral-900 dark:text-white">{profile.profile}</span>
            <span className="ml-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">{profile.occupied}/{profile.total}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.slotGrid.map((slot) => {
          const state = slotStates.get(slot.id) ?? 'neutral';

          return (
            <div key={slot.id} className={cn('p-3', CARD_BY_STATE[state])}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-900 dark:text-white">{slot.label}</span>
                <span className={cn(BADGE_BASE, BADGE_BY_STATE[state])}>{LABEL_BY_STATE[state]}</span>
              </div>
              {slot.occupants.map((occupant) => (
                <div key={occupant.torrentId} className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <p className="truncate font-medium text-neutral-700 dark:text-neutral-300">{occupant.torrentName}</p>
                  {occupant.isMine && <span className={cn(BADGE_BASE, BADGE_BY_STATE.mine, 'mt-1')}>My release</span>}
                  <div className="mt-0.5 flex items-center gap-2">
                    <span>{occupant.resolution}</span>
                    <span>{occupant.source}</span>
                    <span>{occupant.videoCodec}</span>
                    <span>{occupant.audioCodec}</span>
                    <span>{formatSize(occupant.fileSize)}</span>
                    <span className={STAT_SEED}>{occupant.seeders}S</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
