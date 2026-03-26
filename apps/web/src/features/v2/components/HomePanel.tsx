import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  useChores,
  useHabits,
  useDashboardActivities,
} from '@hously/shared';
import { ChevronRight, Flame, Activity as ActivityIcon } from 'lucide-react';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

// ─── Chores panel ─────────────────────────────────────────────────────────────

function ChoreRow({ name, description }: { name: string; description?: string | null }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0">
      <span className="w-4 h-4 rounded border border-zinc-300 dark:border-zinc-600 shrink-0 flex items-center justify-center">
        <span className="w-2 h-2 rounded-sm" />
      </span>
      <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate">{name}</span>
      {description && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[140px]">
          {description}
        </span>
      )}
    </div>
  );
}

export function ChoresPanel() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useChores();
  const pendingChores = useMemo(
    () => (data?.chores ?? []).filter(c => !c.completed),
    [data]
  );

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
          <Label>Chores</Label>
          {pendingChores.length > 0 && (
            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
              · {pendingChores.length}
            </span>
          )}
        </div>
        <Link
          to="/chores"
          className="flex items-center gap-0.5 text-[10px] text-zinc-400 hover:text-emerald-500 transition-colors"
        >
          View all
          <ChevronRight size={10} />
        </Link>
      </div>

      <div className="px-4 py-1">
        {isLoading ? (
          <div className="space-y-2 py-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : pendingChores.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">✅ All caught up!</p>
          </div>
        ) : (
          <>
            {pendingChores.slice(0, 7).map(chore => (
              <ChoreRow
                key={chore.id}
                name={chore.chore_name}
                description={chore.description}
              />
            ))}
            {pendingChores.length > 7 && (
              <Link
                to="/chores"
                className="block py-2 text-[10px] text-zinc-400 hover:text-emerald-500 transition-colors"
              >
                +{pendingChores.length - 7} more {t('dashboard.pendingChores').toLowerCase()}
              </Link>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Habits panel ─────────────────────────────────────────────────────────────

export function HabitsPanel() {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const { data, isLoading } = useHabits(today);
  const habits = data?.habits ?? [];

  if (!isLoading && habits.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-orange-500 shrink-0" />
          <Label>Habits</Label>
        </div>
        <Link to="/habits" className="text-orange-400 hover:text-orange-500 transition-colors">
          <Flame size={12} />
        </Link>
      </div>

      <div className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-5 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : (
          habits.map(habit => {
            const total = habit.times_per_day;
            const done = habit.today_completions;
            const allDone = done >= total;
            return (
              <div key={habit.id} className="flex items-center gap-3 py-2 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0">
                <span className="text-base leading-none shrink-0">{habit.emoji}</span>
                <span
                  className={`flex-1 text-sm truncate ${
                    allDone
                      ? 'line-through text-zinc-400 dark:text-zinc-600'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {habit.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i < done
                          ? 'bg-orange-500 dark:bg-orange-400'
                          : 'bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
                {habit.current_streak > 1 && (
                  <span className="text-[10px] font-mono tabular-nums text-orange-500">
                    {habit.current_streak}d
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ─── Activity panel ───────────────────────────────────────────────────────────

export function ActivityPanel() {
  const { data, isLoading } = useDashboardActivities(8);
  const activities = data?.activities ?? [];

  if (!isLoading && activities.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
          <Label>Recent Activity</Label>
        </div>
        <Link
          to="/activity"
          search={{ service: '', type: '' }}
          className="flex items-center gap-0.5 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <ActivityIcon size={10} />
          <ChevronRight size={10} />
        </Link>
      </div>

      <div className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-4 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : (
          activities.slice(0, 7).map((a, i) => (
            <div key={a.id ?? i} className="flex items-start gap-2.5 py-2 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0">
              {a.icon && (
                <span className="text-sm leading-none mt-px shrink-0">{a.icon}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug line-clamp-2">
                  {a.description ?? a.message ?? a.job_name ?? a.type}
                </p>
                {a.time && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-mono tabular-nums">
                    {a.time}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
