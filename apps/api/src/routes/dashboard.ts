import { Elysia, t } from "elysia";
import { prisma } from "../db";
import { auth } from "../auth";
import { formatIso } from "../utils";

export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(auth)
  .get("/stats", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      // Get today's range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 1. Events today (for current user only)
      const eventsTodayCount = await prisma.customEvent.count({
        where: {
          userId: user.id,
          startDatetime: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // 2. Shopping Items (incomplete, not deleted)
      const shoppingCount = await prisma.shoppingItem.count({
        where: {
          OR: [
            { completed: false },
            { completed: null },
          ],
          deletedAt: null,
        },
      });

      // 3. Chores (incomplete)
      const choresCount = await prisma.chore.count({
        where: {
          OR: [
            { completed: false },
            { completed: null },
          ],
        },
      });

      // 4. Monthly total (tasks completed this month)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyTotal = await prisma.taskCompletion.count({
        where: {
          completedAt: { gte: startOfMonth },
        },
      });

      return {
        stats: {
          events_today: eventsTodayCount,
          shopping_count: shoppingCount,
          chores_count: choresCount,
          monthly_total: monthlyTotal,
        },
        activities: [],
      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      set.status = 500;
      return { error: "Failed to get dashboard stats" };
    }
  })
  .get(
    "/activities",
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 5;

        // Get recent task completions with user info
        const recentCompletions = await prisma.taskCompletion.findMany({
          orderBy: { completedAt: 'desc' },
          take: limit,
          include: {
            user: {
              select: {
                firstName: true,
                email: true,
              },
            },
          },
        });

        const activities = recentCompletions.map((completion) => ({
          id: completion.id,
          user_id: completion.userId,
          task_type: completion.taskType,
          task_id: completion.taskId,
          completed_at: formatIso(completion.completedAt),
          task_name: completion.taskName,
          emotion: completion.emotion,
          username: completion.user?.firstName || completion.user?.email || "Unknown",
        }));

        return { activities };
      } catch (error) {
        console.error("Error getting dashboard activities:", error);
        set.status = 500;
        return { error: "Failed to get dashboard activities" };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  );
