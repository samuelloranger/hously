import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  usePauseQbittorrentTorrent,
  useReannounceQbittorrentTorrent,
  useResumeQbittorrentTorrent,
} from '@/hooks/useDashboard';
import {
  formatBytes,
  formatQbittorrentEta,
  formatSpeed,
  getQbittorrentProgressBarGradient,
  getQbittorrentStatusDot,
  hasQbittorrentTransferActivity,
  isQbittorrentPausedState,
  type QbittorrentTorrentListItem,
} from '@hously/shared';
import { Tag, Clock, Play, Pause, RefreshCw, Pin, PinOff, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared';

export function TorrentRow({
  torrent,
  isPinned,
  onTogglePin,
  isPinPending,
}: {
  torrent: QbittorrentTorrentListItem;
  isPinned: boolean;
  onTogglePin: (hash: string, nextPinned: boolean) => void;
  isPinPending: boolean;
}) {
  const { i18n, t } = useTranslation('common');
  const locale = resolveDateFnsLocale(i18n.language);
  const { dot, pulse } = getQbittorrentStatusDot(torrent.state);
  const progress = Math.round(torrent.progress * 100);
  const isActive = hasQbittorrentTransferActivity(torrent);
  const isSeedingState = /^(uploading|forcedup|stalledup)$/i.test(torrent.state);
  const isUploading = torrent.upload_speed > 0 && isSeedingState;
  const eta = formatQbittorrentEta(torrent.eta_seconds);
  const relDate = formatRelativeTime(torrent.added_on, { addSuffix: true, locale }) ?? '';
  const barGradient = getQbittorrentProgressBarGradient(torrent.state);
  const barFillClass = isSeedingState
    ? 'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400'
    : barGradient;
  const barTrackClass = isSeedingState
    ? 'bg-emerald-100/80 dark:bg-emerald-950/40'
    : 'bg-neutral-100 dark:bg-neutral-800';
  const isPaused = isQbittorrentPausedState(torrent.state);

  const pauseMutation = usePauseQbittorrentTorrent(torrent.id);
  const resumeMutation = useResumeQbittorrentTorrent(torrent.id);
  const reannounceMutation = useReannounceQbittorrentTorrent(torrent.id);
  const isActionPending = pauseMutation.isPending || resumeMutation.isPending || reannounceMutation.isPending;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isActionPending) return;
    if (isPaused) {
      resumeMutation.mutate(undefined);
    } else {
      pauseMutation.mutate(undefined);
    }
    setDropdownOpen(false);
  };

  const handleReannounce = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isActionPending) return;
    reannounceMutation.mutate(undefined);
    setDropdownOpen(false);
  };

  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTogglePin(torrent.id, !isPinned);
    setDropdownOpen(false);
  };

  const actionButtons = (
    <>
      <button
        onClick={handleTogglePin}
        disabled={isPinPending}
        title={isPinned ? t('torrents.unpin', 'Unpin from home') : t('torrents.pin', 'Pin to home')}
        aria-label={isPinned ? t('torrents.unpin', 'Unpin from home') : t('torrents.pin', 'Pin to home')}
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
      >
        {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>
      <button
        onClick={handleReannounce}
        disabled={isActionPending}
        title={t('torrents.reannounce', 'Reannounce')}
        aria-label={t('torrents.reannounce', 'Reannounce')}
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
      >
        {reannounceMutation.isPending ? (
          <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
        ) : (
          <RefreshCw size={11} />
        )}
      </button>
      <button
        onClick={handleToggle}
        disabled={isActionPending}
        title={isPaused ? t('torrents.start', 'Resume') : t('torrents.pause', 'Pause')}
        aria-label={isPaused ? t('torrents.start', 'Resume') : t('torrents.pause', 'Pause')}
        className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:pointer-events-none disabled:opacity-30"
      >
        {pauseMutation.isPending || resumeMutation.isPending ? (
          <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
        ) : isPaused ? (
          <Play size={11} />
        ) : (
          <Pause size={11} />
        )}
      </button>
    </>
  );

  return (
    <Link
      to="/torrents/$hash"
      params={{ hash: torrent.id }}
      className="block px-4 sm:px-5 hover:bg-neutral-50 dark:hover:bg-white/[0.06] transition-colors group"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '132px' }}
    >
      <div className="flex items-start gap-3 py-4">
        {/* Status dot */}
        <div className="pt-1 shrink-0">
          <span className={`block w-2 h-2 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {torrent.name}
            </p>

            {/* Right: size + quick action */}
            <div className="shrink-0 flex items-center gap-2">
              {/* Desktop: inline buttons on hover */}
              <div className="hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 items-center gap-1 transition-opacity">
                {actionButtons}
              </div>

              {/* Mobile: three-dot dropdown */}
              <div
                ref={dropdownRef}
                className="relative sm:hidden"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropdownOpen(v => !v);
                  }}
                  disabled={isActionPending}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 disabled:opacity-30"
                  aria-label={t('common.actions', 'Actions')}
                >
                  {isActionPending ? (
                    <span className="block w-3 h-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin" />
                  ) : (
                    <MoreHorizontal size={12} />
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1 overflow-hidden">
                    <button
                      onClick={handleTogglePin}
                      disabled={isPinPending}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                    >
                      {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                      {isPinned ? t('torrents.unpin', 'Unpin from home') : t('torrents.pin', 'Pin to home')}
                    </button>
                    <button
                      onClick={handleReannounce}
                      disabled={isActionPending}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw size={13} />
                      {t('torrents.reannounce', 'Reannounce')}
                    </button>
                    <button
                      onClick={handleToggle}
                      disabled={isActionPending}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                    >
                      {isPaused ? <Play size={13} /> : <Pause size={13} />}
                      {isPaused ? t('torrents.start', 'Resume') : t('torrents.pause', 'Pause')}
                    </button>
                  </div>
                )}
              </div>

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
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Progress bar */}
          <div className={`mt-2 h-1 w-full rounded-full overflow-hidden ${barTrackClass}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${barFillClass} ${isUploading ? 'torrent-progress-bar-active' : ''}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap mt-1.5">
            <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
              {progress}%
            </span>
            {isActive && eta !== '∞' && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400 dark:text-neutral-400 tabular-nums">
                <Clock size={10} />
                {eta}
              </span>
            )}
            {torrent.ratio != null && (
              <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-400 tabular-nums">
                {t('torrents.shareRatio', 'Ratio')}: {torrent.ratio.toFixed(2)}
              </span>
            )}
            {isActive && (
              <>
                <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">
                  ↓ {formatSpeed(torrent.download_speed)}
                </span>
                <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ↑ {formatSpeed(torrent.upload_speed)}
                </span>
              </>
            )}
            {relDate && (
              <span className="ml-auto font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                {relDate}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
