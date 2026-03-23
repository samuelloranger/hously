import { Link } from '@tanstack/react-router';
import { PinOff, TrendingDown, TrendingUp, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatBytes, formatQbittorrentEta, formatSpeed, usePinnedQbittorrentTorrent, useSetPinnedQbittorrentTorrent } from '@hously/shared';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';

export function PinnedTorrentCard() {
  const { t } = useTranslation('common');
  const { data } = usePinnedQbittorrentTorrent({ refetchInterval: 5_000 });
  const setPinnedTorrent = useSetPinnedQbittorrentTorrent();

  const torrent = data?.torrent ?? null;
  const hash = torrent?.id ?? data?.pinned_hash ?? '';
  const prefetchIntent = usePrefetchIntent(hash ? '/torrents/$hash' : '/torrents', hash ? { hash } : undefined);

  if (!data?.pinned_hash || !torrent) {
    return null;
  }

  const progress = Math.round(torrent.progress * 100);
  const eta = formatQbittorrentEta(torrent.eta_seconds);

  return (
    <Link
      to="/torrents/$hash"
      params={{ hash: torrent.id }}
      {...prefetchIntent}
      className="block rounded-3xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
    >
      <section className="relative overflow-hidden rounded-3xl border border-sky-300/60 dark:border-sky-500/30 bg-gradient-to-br from-[#e0f2fe] via-[#93c5fd] to-[#0ea5e9] dark:from-sky-950/70 dark:via-sky-900/65 dark:to-cyan-900/60 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.22em] text-sky-950/70 dark:text-sky-200/90">
              {t('dashboard.qbittorrent.pinnedKicker')}
            </p>
            <h3 className="text-base md:text-lg font-bold text-sky-950 dark:text-sky-50">
              {t('dashboard.qbittorrent.pinnedTitle')}
            </h3>
            <p className="mt-1 text-[10px] text-sky-900/75 dark:text-sky-100/85 truncate">{torrent.name}</p>
          </div>
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              event.stopPropagation();
              setPinnedTorrent.mutate({ hash: null });
            }}
            disabled={setPinnedTorrent.isPending}
            aria-label={t('dashboard.qbittorrent.unpinTorrent')}
            title={t('dashboard.qbittorrent.unpinTorrent')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-950/15 dark:border-white/20 bg-black/10 dark:bg-white/10 text-sky-950 dark:text-sky-50 hover:bg-black/20 dark:hover:bg-white/20 disabled:opacity-50"
          >
            <PinOff size={14} />
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-sky-950/70 dark:text-sky-200/80">
              {t('torrents.progress')}
            </span>
            <span className="font-mono text-xs font-semibold text-sky-950 dark:text-sky-50">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sky-100/70 dark:bg-sky-950/45">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-black/10 p-3 dark:bg-black/20">
            <p className="text-[11px] text-sky-950/70 dark:text-sky-200/80">{t('torrents.size')}</p>
            <p className="text-xs font-semibold text-sky-950 dark:text-white">{formatBytes(torrent.size_bytes)}</p>
          </div>
          <div className="rounded-xl bg-black/10 p-3 dark:bg-black/20">
            <p className="text-[11px] text-sky-950/70 dark:text-sky-200/80">{t('torrents.eta')}</p>
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 dark:text-white">
              <Clock size={11} />
              {eta}
            </p>
          </div>
          <div className="rounded-xl bg-black/10 p-3 dark:bg-black/20">
            <p className="text-[11px] text-sky-950/70 dark:text-sky-200/80">{t('torrents.download')}</p>
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 dark:text-white">
              <TrendingDown size={11} />
              {formatSpeed(torrent.download_speed)}
            </p>
          </div>
          <div className="rounded-xl bg-black/10 p-3 dark:bg-black/20">
            <p className="text-[11px] text-sky-950/70 dark:text-sky-200/80">{t('torrents.upload')}</p>
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-sky-950 dark:text-white">
              <TrendingUp size={11} />
              {formatSpeed(torrent.upload_speed)}
            </p>
          </div>
        </div>
      </section>
    </Link>
  );
}
