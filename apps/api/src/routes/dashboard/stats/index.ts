import { Elysia } from "elysia";
import { auth } from "../../../auth";
import { requireUser } from "../../../middleware/auth";
import { prisma } from "../../../db";
import { todayLocal } from "../../../utils";
import { getCachedHabitsStreak } from "../../../utils/dashboard/habitsStreak";
import { serverError } from "../../../errors";

export const dashboardStatsRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/stats", async ({ user, set }) => {
    try {
      const today = todayLocal();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const eventsTodayCount = await prisma.customEvent.count({
        where: {
          userId: user!.id,
          startDatetime: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      const shoppingCount = await prisma.shoppingItem.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
          deletedAt: null,
        },
      });

      const choresCount = await prisma.chore.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
        },
      });

      const habitsStreak = await getCachedHabitsStreak(user!.id);

      return {
        stats: {
          events_today: eventsTodayCount,
          shopping_count: shoppingCount,
          chores_count: choresCount,
          habits_streak: habitsStreak,
        },
        activities: [],
      };
    } catch (err) {
      console.error("Error getting dashboard stats:", err);
      return serverError(set, "Failed to get dashboard stats");
    }
  });
