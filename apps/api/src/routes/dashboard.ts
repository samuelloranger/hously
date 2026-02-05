import { Elysia, t } from "elysia";
import { db } from "../db";
import { customEvents, shoppingItems, chores, taskCompletions, users } from "../db/schema";
import { between, count, eq, isNull, or, desc, gte, and } from "drizzle-orm";
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
      const eventsToday = await db
        .select({ count: count() })
        .from(customEvents)
        .where(
          and(
            eq(customEvents.userId, user.id),
            between(
              customEvents.startDatetime,
              today.toISOString().split("T")[0],
              tomorrow.toISOString().split("T")[0]
            )
          )
        );

      // 2. Shopping Items (incomplete, not deleted)
      const shoppingCount = await db
        .select({ count: count() })
        .from(shoppingItems)
        .where(
          and(
            or(
              eq(shoppingItems.completed, false),
              isNull(shoppingItems.completed)
            ),
            isNull(shoppingItems.deletedAt)
          )
        );

      // 3. Chores (incomplete)
      const choresCount = await db
        .select({ count: count() })
        .from(chores)
        .where(
          or(
            eq(chores.completed, false),
            isNull(chores.completed)
          )
        );

      // 4. Monthly total (tasks completed this month)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyTotalResult = await db
        .select({ count: count() })
        .from(taskCompletions)
        .where(gte(taskCompletions.completedAt, startOfMonth.toISOString()));

      return {
        stats: {
          events_today: eventsToday[0].count,
          shopping_count: shoppingCount[0].count,
          chores_count: choresCount[0].count,
          monthly_total: monthlyTotalResult[0].count,
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
        const recentCompletions = await db
          .select({
            id: taskCompletions.id,
            userId: taskCompletions.userId,
            taskType: taskCompletions.taskType,
            taskId: taskCompletions.taskId,
            completedAt: taskCompletions.completedAt,
            taskName: taskCompletions.taskName,
            emotion: taskCompletions.emotion,
            userFirstName: users.firstName,
            userEmail: users.email,
          })
          .from(taskCompletions)
          .leftJoin(users, eq(taskCompletions.userId, users.id))
          .orderBy(desc(taskCompletions.completedAt))
          .limit(limit);

        const activities = recentCompletions.map((completion) => ({
          id: completion.id,
          user_id: completion.userId,
          task_type: completion.taskType,
          task_id: completion.taskId,
          completed_at: formatIso(completion.completedAt),
          task_name: completion.taskName,
          emotion: completion.emotion,
          username: completion.userFirstName || completion.userEmail || "Unknown",
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
