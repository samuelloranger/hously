import { Elysia, t } from "elysia";
import { prisma } from "../../db";
import { auth } from "../../auth";
import {
  addJob,
  QUEUE_NAMES,
  SCHEDULED_JOB_NAMES,
} from "../../services/queueService";
import {
  addDaysInTz,
  formatDateInTimezone,
  getTimezone,
  midnightOf,
  todayLocal,
} from "../../utils/date";
import { requireUser } from "../../middleware/auth";
import { notFound, unauthorized, unprocessable } from "../../errors";

const DONE_STATUS = "done";
const SKIPPED_STATUS = "skipped";

const getTodayStatusCounts = (entries: Array<{ status: string }>) => {
  let doneCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    if (entry.status === DONE_STATUS) {
      doneCount++;
    } else if (entry.status === SKIPPED_STATUS) {
      skippedCount++;
    }
  }

  return {
    doneCount,
    skippedCount,
    accountedCount: doneCount + skippedCount,
  };
};

const buildHabitStatusResponse = (
  timesPerDay: number,
  doneCount: number,
  skippedCount: number,
) => ({
  completions: doneCount,
  skipped: skippedCount,
  remaining: Math.max(timesPerDay - doneCount - skippedCount, 0),
  accounted: Math.min(doneCount + skippedCount, timesPerDay),
});

const getScheduleTimes = (body: {
  schedules?: string[];
  schedule_times?: string[];
}) => body.schedules ?? body.schedule_times ?? [];

const getUserId = (user: { id: number } | null | undefined) => {
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user.id;
};

const getTodayDateKey = (date: Date) => formatDateInTimezone(date);

const getScheduleStatuses = (
  schedules: { id: number; time: string }[],
  completions: { completedAt: Date; status: string }[],
  _tz: string,
): { time: string; status: "done" | "skipped" | "pending" }[] => {
  const sorted = [...schedules].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return [];

  const statuses: { time: string; status: "done" | "skipped" | "pending" }[] =
    sorted.map((s) => ({
      time: s.time,
      status: "pending",
    }));

  // Assign completions to slots sequentially (first action → slot 1, second → slot 2, etc.)
  const sortedCompletions = [...completions].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  );

  for (
    let i = 0;
    i < Math.min(sortedCompletions.length, statuses.length);
    i++
  ) {
    statuses[i] = {
      time: sorted[i].time,
      status: sortedCompletions[i].status === DONE_STATUS ? "done" : "skipped",
    };
  }

  return statuses;
};

const getDayRange = (date = todayLocal()) => {
  const start = new Date(date.getTime());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

export const habitsRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .group("/api/habits", (app) =>
    app
      .post(
        "/live-activity/register",
        async ({ body, user }) => {
          const userId = getUserId(user);

          await prisma.liveActivityToken.upsert({
            where: { token: body.token },
            update: {
              userId,
              platform: body.platform || "ios",
              updatedAt: new Date(),
            },
            create: {
              userId,
              token: body.token,
              platform: body.platform || "ios",
            },
          });

          console.log(
            `[LiveActivity] Registered push-to-start token for user ${userId}`,
          );
          return { success: true };
        },
        {
          body: t.Object({
            token: t.String({ minLength: 1 }),
            platform: t.Optional(t.String()),
          }),
        },
      )
      .get("/", async ({ user, query: { date: queryDate } }) => {
        const userId = getUserId(user);
        const targetDay = queryDate ? midnightOf(queryDate) : todayLocal();
        const { start: startOfToday, end: startOfTomorrow } =
          getDayRange(targetDay);

        const habits = await prisma.habit.findMany({
          where: {
            userId,
            active: true,
          },
          include: {
            schedules: {
              select: {
                id: true,
                time: true,
              },
            },
            completions: {
              where: {
                completedAt: {
                  gte: startOfToday,
                  lt: startOfTomorrow,
                },
              },
            },
          },
        });

        const habitsWithStats = await Promise.all(
          habits.map(async (habit) => {
            const {
              doneCount: todayCompletions,
              skippedCount: todaySkips,
              accountedCount: todayAccounted,
            } = getTodayStatusCounts(habit.completions);

            const allCompletions = await prisma.habitCompletion.findMany({
              where: {
                habitId: habit.id,
                status: DONE_STATUS,
                completedAt: {
                  lt: startOfTomorrow,
                },
              },
              select: {
                completedAt: true,
              },
              orderBy: {
                completedAt: "desc",
              },
            });

            const completionsByDay = new Map<string, number>();

            for (const completion of allCompletions) {
              const dateKey = getTodayDateKey(completion.completedAt);
              completionsByDay.set(
                dateKey,
                (completionsByDay.get(dateKey) ?? 0) + 1,
              );
            }

            let currentStreak = 0;
            let checkDate = addDaysInTz(startOfToday, -1);

            while (
              (completionsByDay.get(getTodayDateKey(checkDate)) ?? 0) >=
              habit.timesPerDay
            ) {
              currentStreak++;
              checkDate = addDaysInTz(checkDate, -1);
            }

            if (todayCompletions >= habit.timesPerDay) {
              currentStreak++;
            }

            return {
              id: habit.id,
              user_id: habit.userId,
              name: habit.name,
              emoji: habit.emoji,
              description: habit.description,
              times_per_day: habit.timesPerDay,
              active: habit.active,
              created_at: habit.createdAt.toISOString(),
              updated_at: habit.updatedAt?.toISOString() || null,
              schedules: habit.schedules,
              today_completions: todayCompletions,
              today_skips: todaySkips,
              today_remaining: Math.max(habit.timesPerDay - todayAccounted, 0),
              current_streak: currentStreak,
              schedule_statuses: getScheduleStatuses(
                habit.schedules,
                habit.completions,
                getTimezone(),
              ),
            };
          }),
        );

        return { habits: habitsWithStats };
      })
      .post(
        "/",
        async ({ body, user, set }) => {
          const userId = getUserId(user);
          const schedules = getScheduleTimes(body);

          if (schedules.length === 0) {
            return unprocessable(set, "At least one schedule is required");
          }

          const habit = await prisma.$transaction(async (tx) => {
            const newHabit = await tx.habit.create({
              data: {
                userId,
                name: body.name,
                emoji: body.emoji,
                description: body.description,
                timesPerDay: schedules.length,
              },
            });

            if (schedules.length > 0) {
              await tx.habitSchedule.createMany({
                data: schedules.map((time) => ({
                  habitId: newHabit.id,
                  time,
                })),
              });
            }

            return tx.habit.findUnique({
              where: { id: newHabit.id },
              include: { schedules: true },
            });
          });

          return habit;
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 100 }),
            emoji: t.String({ minLength: 1 }),
            description: t.Optional(t.Nullable(t.String())),
            times_per_day: t.Optional(t.Number({ minimum: 1 })),
            schedules: t.Optional(t.Array(t.String())),
            schedule_times: t.Optional(t.Array(t.String())),
          }),
        },
      )
      .put(
        "/:id",
        async ({ params: { id }, body, user, set }) => {
          const userId = getUserId(user);
          const scheduleTimes = getScheduleTimes(body);

          const existingHabit = await prisma.habit.findFirst({
            where: { id: Number(id), userId },
          });

          if (!existingHabit) {
            return notFound(set, "Habit not found");
          }

          if (
            (body.schedules || body.schedule_times) &&
            scheduleTimes.length === 0
          ) {
            return unprocessable(set, "At least one schedule is required");
          }

          const updatedHabit = await prisma.$transaction(async (tx) => {
            if (body.schedules || body.schedule_times) {
              await tx.habitSchedule.deleteMany({
                where: { habitId: Number(id) },
              });
              await tx.habitSchedule.createMany({
                data: scheduleTimes.map((time) => ({
                  habitId: Number(id),
                  time,
                })),
              });
            }

            return tx.habit.update({
              where: { id: Number(id) },
              data: {
                name: body.name,
                emoji: body.emoji,
                description: body.description,
                timesPerDay:
                  body.schedules || body.schedule_times
                    ? scheduleTimes.length
                    : body.times_per_day,
                active: body.active,
                updatedAt: new Date(),
              },
              include: { schedules: true },
            });
          });

          return updatedHabit;
        },
        {
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
            emoji: t.Optional(t.String({ minLength: 1 })),
            description: t.Optional(t.Nullable(t.String())),
            times_per_day: t.Optional(t.Number({ minimum: 1 })),
            active: t.Optional(t.Boolean()),
            schedules: t.Optional(t.Array(t.String())),
            schedule_times: t.Optional(t.Array(t.String())),
          }),
        },
      )
      .delete("/:id", async ({ params: { id }, user, set }) => {
        const userId = getUserId(user);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: Number(id), userId },
        });

        if (!existingHabit) {
          return notFound(set, "Habit not found");
        }

        await prisma.habit.delete({
          where: { id: Number(id) },
        });

        return { success: true };
      })
      .post(
        "/:id/complete",
        async ({ params: { id }, body, user, set }) => {
          const userId = getUserId(user);
          const habitIdNum = Number(id);

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            return notFound(set, "Habit not found");
          }

          const { start: dayStart, end: dayEnd } = body?.date
            ? getDayRange(midnightOf(body.date))
            : getDayRange();

          const dayCompletions = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: DONE_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          const daySkipped = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: SKIPPED_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          if (dayCompletions + daySkipped >= existingHabit.timesPerDay) {
            return buildHabitStatusResponse(
              existingHabit.timesPerDay,
              dayCompletions,
              daySkipped,
            );
          }

          await prisma.$transaction(async (tx) => {
            await tx.habitCompletion.create({
              data: {
                habitId: habitIdNum,
                date: dayStart,
                completedAt: body?.date ? dayStart : new Date(),
                status: DONE_STATUS,
              },
            });

            if (
              !body?.date &&
              dayCompletions + daySkipped + 1 >= existingHabit.timesPerDay
            ) {
              await tx.habitSchedule.updateMany({
                where: { habitId: habitIdNum },
                data: { lastNotificationSent: null },
              });
            }
          });

          addJob(
            QUEUE_NAMES.SCHEDULED_TASKS,
            SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER,
            { userId },
          ).catch(() => {});
          return buildHabitStatusResponse(
            existingHabit.timesPerDay,
            dayCompletions + 1,
            daySkipped,
          );
        },
        {
          body: t.Optional(
            t.Object({
              date: t.Optional(t.String()),
            }),
          ),
        },
      )
      .delete(
        "/:id/complete",
        async ({ params: { id }, query: { date: queryDate }, user, set }) => {
          const userId = getUserId(user);
          const habitIdNum = Number(id);

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            return notFound(set, "Habit not found");
          }

          const { start: dayStart, end: dayEnd } = queryDate
            ? getDayRange(midnightOf(queryDate))
            : getDayRange();

          const lastCompletion = await prisma.habitCompletion.findFirst({
            where: {
              habitId: habitIdNum,
              status: DONE_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
            orderBy: { completedAt: "desc" },
          });

          const skippedCount = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: SKIPPED_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          if (!lastCompletion) {
            const count = await prisma.habitCompletion.count({
              where: {
                habitId: habitIdNum,
                status: DONE_STATUS,
                completedAt: { gte: dayStart, lt: dayEnd },
              },
            });
            return buildHabitStatusResponse(
              existingHabit.timesPerDay,
              count,
              skippedCount,
            );
          }

          await prisma.habitCompletion.delete({
            where: { id: lastCompletion.id },
          });

          const newCount = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: DONE_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          addJob(
            QUEUE_NAMES.SCHEDULED_TASKS,
            SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER,
            { userId },
          ).catch(() => {});
          return buildHabitStatusResponse(
            existingHabit.timesPerDay,
            newCount,
            skippedCount,
          );
        },
      )
      .post(
        "/:id/skip",
        async ({ params: { id }, body, user, set }) => {
          const userId = getUserId(user);
          const habitIdNum = Number(id);

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            return notFound(set, "Habit not found");
          }

          const { start: dayStart, end: dayEnd } = body?.date
            ? getDayRange(midnightOf(body.date))
            : getDayRange();

          const dayCompletions = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: DONE_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          const daySkipped = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: SKIPPED_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          if (dayCompletions + daySkipped >= existingHabit.timesPerDay) {
            return buildHabitStatusResponse(
              existingHabit.timesPerDay,
              dayCompletions,
              daySkipped,
            );
          }

          await prisma.$transaction(async (tx) => {
            await tx.habitCompletion.create({
              data: {
                habitId: habitIdNum,
                date: dayStart,
                completedAt: body?.date ? dayStart : new Date(),
                status: SKIPPED_STATUS,
              },
            });

            if (
              !body?.date &&
              dayCompletions + daySkipped + 1 >= existingHabit.timesPerDay
            ) {
              await tx.habitSchedule.updateMany({
                where: { habitId: habitIdNum },
                data: { lastNotificationSent: null },
              });
            }
          });

          addJob(
            QUEUE_NAMES.SCHEDULED_TASKS,
            SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER,
            { userId },
          ).catch(() => {});
          return buildHabitStatusResponse(
            existingHabit.timesPerDay,
            dayCompletions,
            daySkipped + 1,
          );
        },
        {
          body: t.Optional(
            t.Object({
              date: t.Optional(t.String()),
            }),
          ),
        },
      )
      .delete(
        "/:id/skip",
        async ({ params: { id }, query: { date: queryDate }, user, set }) => {
          const userId = getUserId(user);
          const habitIdNum = Number(id);

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            return notFound(set, "Habit not found");
          }

          const { start: dayStart, end: dayEnd } = queryDate
            ? getDayRange(midnightOf(queryDate))
            : getDayRange();

          const lastSkipped = await prisma.habitCompletion.findFirst({
            where: {
              habitId: habitIdNum,
              status: SKIPPED_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
            orderBy: { completedAt: "desc" },
          });

          const completionCount = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: DONE_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          if (!lastSkipped) {
            const skippedCount = await prisma.habitCompletion.count({
              where: {
                habitId: habitIdNum,
                status: SKIPPED_STATUS,
                completedAt: { gte: dayStart, lt: dayEnd },
              },
            });
            return buildHabitStatusResponse(
              existingHabit.timesPerDay,
              completionCount,
              skippedCount,
            );
          }

          await prisma.habitCompletion.delete({
            where: { id: lastSkipped.id },
          });

          const newSkippedCount = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: SKIPPED_STATUS,
              completedAt: { gte: dayStart, lt: dayEnd },
            },
          });

          addJob(
            QUEUE_NAMES.SCHEDULED_TASKS,
            SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER,
            { userId },
          ).catch(() => {});
          return buildHabitStatusResponse(
            existingHabit.timesPerDay,
            completionCount,
            newSkippedCount,
          );
        },
      )
      .get("/weekly", async ({ query: { start }, user }) => {
        const userId = getUserId(user);
        const weekStart = start
          ? midnightOf(start)
          : (() => {
              const today = todayLocal();
              const dow = new Date(
                today.getTime() + 12 * 60 * 60 * 1000,
              ).getUTCDay();
              const mondayOffset = dow === 0 ? -6 : 1 - dow;
              return addDaysInTz(today, mondayOffset);
            })();
        const weekEnd = addDaysInTz(weekStart, 7);

        const habits = await prisma.habit.findMany({
          where: { userId, active: true },
          include: {
            schedules: { select: { id: true, time: true } },
            completions: {
              where: {
                completedAt: { gte: weekStart, lt: weekEnd },
              },
            },
          },
        });

        const days: string[] = [];
        for (let i = 0; i < 7; i++) {
          days.push(formatDateInTimezone(addDaysInTz(weekStart, i)));
        }

        const weeklyHabits = habits.map((habit) => {
          const dayData: Record<
            string,
            { completions: number; skipped: number; target: number }
          > = {};

          for (const day of days) {
            dayData[day] = {
              completions: 0,
              skipped: 0,
              target: habit.timesPerDay,
            };
          }

          for (const c of habit.completions) {
            const dateKey = formatDateInTimezone(c.completedAt);
            if (dayData[dateKey]) {
              if (c.status === DONE_STATUS) {
                dayData[dateKey].completions += 1;
              } else if (c.status === SKIPPED_STATUS) {
                dayData[dateKey].skipped += 1;
              }
            }
          }

          return {
            id: habit.id,
            name: habit.name,
            emoji: habit.emoji,
            description: habit.description,
            times_per_day: habit.timesPerDay,
            active: habit.active,
            current_streak: 0,
            days: dayData,
          };
        });

        // Calculate streaks
        const todayStr = formatDateInTimezone(todayLocal());
        for (const habit of weeklyHabits) {
          const dbHabit = habits.find((h) => h.id === habit.id)!;
          const allCompletions = await prisma.habitCompletion.findMany({
            where: {
              habitId: habit.id,
              status: DONE_STATUS,
              completedAt: { lt: weekEnd },
            },
            select: { completedAt: true },
            orderBy: { completedAt: "desc" },
          });

          const completionsByDay = new Map<string, number>();
          for (const c of allCompletions) {
            const dateKey = formatDateInTimezone(c.completedAt);
            completionsByDay.set(
              dateKey,
              (completionsByDay.get(dateKey) ?? 0) + 1,
            );
          }

          let streak = 0;
          let checkDate = addDaysInTz(todayLocal(), -1);
          while (
            (completionsByDay.get(formatDateInTimezone(checkDate)) ?? 0) >=
            dbHabit.timesPerDay
          ) {
            streak++;
            checkDate = addDaysInTz(checkDate, -1);
          }
          if ((completionsByDay.get(todayStr) ?? 0) >= dbHabit.timesPerDay) {
            streak++;
          }
          habit.current_streak = streak;
        }

        return {
          habits: weeklyHabits,
          days,
          week_start: formatDateInTimezone(weekStart),
        };
      })
      .get(
        "/:id/history",
        async ({ params: { id }, query: { days }, user, set }) => {
          const userId = getUserId(user);
          const habitIdNum = Number(id);
          const historyDays = days ? Number(days) : 30;

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            return notFound(set, "Habit not found");
          }

          const { end: startOfTomorrow } = getDayRange();
          const startDate = addDaysInTz(todayLocal(), -(historyDays - 1));

          const completions = await prisma.habitCompletion.findMany({
            where: {
              habitId: habitIdNum,
              completedAt: {
                gte: startDate,
                lt: startOfTomorrow,
              },
            },
            select: {
              status: true,
              completedAt: true,
            },
            orderBy: {
              completedAt: "desc",
            },
          });

          const historyMap = new Map<
            string,
            { completions: number; skipped: number }
          >();
          for (const c of completions) {
            const dateKey = getTodayDateKey(c.completedAt);
            const current = historyMap.get(dateKey) || {
              completions: 0,
              skipped: 0,
            };

            if (c.status === DONE_STATUS) {
              current.completions += 1;
            } else if (c.status === SKIPPED_STATUS) {
              current.skipped += 1;
            }

            historyMap.set(dateKey, current);
          }

          const history = [];
          const today = todayLocal();
          for (let i = 0; i < historyDays; i++) {
            const date = addDaysInTz(today, -i);
            const dateStr = getTodayDateKey(date);
            const counts = historyMap.get(dateStr) || {
              completions: 0,
              skipped: 0,
            };

            history.push({
              date: dateStr,
              completions: counts.completions,
              skipped: counts.skipped,
              target: existingHabit.timesPerDay,
              accounted: Math.min(
                counts.completions + counts.skipped,
                existingHabit.timesPerDay,
              ),
              completed: counts.completions >= existingHabit.timesPerDay,
            });
          }

          return { history };
        },
      ),
  );
