import { Link } from '@tanstack/react-router';
import {
  usePauseQbittorrentTorrent,
  useResumeQbittorrentTorrent,
  type QbittorrentTorrentListItem,
} from '@hously/shared';
import { Tag, Clock, Play, Pause } from 'lucide-react';
import { formatBytes, formatSpeed, formatEta, formatRelativeDate, getStatusDot, getProgressBarGradient } from './utils';

export function TorrentRow({ torrent }: { torrent: QbittorrentTorrentListItem }) {
  const { dot, pulse } = getStatusDot(torrent.state);
  const progress = Math.round(torrent.progress * 100);
  const isActive = torrent.download_speed > 0 || torrent.upload_speed > 0;
  const eta = formatEta(torrent.eta_seconds);
  const relDate = formatRelativeDate(torrent.added_on);
  const barGradient = getProgressBarGradient(torrent.state);
  const isPaused = ['pauseddl', 'pausedup', 'stopped'].includes(torrent.state.toLowerCase());

  const pauseMutation = usePauseQbittorrentTorrent(torrent.id);
  const resumeMutation = useResumeQbittorrentTorrent(torrent.id);
  const isActionPending = pauseMutation.isPending || resumeMutation.isPending;

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isActionPending) return;
    if (isPaused) {
      resumeMutation.mutate(undefined);
    } else {
      pauseMutation.mutate(undefined);
    }
  };

  return (
    <Link
      to="/torrents/$hash"
      params={{ hash: torrent.id }}
      className="block px-5 py-4 hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors group"
    >
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className="pt-1 shrink-0">
          <span className={`block w-2 h-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {torrent.name}
            </p>

            {/* Right: size + quick action */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={handleToggle}
                disabled={isActionPending}
                title={isPaused ? 'Resume' : 'Pause'}
                className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
              >
                {isActionPending ? (
                  <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
                ) : isPaused ? (
                  <Play size={11} />
                ) : (
                  <Pause size={11} />
                )}
              </button>
              <span className="font-mono text-xs font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">
                {formatBytes(torrent.size_bytes)}
              </span>
            </div>
          </div>

          {/* Category + tags */}
          {(torrent.category || torrent.tags.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {torrent.category && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800">
                  <Tag size={9} />
                  {torrent.category}
                </span>
              )}
              {torrent.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-800/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Progress bar — color coded by state */}
          <div className="mt-2 h-1 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barGradient}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-500 tabular-nums">
              {progress}%
            </span>
            {isActive && eta !== '∞' && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                <Clock size={10} />
                {eta}
              </span>
            )}
            {torrent.ratio != null && (
              <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                R: {torrent.ratio.toFixed(2)}
              </span>
            )}
            {isActive && (
              <>
                <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">
                  ↓ {formatSpeed(torrent.download_speed)}
                </span>
                <span className="font-mono text-[11px] text-violet-600 dark:text-violet-400 tabular-nums">
                  ↑ {formatSpeed(torrent.upload_speed)}
                </span>
              </>
            )}
            {relDate && (
              <span className="ml-auto font-mono text-[11px] text-neutral-400 dark:text-neutral-600 tabular-nums">
                {relDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
