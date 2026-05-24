import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { notFound, unprocessable } from "@hously/api/errors";
import {
  DONE_STATUS,
  SKIPPED_STATUS,
  getTodayStatusCounts,
  getScheduleTimes,
  getUserId,
  getTodayDateKey,
  getScheduleStatuses,
  getDayRange,
  addDaysInTz,
  formatDateInTimezone,
  getTimezone,
  midnightOf,
  todayLocal,
} from "./habitHelpers";
import { requireUser } from "@hously/api/middleware/auth";

export const habitCrudRoutes = new Elysia()
  .use(requireUser)
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
        completionsByDay.set(dateKey, (completionsByDay.get(dateKey) ?? 0) + 1);
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
  });
