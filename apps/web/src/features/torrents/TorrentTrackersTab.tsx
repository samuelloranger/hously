import { useTranslation } from 'react-i18next';
import type { QbittorrentTorrentTracker } from '@hously/shared';

interface TorrentTrackersTabProps {
  isLoading: boolean;
  trackers: QbittorrentTorrentTracker[] | undefined;
  error?: string;
}

function trackerStatusLabel(status: number | null, t: (key: string, fallback: string) => string) {
  switch (status) {
    case 0:
      return t('torrents.trackerStatusDisabled', 'Disabled');
    case 1:
      return t('torrents.trackerStatusNotContacted', 'Not contacted yet');
    case 2:
      return t('torrents.trackerStatusWorking', 'Working');
    case 3:
      return t('torrents.trackerStatusUpdating', 'Updating');
    case 4:
      return t('torrents.trackerStatusNotWorking', 'Not working');
    default:
      return t('torrents.trackerStatusUnknown', 'Unknown');
  }
}

function trackerStatusColor(status: number | null) {
  switch (status) {
    case 2:
      return 'text-emerald-600 dark:text-emerald-400';
    case 3:
      return 'text-sky-600 dark:text-sky-400';
    case 4:
      return 'text-red-500 dark:text-red-400';
    case 1:
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-neutral-400';
  }
}

function formatTrackerNumber(value: number | null) {
  return value == null ? '--' : value.toLocaleString();
}

export function TorrentTrackersTab({ isLoading, trackers, error }: TorrentTrackersTabProps) {
  const { t } = useTranslation('common');

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
            {t('common.loading', 'Loading...')}
          </div>
        ) : trackers?.length ? (
          trackers.map(tracker => (
            <div key={tracker.url} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all flex-1 min-w-0">
                  {tracker.url}
                </p>
                <span className={`shrink-0 text-xs font-medium ${trackerStatusColor(tracker.status)}`}>
                  {trackerStatusLabel(tracker.status, t)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {[
                  { label: t('torrents.trackerSeeds', 'Seeds'), value: formatTrackerNumber(tracker.seeds) },
                  { label: t('torrents.trackerPeers', 'Peers'), value: formatTrackerNumber(tracker.peers) },
                  { label: t('torrents.trackerLeeches', 'Leeches'), value: formatTrackerNumber(tracker.leeches) },
                  {
                    label: t('torrents.trackerDownloaded', 'Downloaded'),
                    value: formatTrackerNumber(tracker.downloaded),
                  },
                ].map(({ label, value }) => (
                  <span
                    key={label}
                    className="text-[11px] text-neutral-400 dark:text-neutral-400 font-mono tabular-nums"
                  >
                    {label}: <span className="text-neutral-600 dark:text-neutral-300">{value}</span>
                  </span>
                ))}
              </div>
              {tracker.message && (
                <p className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                  {tracker.message}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
            {error ?? t('dashboard.qbittorrent.noTrackers', 'No trackers found.')}
          </div>
        )}
      </div>
    </div>
  );
}
