import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useChores } from "@/pages/chores/useChores";
import { useHabits } from "@/pages/habits/useHabits";
import { CheckCircle, ChevronRight, ListChecks, Target } from "lucide-react";

// ─── Progress ring ──────────────────────────────────────────────────────────

function ProgressRing({
  done,
  total,
  size = 34,
  stroke = 3.5,
  trackClass = "text-neutral-700",
  ringClass = "text-primary-400",
}: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  trackClass?: string;
  ringClass?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={`stroke-current ${trackClass}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`stroke-current transition-all duration-700 ${ringClass}`}
        />
      </svg>
      <span className="absolute font-display text-[11px] font-semibold tabular-nums text-neutral-100">
        {done}
      </span>
    </span>
  );
}

// ─── Chores panel ─────────────────────────────────────────────────────────────

function ChoreRow({
  name,
  description,
}: {
  name: string;
  description?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-neutral-800 last:border-0">
      <span className="w-4 h-4 rounded border-2 border-neutral-600 shrink-0" />
      <span className="flex-1 text-sm font-medium text-neutral-200 truncate">
        {name}
      </span>
      {description && (
        <span className="text-xs text-neutral-400 truncate max-w-[140px]">
          {description}
        </span>
      )}
    </div>
  );
}

export function ChoresPanel() {
  const { t } = useTranslation("common");
  const { data, isLoading } = useChores();
  const allChores = useMemo(() => data?.chores ?? [], [data]);
  const pendingChores = useMemo(
    () => allChores.filter((c) => !c.completed),
    [allChores],
  );
  const total = allChores.length;
  const completed = total - pendingChores.length;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex min-w-0 items-center gap-3">
          {total > 0 ? (
            <ProgressRing done={completed} total={total} />
          ) : (
            <ListChecks
              className="w-4 h-4 shrink-0 text-neutral-400"
              strokeWidth={2}
            />
          )}
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              <ListChecks
                className="w-4 h-4 shrink-0 text-neutral-400"
                strokeWidth={2}
              />
              {t("nav.chores")}
            </h3>
            {pendingChores.length > 0 && (
              <span className="text-xs font-normal text-neutral-400">
                {t("dashboard.home.choresPending", {
                  count: pendingChores.length,
                })}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/chores"
          className="flex items-center gap-0.5 text-xs font-medium text-neutral-400 hover:text-primary-400 transition-colors"
        >
          {t("dashboard.view")}
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="px-4 py-1">
        {isLoading ? (
          <div className="space-y-2 py-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-5 rounded bg-neutral-800 animate-pulse"
              />
            ))}
          </div>
        ) : pendingChores.length === 0 ? (
          <div className="row-complete-flash flex flex-col items-center gap-2 py-7 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-emerald-400">
              <CheckCircle size={18} />
            </span>
            <p className="text-sm font-medium text-neutral-400">
              {t("dashboard.home.choresAllCaughtUp")}
            </p>
          </div>
        ) : (
          <>
            {pendingChores.slice(0, 7).map((chore) => (
              <ChoreRow
                key={chore.id}
                name={chore.chore_name}
                description={chore.description}
              />
            ))}
            {pendingChores.length > 7 && (
              <Link
                to="/chores"
                className="block py-2 text-xs font-medium text-neutral-400 hover:text-primary-400 transition-colors"
              >
                {t("dashboard.home.choresMore", {
                  count: pendingChores.length - 7,
                  label: t("dashboard.pendingChores").toLowerCase(),
                })}
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
  const { t } = useTranslation("common");
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data, isLoading } = useHabits(today);
  const habits = data?.habits ?? [];

  if (!isLoading && habits.length === 0) return null;

  const doneCount = habits.filter(
    (h) => h.today_completions >= h.times_per_day,
  ).length;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex min-w-0 items-center gap-3">
          {habits.length > 0 ? (
            <ProgressRing done={doneCount} total={habits.length} />
          ) : (
            <Target
              className="w-4 h-4 shrink-0 text-neutral-400"
              strokeWidth={2}
            />
          )}
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
              <Target
                className="w-4 h-4 shrink-0 text-neutral-400"
                strokeWidth={2}
              />
              {t("dashboard.home.habitsToday")}
            </h3>
            {habits.length > 0 && (
              <span className="font-display text-xs font-normal tabular-nums text-neutral-400">
                {doneCount}/{habits.length}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/habits"
          className="flex items-center gap-0.5 text-xs font-medium text-neutral-400 hover:text-primary-400 transition-colors"
        >
          {t("dashboard.view")}
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="px-4 py-1">
        {isLoading ? (
          <div className="space-y-2 py-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-6 rounded bg-neutral-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          habits.map((habit) => {
            const total = habit.times_per_day;
            const done = habit.today_completions;
            const allDone = done >= total;
            return (
              <div
                key={habit.id}
                className={`flex items-center gap-3 py-2.5 border-b border-neutral-800 last:border-0 ${
                  allDone ? "row-complete-flash" : ""
                }`}
              >
                <span className="text-base leading-none shrink-0">
                  {habit.emoji}
                </span>
                <span
                  className={`flex-1 text-sm font-medium truncate ${
                    allDone
                      ? "line-through text-neutral-600"
                      : "text-neutral-200"
                  }`}
                >
                  {habit.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i < done ? "bg-primary-400" : "bg-neutral-700"
                      }`}
                    />
                  ))}
                </div>
                {habit.current_streak > 1 && (
                  <span className="font-display text-xs font-semibold tabular-nums text-primary-400">
                    {t("dashboard.home.streakDays", {
                      count: habit.current_streak,
                    })}
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
