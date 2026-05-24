import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { notFound } from "@hously/api/errors";
import {
  DONE_STATUS,
  SKIPPED_STATUS,
  getUserId,
  getTodayDateKey,
  getDayRange,
  recordHabitSlotAction,
  removeHabitSlotAction,
  addDaysInTz,
  todayLocal,
} from "./habitHelpers";
import { requireUser } from "@hously/api/middleware/auth";

export const habitActionRoutes = new Elysia()
  .use(requireUser)
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

      return recordHabitSlotAction({
        habit: existingHabit,
        userId,
        bodyDate: body?.date,
        status: DONE_STATUS,
      });
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
      const existingHabit = await prisma.habit.findFirst({
        where: { id: Number(id), userId },
      });

      if (!existingHabit) {
        return notFound(set, "Habit not found");
      }

      return removeHabitSlotAction({
        habit: existingHabit,
        userId,
        queryDate,
        status: DONE_STATUS,
      });
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

      return recordHabitSlotAction({
        habit: existingHabit,
        userId,
        bodyDate: body?.date,
        status: SKIPPED_STATUS,
      });
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
      const existingHabit = await prisma.habit.findFirst({
        where: { id: Number(id), userId },
      });

      if (!existingHabit) {
        return notFound(set, "Habit not found");
      }

      return removeHabitSlotAction({
        habit: existingHabit,
        userId,
        queryDate,
        status: SKIPPED_STATUS,
      });
    },
  )
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
  );
