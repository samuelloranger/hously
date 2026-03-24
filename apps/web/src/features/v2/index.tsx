import { useMemo, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  useChores,
  useHabits,
  useDashboardStats,
  useDashboardQbittorrentStatus,
  usePinnedQbittorrentTorrent,
  useDashboardActivities,
  useDashboardNetdataSummary,
  useDashboardScrutinySummary,
  useDashboardAdguardSummary,
  formatSpeed,
  getQbittorrentProgressBarGradient,
} from '@hously/shared';
import { useAuth } from '@/hooks/useAuth';
import { PageLayout } from '@/components/PageLayout';
import {
  CheckSquare2,
  ShoppingCart,
  CalendarDays,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Download,
  Server,
  Activity as ActivityIcon,
  Flame,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── Section header ───────────────────────────────────────────────────────────

function SectionLabel({
  icon,
  label,
  count,
  href,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-1.5 group/label">
      <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-semibold tabular-nums text-neutral-400 dark:text-neutral-500">
          · {count}
        </span>
      )}
      {href && (
        <ChevronRight
          size={10}
          className="text-neutral-300 dark:text-neutral-600 group-hover/label:text-indigo-400 transition-colors"
        />
      )}
    </div>
  );

  return href ? (
    <Link to={href as any} className="inline-flex">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

// ─── System row ───────────────────────────────────────────────────────────────

function SystemRow({
  label,
  value,
  secondary,
  status,
}: {
  label: string;
  value: string;
  secondary?: string;
  status: 'ok' | 'warn' | 'error';
}) {
  const dot =
    status === 'ok'
      ? 'bg-emerald-400'
      : status === 'warn'
        ? 'bg-amber-400'
        : 'bg-rose-400';

  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-xs text-neutral-500 dark:text-neutral-400 w-14 shrink-0">{label}</span>
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{value}</span>
      {secondary && (
        <span className="text-[11px] text-neutral-400 dark:text-neutral-500 ml-auto">{secondary}</span>
      )}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-t border-neutral-100 dark:border-neutral-800/80" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function V2Page() {
  const { i18n } = useTranslation('common');
  const { user } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const statsQuery = useDashboardStats();
  const choresQuery = useChores();
  const habitsQuery = useHabits(today);
  const qbtQuery = useDashboardQbittorrentStatus();
  const pinnedQuery = usePinnedQbittorrentTorrent({ refetchInterval: 10_000 });
  const activitiesQuery = useDashboardActivities(8);
  const netdataQuery = useDashboardNetdataSummary();
  const scrutinyQuery = useDashboardScrutinySummary();
  const adguardQuery = useDashboardAdguardSummary();

  const stats = statsQuery.data?.stats;
  const pendingChores = useMemo(
    () => (choresQuery.data?.chores ?? []).filter(c => !c.completed),
    [choresQuery.data]
  );
  const habits = habitsQuery.data?.habits ?? [];
  const qbt = qbtQuery.data;
  const pinnedTorrent = pinnedQuery.data?.torrent;
  const activities = activitiesQuery.data?.activities ?? [];
  const netdata = netdataQuery.data;
  const scrutiny = scrutinyQuery.data;
  const adguard = adguardQuery.data;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.first_name ?? user?.email?.split('@')[0] ?? '';

  const dateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const hasSystem =
    (netdata?.connected && netdata.summary) ||
    scrutiny?.connected ||
    adguard?.connected;

  const qbtEnabled = qbt?.enabled && qbt?.connected;

  return (
    <PageLayout>
      {/* ── Header ── */}
      <div className="mb-10 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500 mb-1.5">
          {dateLabel}
        </p>
        <h1 className="text-[1.75rem] font-light tracking-tight text-neutral-900 dark:text-neutral-50 leading-none">
          {greeting}
          {firstName ? (
            <>
              ,{' '}
              <span className="text-neutral-500 dark:text-neutral-400">{firstName}</span>
            </>
          ) : null}
        </h1>

        {stats && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-400 dark:text-neutral-500">
            {stats.chores_count > 0 && (
              <Link
                to="/chores"
                className="flex items-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <CheckSquare2 size={13} />
                {stats.chores_count} chore{stats.chores_count !== 1 ? 's' : ''}
              </Link>
            )}
            {stats.events_today > 0 && (
              <Link
                to="/calendar"
                className="flex items-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <CalendarDays size={13} />
                {stats.events_today} event{stats.events_today !== 1 ? 's' : ''} today
              </Link>
            )}
            {stats.shopping_count > 0 && (
              <Link
                to="/shopping"
                className="flex items-center gap-1.5 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <ShoppingCart size={13} />
                {stats.shopping_count} item{stats.shopping_count !== 1 ? 's' : ''} to buy
              </Link>
            )}
            {stats.habits_streak > 0 && (
              <span className="flex items-center gap-1.5">
                <Flame size={13} className="text-orange-400" />
                {stats.habits_streak}d streak
              </span>
            )}
          </p>
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-12 gap-y-8">

        {/* Left: 2/3 */}
        <div className="lg:col-span-2 space-y-7">

          {/* CHORES */}
          {pendingChores.length > 0 && (
            <section>
              <SectionLabel
                icon={<CheckSquare2 size={11} />}
                label="Chores"
                count={pendingChores.length}
                href="/chores"
              />
              <div className="mt-3 space-y-0.5">
                {pendingChores.slice(0, 6).map(chore => (
                  <div key={chore.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-3.5 h-3.5 rounded-sm border border-neutral-300 dark:border-neutral-600 shrink-0" />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                      {chore.chore_name}
                    </span>
                    {chore.assigned_to != null && chore.description && (
                      <span className="ml-auto text-[11px] text-neutral-400 truncate max-w-[160px]">
                        {chore.description}
                      </span>
                    )}
                  </div>
                ))}
                {pendingChores.length > 6 && (
                  <Link
                    to="/chores"
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 pt-1 transition-colors"
                  >
                    +{pendingChores.length - 6} more
                    <ChevronRight size={11} />
                  </Link>
                )}
              </div>
            </section>
          )}

          {pendingChores.length > 0 && habits.length > 0 && <Divider />}

          {/* HABITS */}
          {habits.length > 0 && (
            <section>
              <SectionLabel icon={<Flame size={11} />} label="Habits today" href="/habits" />
              <div className="mt-3 space-y-2.5">
                {habits.map(habit => {
                  const total = habit.times_per_day;
                  const done = habit.today_completions;
                  const allDone = done >= total;
                  return (
                    <div key={habit.id} className="flex items-center gap-3">
                      <span className="text-sm leading-none">{habit.emoji}</span>
                      <span
                        className={`flex-1 text-sm truncate ${
                          allDone
                            ? 'line-through text-neutral-400 dark:text-neutral-600'
                            : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {habit.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
                          <span
                            key={i}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i < done
                                ? 'bg-indigo-500 dark:bg-indigo-400'
                                : 'bg-neutral-200 dark:bg-neutral-700'
                            }`}
                          />
                        ))}
                      </div>
                      {habit.current_streak > 1 && (
                        <span className="text-[11px] tabular-nums text-orange-400">{habit.current_streak}d</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* DOWNLOADS */}
          {qbtEnabled && (
            <>
              {(pendingChores.length > 0 || habits.length > 0) && <Divider />}
              <section>
                <SectionLabel icon={<Download size={11} />} label="Downloads" href="/torrents" />
                <div className="mt-3">
                  {/* Speed row */}
                  <div className="flex items-center gap-5 mb-4">
                    <span className="flex items-center gap-1.5 font-mono text-sm text-sky-600 dark:text-sky-400 tabular-nums">
                      <ArrowDown size={12} />
                      {formatSpeed(qbt!.summary.download_speed)}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                      <ArrowUp size={12} />
                      {formatSpeed(qbt!.summary.upload_speed)}
                    </span>
                    <span className="ml-auto text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                      {[
                        qbt!.summary.downloading_count > 0 &&
                          `${qbt!.summary.downloading_count} dl`,
                        qbt!.summary.seeding_count > 0 &&
                          `${qbt!.summary.seeding_count} seed`,
                        qbt!.summary.paused_count > 0 &&
                          `${qbt!.summary.paused_count} paused`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>

                  {/* Active torrents from summary */}
                  {qbt!.torrents.slice(0, 4).map(torrent => {
                    const pct = Math.round(torrent.progress * 100);
                    const barClass = getQbittorrentProgressBarGradient(torrent.state);
                    return (
                      <Link
                        key={torrent.id}
                        to="/torrents/$hash"
                        params={{ hash: torrent.id }}
                        className="block group mb-3 last:mb-0"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-[80%] group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                            {torrent.name}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-0.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </Link>
                    );
                  })}

                  {/* Pinned torrent (if not already shown above) */}
                  {pinnedTorrent &&
                    !qbt!.torrents.slice(0, 4).find(t => t.id === pinnedTorrent.id) && (
                      <Link
                        to="/torrents/$hash"
                        params={{ hash: pinnedTorrent.id }}
                        className="block group mt-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-[80%] group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                            {pinnedTorrent.name}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                            {Math.round(pinnedTorrent.progress * 100)}%
                          </span>
                        </div>
                        <div className="h-0.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getQbittorrentProgressBarGradient(pinnedTorrent.state)}`}
                            style={{ width: `${Math.max(2, Math.round(pinnedTorrent.progress * 100))}%` }}
                          />
                        </div>
                      </Link>
                    )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Right: 1/3 */}
        <div className="space-y-7">

          {/* SYSTEM */}
          {hasSystem && (
            <section>
              <SectionLabel icon={<Server size={11} />} label="System" />
              <div className="mt-3 space-y-2.5">
                {netdata?.connected && netdata.summary && (
                  <>
                    {netdata.summary.cpu_percent != null && (
                      <SystemRow
                        label="CPU"
                        value={`${netdata.summary.cpu_percent.toFixed(0)}%`}
                        secondary={
                          netdata.summary.load_1 != null
                            ? `load ${netdata.summary.load_1.toFixed(2)}`
                            : undefined
                        }
                        status={netdata.summary.cpu_percent > 85 ? 'warn' : 'ok'}
                      />
                    )}
                    {netdata.summary.ram_used_percent != null && (
                      <SystemRow
                        label="RAM"
                        value={`${netdata.summary.ram_used_percent.toFixed(0)}%`}
                        secondary={
                          netdata.summary.ram_used_mib != null &&
                          netdata.summary.ram_total_mib != null
                            ? `${(netdata.summary.ram_used_mib / 1024).toFixed(1)} / ${(netdata.summary.ram_total_mib / 1024).toFixed(1)} GB`
                            : undefined
                        }
                        status={netdata.summary.ram_used_percent > 90 ? 'warn' : 'ok'}
                      />
                    )}
                  </>
                )}
                {scrutiny?.connected && (
                  <SystemRow
                    label="Drives"
                    value={`${scrutiny.summary.healthy_drives}/${scrutiny.summary.total_drives} OK`}
                    secondary={
                      scrutiny.summary.avg_temp_c != null
                        ? `${scrutiny.summary.avg_temp_c.toFixed(0)}°C`
                        : undefined
                    }
                    status={scrutiny.summary.warning_drives > 0 ? 'warn' : 'ok'}
                  />
                )}
                {adguard?.connected && adguard.summary && (
                  <SystemRow
                    label="Adguard"
                    value={
                      adguard.summary.blocked_ratio != null
                        ? `${(adguard.summary.blocked_ratio * 100).toFixed(1)}% blocked`
                        : 'Active'
                    }
                    secondary={`${adguard.summary.dns_queries.toLocaleString()} queries`}
                    status={adguard.protection_enabled ? 'ok' : 'warn'}
                  />
                )}
              </div>
            </section>
          )}

          {hasSystem && activities.length > 0 && <Divider />}

          {/* ACTIVITY */}
          {activities.length > 0 && (
            <section>
              <SectionLabel icon={<ActivityIcon size={11} />} label="Recent" href="/activity" />
              <div className="mt-3 space-y-3">
                {activities.slice(0, 7).map((activity, i) => (
                  <div key={activity.id ?? i} className="flex items-start gap-2.5">
                    {activity.icon && (
                      <span className="text-sm leading-none mt-px shrink-0">{activity.icon}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-snug line-clamp-2">
                        {activity.description ?? activity.message ?? activity.job_name ?? activity.type}
                      </p>
                      {activity.time && (
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {activity.time}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
