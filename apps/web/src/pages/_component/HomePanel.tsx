import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useChores } from "@/pages/chores/useChores";
import { useHabits } from "@/pages/habits/useHabits";
import { CheckCircle, ChevronRight, ListChecks, Target } from "lucide-react";

// ─── Chores panel ─────────────────────────────────────────────────────────────

function ChoreRow({
  name,
  description,
}: {
  name: string;
  description?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="w-4 h-4 rounded border-2 border-zinc-300 dark:border-zinc-600 shrink-0" />
      <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
        {name}
      </span>
      {description && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">
          {description}
        </span>
      )}
    </div>
  );
}

export function ChoresPanel() {
  const { t } = useTranslation("common");
  const { data, isLoading } = useChores();
  const pendingChores = useMemo(
    () => (data?.chores ?? []).filter((c) => !c.completed),
    [data],
  );

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
          <ListChecks
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {t("nav.chores")}
            {pendingChores.length > 0 && (
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {t("dashboard.home.choresPending", {
                  count: pendingChores.length,
                })}
              </span>
            )}
          </h3>
        </div>
        <Link
          to="/chores"
          className="flex items-center gap-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
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
                className="h-5 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : pendingChores.length === 0 ? (
          <div className="py-6 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <CheckCircle size={14} className="text-green-500" />
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
                className="block py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
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
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-orange-500 shrink-0" />
          <Target
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {t("dashboard.home.habitsToday")}
            {habits.length > 0 && (
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {doneCount}/{habits.length}
              </span>
            )}
          </h3>
        </div>
        <Link
          to="/habits"
          className="flex items-center gap-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
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
                className="h-6 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"
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
                className="flex items-center gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
              >
                <span className="text-base leading-none shrink-0">
                  {habit.emoji}
                </span>
                <span
                  className={`flex-1 text-sm font-medium truncate ${
                    allDone
                      ? "line-through text-zinc-400 dark:text-zinc-600"
                      : "text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {habit.name}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i < done
                          ? "bg-orange-500 dark:bg-orange-400"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
                {habit.current_streak > 1 && (
                  <span className="text-xs font-mono font-semibold tabular-nums text-orange-500">
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
