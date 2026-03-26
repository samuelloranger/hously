import { Link } from '@tanstack/react-router';
import { Pin, PinOff, ArrowDown, ArrowUp, Zap, Clock } from 'lucide-react';
import {
  type DashboardQbittorrentStatusResponse,
  DASHBOARD_ENDPOINTS,
  formatSpeed,
  formatBytes,
  formatQbittorrentEta,
  getQbittorrentProgressBarGradient,
  useDashboardQbittorrentStatus,
  usePinnedQbittorrentTorrent,
  useSetPinnedQbittorrentTorrent,
  useConversionJobs,
  useCancelMediaConversion,
  type MediaConversionJob,
} from '@hously/shared';
import { useEventSourceState } from '@/hooks/useEventSourceState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

function MonoValue({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${className}`}>{children}</span>
  );
}

function BarTrack({ pct, stateClass }: { pct: number; stateClass: string }) {
  return (
    <div className="h-[3px] w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${stateClass}`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

// ─── Conversion row ───────────────────────────────────────────────────────────

function ConversionRow({ job }: { job: MediaConversionJob }) {
  const cancel = useCancelMediaConversion();
  const pct = Math.round(job.progress ?? 0);
  const isRunning = job.status === 'running';

  return (
    <div className="py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0 group">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Zap
            size={11}
            className={`shrink-0 ${isRunning ? 'text-indigo-500 animate-pulse' : 'text-amber-500'}`}
          />
          <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
            {job.source_title ?? job.output_path?.split('/').pop() ?? 'Converting…'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {job.speed && (
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 italic">
              {job.speed}
            </span>
          )}
          <MonoValue className="text-indigo-500 dark:text-indigo-400 text-[11px]">
            {pct}%
          </MonoValue>
          <button
            type="button"
            onClick={() => cancel.mutate(job.id)}
            disabled={cancel.isPending}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-rose-500 disabled:opacity-40"
            title="Cancel conversion"
          >
            ×
          </button>
        </div>
      </div>
      <BarTrack
        pct={pct}
        stateClass={isRunning ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-amber-400'}
      />
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function DownloadsPanel() {
  const { data: fallbackData, isLoading } = useDashboardQbittorrentStatus();
  const { data, streamConnected } = useEventSourceState<DashboardQbittorrentStatusResponse>({
    url: DASHBOARD_ENDPOINTS.QBITTORRENT.STREAM,
    initialData: fallbackData,
    treatInitialDataAsConnected: Boolean(fallbackData?.connected),
    onParseError: err => console.error('qbt stream parse error', err),
  });
  const pinnedQuery = usePinnedQbittorrentTorrent({ refetchInterval: 5_000 });
  const setPinned = useSetPinnedQbittorrentTorrent();
  const conversionJobs = useConversionJobs();

  const torrent = pinnedQuery.data?.torrent ?? null;
  const pinnedHash = pinnedQuery.data?.pinned_hash ?? null;

  const enabled = data?.enabled;
  const connected = data?.connected;
  const summary = data?.summary;
  const torrents = data?.torrents ?? [];

  // Deduplicate: don't show pinned torrent in active list
  const activeTorrents = pinnedHash
    ? torrents.slice(0, 5).filter(t => t.id !== pinnedHash)
    : torrents.slice(0, 5);

  const hasAny = enabled && (connected || isLoading);

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-sky-500 shrink-0" />
          <Label>Downloads</Label>
        </div>
        {enabled && connected && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-sky-500">
              <ArrowDown size={10} />
              {formatSpeed(summary?.download_speed ?? 0)}
            </span>
            <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-emerald-500">
              <ArrowUp size={10} />
              {formatSpeed(summary?.upload_speed ?? 0)}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono tabular-nums">
              {[
                summary?.downloading_count ? `${summary.downloading_count} dl` : null,
                summary?.seeding_count ? `${summary.seeding_count} seed` : null,
                summary?.stalled_count ? `${summary.stalled_count} stalled` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span
              className={`text-[9px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                streamConnected
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
              }`}
            >
              {streamConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-2">
        {/* Not connected */}
        {!enabled && !isLoading && (
          <p className="py-4 text-xs text-zinc-400 dark:text-zinc-500 text-center">
            qBittorrent not configured
          </p>
        )}

        {/* Pinned torrent */}
        {torrent && (
          <div className="py-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <Pin size={11} className="shrink-0 text-amber-500" />
                <Link
                  to="/torrents/$hash"
                  params={{ hash: torrent.id }}
                  className="text-xs text-zinc-700 dark:text-zinc-300 truncate hover:text-sky-500 transition-colors"
                >
                  {torrent.name}
                </Link>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 font-mono text-[10px] text-sky-500 tabular-nums">
                  <ArrowDown size={9} />
                  {formatSpeed(torrent.download_speed)}
                </span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {Math.round(torrent.progress * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPinned.mutate({ hash: null })}
                  disabled={setPinned.isPending}
                  className="text-zinc-300 dark:text-zinc-600 hover:text-rose-400 transition-colors disabled:opacity-40"
                  title="Unpin"
                >
                  <PinOff size={11} />
                </button>
              </div>
            </div>
            <BarTrack
              pct={Math.round(torrent.progress * 100)}
              stateClass="bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400"
            />
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                <Clock size={9} />
                {formatQbittorrentEta(torrent.eta_seconds)}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                {formatBytes(torrent.size_bytes)}
              </span>
            </div>
          </div>
        )}

        {/* Active torrents */}
        {hasAny &&
          activeTorrents.map(t => {
            const pct = Math.round(t.progress * 100);
            return (
              <Link
                key={t.id}
                to="/torrents/$hash"
                params={{ hash: t.id }}
                className="block py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0 group"
              >
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate group-hover:text-sky-500 transition-colors">
                    {t.name}
                  </span>
                  <MonoValue className="text-zinc-500 dark:text-zinc-400 text-[11px] shrink-0">
                    {pct}%
                  </MonoValue>
                </div>
                <BarTrack pct={pct} stateClass={getQbittorrentProgressBarGradient(t.state)} />
              </Link>
            );
          })}

        {/* Empty state when connected but no torrents */}
        {hasAny && !torrent && activeTorrents.length === 0 && !isLoading && (
          <p className="py-4 text-xs text-zinc-400 dark:text-zinc-500 text-center">No active downloads</p>
        )}

        {/* Conversions */}
        {conversionJobs.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-3 pb-1">
              <span className="w-1 h-3 rounded-full bg-indigo-500 shrink-0" />
              <Label>Conversions</Label>
            </div>
            {conversionJobs.map(job => (
              <ConversionRow key={job.id} job={job} />
            ))}
          </>
        )}
      </div>

      {/* Footer link */}
      {enabled && (
        <Link
          to="/torrents"
          className="block px-4 py-2 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-sky-500 transition-colors border-t border-zinc-100 dark:border-zinc-800 text-center"
        >
          View all torrents →
        </Link>
      )}
    </section>
  );
}
