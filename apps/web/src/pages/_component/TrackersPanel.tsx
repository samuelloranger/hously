import { useDashboardC411Stats, useDashboardLaCaleStats, useDashboardTorr9Stats } from '@/hooks/usePlugins';
import { formatGo, formatRatio, formatRelativeTime, resolveDateFnsLocale } from '@hously/shared';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown } from 'lucide-react';

type TrackerInfo = {
  key: string;
  label: string;
  enabled: boolean;
  connected: boolean;
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  updated_at: string | null;
  error?: string;
};

function TrackerCol({
  tracker,
  locale,
}: {
  tracker: TrackerInfo;
  locale: Parameters<typeof formatRelativeTime>[1]['locale'];
}) {
  const { t } = useTranslation('common');
  const ratioNum = tracker.ratio ?? 0;
  const ratioColor =
    ratioNum >= 1.5
      ? 'text-emerald-600 dark:text-emerald-400'
      : ratioNum >= 1
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            !tracker.enabled ? 'bg-zinc-300 dark:bg-zinc-600' : tracker.connected ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tracker.label}</span>
      </div>

      {!tracker.enabled || !tracker.connected ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          {tracker.error ?? t('dashboard.home.trackerNotConnected')}
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">
            <ArrowDown size={10} />
            {formatGo(tracker.downloaded_go)}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            <ArrowUp size={10} />
            {formatGo(tracker.uploaded_go)}
          </div>
          <div className={`font-mono text-sm font-bold tabular-nums ${ratioColor}`}>×{formatRatio(tracker.ratio)}</div>
          {tracker.updated_at && (
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {formatRelativeTime(tracker.updated_at, { locale })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TrackersPanel() {
  const { t, i18n } = useTranslation('common');
  const locale = resolveDateFnsLocale(i18n.language);

  const c411 = useDashboardC411Stats();
  const torr9 = useDashboardTorr9Stats();
  const laCale = useDashboardLaCaleStats();

  const trackers: TrackerInfo[] = [
    {
      key: 'c411',
      label: t('dashboard.trackers.providers.c411'),
      enabled: Boolean(c411.data?.enabled),
      connected: Boolean(c411.data?.connected),
      uploaded_go: c411.data?.uploaded_go ?? null,
      downloaded_go: c411.data?.downloaded_go ?? null,
      ratio: c411.data?.ratio ?? null,
      updated_at: c411.data?.updated_at ?? null,
      error: c411.data?.error,
    },
    {
      key: 'torr9',
      label: t('dashboard.trackers.providers.torr9'),
      enabled: Boolean(torr9.data?.enabled),
      connected: Boolean(torr9.data?.connected),
      uploaded_go: torr9.data?.uploaded_go ?? null,
      downloaded_go: torr9.data?.downloaded_go ?? null,
      ratio: torr9.data?.ratio ?? null,
      updated_at: torr9.data?.updated_at ?? null,
      error: torr9.data?.error,
    },
    {
      key: 'la-cale',
      label: t('dashboard.trackers.providers.la-cale'),
      enabled: Boolean(laCale.data?.enabled),
      connected: Boolean(laCale.data?.connected),
      uploaded_go: laCale.data?.uploaded_go ?? null,
      downloaded_go: laCale.data?.downloaded_go ?? null,
      ratio: laCale.data?.ratio ?? null,
      updated_at: laCale.data?.updated_at ?? null,
      error: laCale.data?.error,
    },
  ];

  const anyEnabled = trackers.some(t => t.enabled);
  if (!anyEnabled) return null;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-1 h-4 rounded-full bg-purple-500 shrink-0" />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {t('dashboard.home.privateTrackersTitle')}
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-4 divide-x divide-zinc-100 dark:divide-zinc-800">
        {trackers.map((tr, i) => (
          <div key={tr.key} className={i > 0 ? 'pl-4' : ''}>
            <TrackerCol tracker={tr} locale={locale} />
          </div>
        ))}
      </div>
    </section>
  );
}
