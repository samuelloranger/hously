import { Loader2, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { C411ReleaseStatusResponse } from '@hously/shared';

interface Props {
  data: C411ReleaseStatusResponse | null;
  isLoading: boolean;
  enabled: boolean;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

export function C411SlotGrid({ data, isLoading, enabled }: Props) {
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
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">No slot data found for this movie</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{data.totalOccupied}/{data.totalSlots} slots occupied</span>
        <span className="text-emerald-600 dark:text-emerald-400">{data.totalFree} free</span>
      </div>

      {/* Profile summary */}
      <div className="flex flex-wrap gap-2 mb-2">
        {data.profiles.map((p) => (
          <div
            key={p.profile}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 px-2.5 py-1.5"
          >
            <span className="text-xs font-medium text-neutral-900 dark:text-white">{p.profile}</span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{p.occupied}/{p.total}</span>
          </div>
        ))}
      </div>

      {/* Slot grid */}
      <div className="space-y-2">
        {data.slotGrid.map((slot) => (
          <div
            key={slot.id}
            className={cn(
              'rounded-xl border p-3',
              slot.occupants.length > 0
                ? 'border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-800/30 dark:bg-emerald-950/10'
                : 'border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-medium text-neutral-900 dark:text-white">{slot.label}</span>
              <span className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium',
                slot.occupants.length > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
              )}>
                {slot.occupants.length > 0 ? 'Occupied' : 'Free'}
              </span>
            </div>
            {slot.occupants.map((occ) => (
              <div key={occ.torrentId} className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                <p className="truncate font-medium text-neutral-700 dark:text-neutral-300">{occ.torrentName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span>{occ.resolution}</span>
                  <span>{occ.source}</span>
                  <span>{occ.videoCodec}</span>
                  <span>{occ.audioCodec}</span>
                  <span>{formatSize(occ.fileSize)}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{occ.seeders}S</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
