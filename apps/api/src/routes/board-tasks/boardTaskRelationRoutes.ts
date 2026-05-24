import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { requireUser } from "@hously/api/middleware/auth";
import { sanitizeInput } from "@hously/api/utils";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { mapTask, taskInclude, type TaskRow } from "./boardTaskMappers";

async function wouldCreateCycle(
  blockingId: number,
  blockedId: number,
): Promise<boolean> {
  const visited = new Set<number>();
  const queue = [blockedId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === blockingId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = await prisma.boardTaskDependency.findMany({
      where: { blockedTaskId: current },
      select: { blockingTaskId: true },
    });
    queue.push(...deps.map((d) => d.blockingTaskId));
  }
  return false;
}

export const boardTaskRelationRoutes = new Elysia()
  .use(requireUser)
  .get("/:id/activity", async ({ params, set }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return badRequest(set, "Invalid id");
    }

    try {
      const activities = await prisma.boardTaskActivity.findMany({
        where: { taskId: id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return {
        activities: activities.map((a) => {
          const userName = a.user.firstName
            ? `${a.user.firstName}${a.user.lastName ? " " + a.user.lastName : ""}`
            : a.user.email;
          return {
            id: a.id,
            task_id: a.taskId,
            user_id: a.userId,
            user_name: userName,
            user_avatar: a.user.avatarUrl ?? null,
            type: a.type,
            body: a.body ?? null,
            metadata: a.metadata as { from?: string; to?: string } | null,
            created_at: a.createdAt.toISOString(),
          };
        }),
      };
    } catch (error) {
      console.error("Error fetching board task activity:", error);
      return serverError(set, "Failed to fetch activity");
    }
  })

  .post(
    "/:id/comments",
    async ({ params, body, set, user }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        return badRequest(set, "Invalid id");
      }

      const text = sanitizeInput((body.body || "").trim());
      if (!text) {
        return badRequest(set, "Comment body is required");
      }

      try {
        const existing = await prisma.boardTask.findUnique({ where: { id } });
        if (!existing) {
          return notFound(set, "Task not found");
        }

        const activity = await prisma.boardTaskActivity.create({
          data: {
            taskId: id,
            userId: user!.id,
            type: "comment",
            body: text,
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        });

        const userName = activity.user.firstName
          ? `${activity.user.firstName}${activity.user.lastName ? " " + activity.user.lastName : ""}`
          : activity.user.email;

        return {
          activity: {
            id: activity.id,
            task_id: activity.taskId,
            user_id: activity.userId,
            user_name: userName,
            user_avatar: activity.user.avatarUrl ?? null,
            type: activity.type,
            body: activity.body ?? null,
            metadata: null,
            created_at: activity.createdAt.toISOString(),
          },
        };
      } catch (error) {
        console.error("Error creating comment:", error);
        return serverError(set, "Failed to create comment");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        body: t.String(),
      }),
    },
  )

  .post(
    "/:id/dependencies",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        return badRequest(set, "Invalid id");
      }

      const { blocking_task_id, blocked_task_id } = body;

      if (
        (blocking_task_id === undefined) ===
        (blocked_task_id === undefined)
      ) {
        return badRequest(
          set,
          "Provide exactly one of blocking_task_id or blocked_task_id",
        );
      }

      const blockingId = blocking_task_id !== undefined ? blocking_task_id : id;
      const blockedId = blocked_task_id !== undefined ? blocked_task_id : id;

      if (blockingId === blockedId) {
        return badRequest(set, "A task cannot depend on itself");
      }

      try {
        const [blockingTask, blockedTask] = await Promise.all([
          prisma.boardTask.findUnique({ where: { id: blockingId } }),
          prisma.boardTask.findUnique({ where: { id: blockedId } }),
        ]);

        if (!blockingTask) return notFound(set, "Blocking task not found");
        if (!blockedTask) return notFound(set, "Blocked task not found");

        if (await wouldCreateCycle(blockingId, blockedId)) {
          return badRequest(set, "Would create circular dependency");
        }

        await prisma.boardTaskDependency.create({
          data: { blockingTaskId: blockingId, blockedTaskId: blockedId },
        });

        const updated = await prisma.boardTask.findUnique({
          where: { id },
          include: taskInclude,
        });

        return { task: mapTask(updated as unknown as TaskRow) };
      } catch (error) {
        console.error("Error adding dependency:", error);
        return serverError(set, "Failed to add dependency");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        blocking_task_id: t.Optional(t.Number()),
        blocked_task_id: t.Optional(t.Number()),
      }),
    },
  )

  .delete("/:id/dependencies/:dependencyId", async ({ params, set }) => {
    const id = Number(params.id);
    const dependencyId = Number(params.dependencyId);
    if (Number.isNaN(id) || Number.isNaN(dependencyId)) {
      return badRequest(set, "Invalid id");
    }

    try {
      const dep = await prisma.boardTaskDependency.findUnique({
        where: { id: dependencyId },
      });
      if (!dep) {
        return notFound(set, "Dependency not found");
      }
      if (dep.blockingTaskId !== id && dep.blockedTaskId !== id) {
        return badRequest(set, "Dependency does not belong to this task");
      }

      await prisma.boardTaskDependency.delete({ where: { id: dependencyId } });
      return { success: true };
    } catch (error) {
      console.error("Error removing dependency:", error);
      return serverError(set, "Failed to remove dependency");
    }
  })

  .post(
    "/:id/time-logs",
    async ({ params, body, set, user }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        return badRequest(set, "Invalid id");
      }

      const { minutes, note } = body;
      if (!Number.isInteger(minutes) || minutes <= 0) {
        return badRequest(set, "minutes must be a positive integer");
      }

      try {
        const existing = await prisma.boardTask.findUnique({ where: { id } });
        if (!existing) {
          return notFound(set, "Task not found");
        }

        const [timeLog] = await prisma.$transaction([
          prisma.boardTimeLog.create({
            data: { taskId: id, userId: user!.id, minutes, note: note ?? null },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          }),
          prisma.boardTask.update({
            where: { id },
            data: { loggedMinutes: { increment: minutes } },
          }),
        ]);

        const userName = timeLog.user.firstName
          ? `${timeLog.user.firstName}${timeLog.user.lastName ? " " + timeLog.user.lastName : ""}`
          : timeLog.user.email;

        return {
          time_log: {
            id: timeLog.id,
            task_id: timeLog.taskId,
            user_id: timeLog.userId,
            user_name: userName,
            user_avatar: timeLog.user.avatarUrl ?? null,
            minutes: timeLog.minutes,
            note: timeLog.note ?? null,
            logged_at: timeLog.loggedAt.toISOString(),
          },
        };
      } catch (error) {
        console.error("Error logging time:", error);
        return serverError(set, "Failed to log time");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        minutes: t.Number(),
        note: t.Optional(t.String()),
      }),
    },
  )

  .get("/:id/time-logs", async ({ params, set }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return badRequest(set, "Invalid id");
    }

    try {
      const existing = await prisma.boardTask.findUnique({ where: { id } });
      if (!existing) {
        return notFound(set, "Task not found");
      }

      const logs = await prisma.boardTimeLog.findMany({
        where: { taskId: id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { loggedAt: "desc" },
      });

      return {
        time_logs: logs.map((log) => {
          const userName = log.user.firstName
            ? `${log.user.firstName}${log.user.lastName ? " " + log.user.lastName : ""}`
            : log.user.email;
          return {
            id: log.id,
            task_id: log.taskId,
            user_id: log.userId,
            user_name: userName,
            user_avatar: log.user.avatarUrl ?? null,
            minutes: log.minutes,
            note: log.note ?? null,
            logged_at: log.loggedAt.toISOString(),
          };
        }),
      };
    } catch (error) {
      console.error("Error fetching time logs:", error);
      return serverError(set, "Failed to fetch time logs");
    }
  });
