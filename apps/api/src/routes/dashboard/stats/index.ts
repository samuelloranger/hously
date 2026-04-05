import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { todayLocal } from "@hously/api/utils";
import { getCachedHabitsStreak } from "@hously/api/utils/dashboard/habitsStreak";
import { serverError } from "@hously/api/errors";

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
      };
    } catch (err) {
      console.error("Error getting dashboard stats:", err);
      return serverError(set, "Failed to get dashboard stats");
    }
  });
