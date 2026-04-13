import { Elysia, t } from "elysia";
import {
  BoardTaskStatus,
  BoardTaskPriority,
  BoardTaskActivityType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { formatIso, sanitizeInput, sanitizeRichText } from "@hously/api/utils";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import {
  STATUS_VALUES,
  PRIORITY_VALUES,
  API_TO_PRISMA_STATUS,
  PRISMA_TO_API_STATUS,
  API_TO_PRISMA_PRIORITY,
  PRISMA_TO_API_PRIORITY,
} from "./mappers";
import type { StatusApi, PriorityApi } from "./mappers";

function parseStatus(
  s: string | undefined,
  fallback: BoardTaskStatus,
): BoardTaskStatus {
  if (!s) return fallback;
  const api = s as StatusApi;
  return API_TO_PRISMA_STATUS[api] ?? fallback;
}

function parsePriority(
  s: string | undefined,
  fallback: BoardTaskPriority,
): BoardTaskPriority {
  if (!s) return fallback;
  const api = s as PriorityApi;
  return API_TO_PRISMA_PRIORITY[api] ?? fallback;
}

function isValidStatus(s: string): s is StatusApi {
  return (STATUS_VALUES as readonly string[]).includes(s);
}

function isValidPriority(s: string): s is PriorityApi {
  return (PRIORITY_VALUES as readonly string[]).includes(s);
}

function toDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().split("T")[0];
}

function computeSlug(id: number): string {
  return `HSLY-${String(id).padStart(3, "0")}`;
}

const taskInclude = {
  createdByUser: { select: { email: true as const, firstName: true as const } },
  assignee: {
    select: {
      id: true as const,
      firstName: true as const,
      lastName: true as const,
      email: true as const,
      avatarUrl: true as const,
    },
  },
  boardTags: {
    select: { id: true as const, name: true as const, color: true as const },
    orderBy: { name: "asc" as const },
  },
  blockingDependencies: {
    include: {
      blockedTask: {
        select: {
          id: true as const,
          title: true as const,
          status: true as const,
        },
      },
    },
  },
  blockedDependencies: {
    include: {
      blockingTask: {
        select: {
          id: true as const,
          title: true as const,
          status: true as const,
        },
      },
    },
  },
};

type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: BoardTaskStatus;
  position: number;
  priority: BoardTaskPriority;
  startDate: Date | null;
  dueDate: Date | null;
  assigneeId: number | null;
  tags: string[];
  createdBy: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  estimatedMinutes: number | null;
  loggedMinutes: number;
  archived: boolean;
  createdByUser: { email: string; firstName: string | null };
  assignee: {
    id: number;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  boardTags: { id: number; name: string; color: string | null }[];
  blockingDependencies: {
    id: number;
    blockedTaskId: number;
    blockedTask: { id: number; title: string; status: BoardTaskStatus };
  }[];
  blockedDependencies: {
    id: number;
    blockingTaskId: number;
    blockingTask: { id: number; title: string; status: BoardTaskStatus };
  }[];
};

function mapTask(row: TaskRow) {
  const assigneeName = row.assignee
    ? row.assignee.firstName
      ? `${row.assignee.firstName}${row.assignee.lastName ? " " + row.assignee.lastName : ""}`
      : row.assignee.email
    : null;

  return {
    id: row.id,
    slug: computeSlug(row.id),
    title: row.title,
    description: row.description,
    status: PRISMA_TO_API_STATUS[row.status],
    position: row.position,
    priority: PRISMA_TO_API_PRIORITY[row.priority],
    start_date: toDateOnly(row.startDate),
    due_date: toDateOnly(row.dueDate),
    assignee_id: row.assigneeId,
    assignee_name: assigneeName,
    assignee_avatar: row.assignee?.avatarUrl ?? null,
    tags: row.boardTags,
    estimated_minutes: row.estimatedMinutes,
    logged_minutes: row.loggedMinutes,
    archived: row.archived,
    created_by: row.createdBy,
    created_at: formatIso(row.createdAt),
    updated_at: formatIso(row.updatedAt),
    created_by_username: row.createdByUser.firstName ?? row.createdByUser.email,
    blocks: row.blockingDependencies.map((d) => ({
      id: d.id,
      task_id: d.blockedTaskId,
      slug: computeSlug(d.blockedTask.id),
      title: d.blockedTask.title,
    })),
    blocked_by: row.blockedDependencies.map((d) => ({
      id: d.id,
      task_id: d.blockingTaskId,
      slug: computeSlug(d.blockingTask.id),
      title: d.blockingTask.title,
      is_resolved: PRISMA_TO_API_STATUS[d.blockingTask.status] === "done",
    })),
  };
}

async function wouldCreateCycle(
  blockingId: number,
  blockedId: number,
): Promise<boolean> {
  // BFS: starting from blockedId, follow blockingDependencies (what blocks blockedId)
  // If we ever reach blockingId, adding blockingId->blockedId would create a cycle
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

export const boardTasksRoutes = new Elysia({ prefix: "/api/board-tasks" })
  .use(auth)
  .use(requireUser)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const page = query.page
          ? Math.max(1, parseInt(query.page, 10) || 1)
          : null;
        const limit = page
          ? Math.min(parseInt(query.limit || "50", 10) || 50, 100)
          : undefined;

        const archived = query.archived === "true";
        const where = { archived };

        const [tasks, total] = await Promise.all([
          prisma.boardTask.findMany({
            where,
            orderBy: [{ status: "asc" }, { position: "asc" }],
            include: taskInclude,
            ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
          }),
          page ? prisma.boardTask.count({ where }) : Promise.resolve(undefined),
        ]);

        return {
          tasks: tasks.map((row) => mapTask(row as unknown as TaskRow)),
          ...(page && limit && total != null
            ? {
                pagination: {
                  page,
                  limit,
                  total,
                  pages: Math.ceil(total / limit),
                },
              }
            : {}),
        };
      } catch (error) {
        console.error("Error listing board tasks:", error);
        return serverError(set, "Failed to list board tasks");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        archived: t.Optional(t.String()),
      }),
    },
  )

  .post(
    "/",
    async ({ user, body, set }) => {
      const title = sanitizeInput((body.title || "").trim());
      if (!title) {
        return badRequest(set, "Title is required");
      }

      const description = body.description
        ? sanitizeRichText(body.description.trim()) || null
        : null;
      const status = parseStatus(body.status, BoardTaskStatus.TODO);
      const priority = parsePriority(body.priority, BoardTaskPriority.MEDIUM);
      const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : [];

      try {
        const maxPos = await prisma.boardTask.aggregate({
          _max: { position: true },
          where: { status },
        });
        const position = (maxPos._max.position ?? -1) + 1;

        const created = await prisma.boardTask.create({
          data: {
            title,
            description,
            status,
            position,
            priority,
            startDate: body.start_date ? new Date(body.start_date) : null,
            dueDate: body.due_date ? new Date(body.due_date) : null,
            assigneeId: body.assignee_id ?? null,
            tags: [],
            boardTags:
              tagIds.length > 0
                ? { connect: tagIds.map((id: number) => ({ id })) }
                : undefined,
            createdBy: user!.id,
          },
          include: taskInclude,
        });

        await prisma.boardTaskActivity.create({
          data: { taskId: created.id, userId: user!.id, type: "created" },
        });

        return { task: mapTask(created as unknown as TaskRow) };
      } catch (error) {
        console.error("Error creating board task:", error);
        return serverError(set, "Failed to create task");
      }
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.Optional(t.String()),
        status: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        start_date: t.Optional(t.Nullable(t.String())),
        due_date: t.Optional(t.Nullable(t.String())),
        assignee_id: t.Optional(t.Nullable(t.Number())),
        tag_ids: t.Optional(t.Array(t.Number())),
      }),
    },
  )

  .get("/stream", ({ request }) =>
    createJsonSseResponse({
      request,
      poll: async () => {
        const tasks = await prisma.boardTask.findMany({
          where: { archived: false },
          orderBy: [{ status: "asc" }, { position: "asc" }],
          include: taskInclude,
        });
        return {
          tasks: tasks.map((row) => mapTask(row as unknown as TaskRow)),
        };
      },
      intervalMs: 4000,
      retryMs: 8000,
      logLabel: "Board tasks stream",
    }),
  )

  .patch(
    "/:id",
    async ({ params, body, set, user }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        return badRequest(set, "Invalid id");
      }

      try {
        const existing = await prisma.boardTask.findUnique({ where: { id } });
        if (!existing) {
          return notFound(set, "Task not found");
        }

        const {
          title,
          description,
          status: statusRaw,
          priority: priorityRaw,
        } = body;

        const data: {
          title?: string;
          description?: string | null;
          status?: BoardTaskStatus;
          position?: number;
          priority?: BoardTaskPriority;
          startDate?: Date | null;
          dueDate?: Date | null;
          assigneeId?: number | null;
          boardTags?: { set: { id: number }[] };
          estimatedMinutes?: number | null;
          archived?: boolean;
        } = {};

        const activityInserts: Prisma.BoardTaskActivityCreateManyInput[] = [];

        if (title !== undefined) {
          const sanitized = sanitizeInput(title.trim());
          if (!sanitized) {
            return badRequest(set, "Title cannot be empty");
          }
          data.title = sanitized;
        }

        if (description !== undefined) {
          data.description = description
            ? sanitizeRichText(description.trim()) || null
            : null;
        }

        if (statusRaw !== undefined) {
          if (!isValidStatus(statusRaw)) {
            return badRequest(set, "Invalid status");
          }
          const nextStatus = API_TO_PRISMA_STATUS[statusRaw];
          if (nextStatus !== existing.status) {
            const maxPos = await prisma.boardTask.aggregate({
              _max: { position: true },
              where: { status: nextStatus },
            });
            data.status = nextStatus;
            data.position = (maxPos._max.position ?? -1) + 1;
            activityInserts.push({
              taskId: id,
              userId: user!.id,
              type: "status_change",
              metadata: {
                from: PRISMA_TO_API_STATUS[existing.status],
                to: PRISMA_TO_API_STATUS[nextStatus],
              },
            });
          }
        }

        if (priorityRaw !== undefined) {
          if (!isValidPriority(priorityRaw)) {
            return badRequest(set, "Invalid priority");
          }
          const nextPriority = API_TO_PRISMA_PRIORITY[priorityRaw];
          if (nextPriority !== existing.priority) {
            activityInserts.push({
              taskId: id,
              userId: user!.id,
              type: "priority_change",
              metadata: {
                from: PRISMA_TO_API_PRIORITY[existing.priority],
                to: PRISMA_TO_API_PRIORITY[nextPriority],
              },
            });
          }
          data.priority = nextPriority;
        }

        if ("start_date" in body) {
          data.startDate = body.start_date ? new Date(body.start_date) : null;
        }

        if ("due_date" in body) {
          data.dueDate = body.due_date ? new Date(body.due_date) : null;
        }

        if ("assignee_id" in body) {
          const newAssigneeId = body.assignee_id ?? null;
          if (newAssigneeId !== existing.assigneeId) {
            activityInserts.push({
              taskId: id,
              userId: user!.id,
              type: "assignee_change",
              metadata: { to: newAssigneeId ? String(newAssigneeId) : null },
            });
          }
          data.assigneeId = newAssigneeId;
        }

        if (body.tag_ids !== undefined) {
          data.boardTags = {
            set: Array.isArray(body.tag_ids)
              ? body.tag_ids.map((id: number) => ({ id }))
              : [],
          };
        }

        if ("estimated_minutes" in body) {
          data.estimatedMinutes = body.estimated_minutes ?? null;
        }

        if (body.archived !== undefined) {
          data.archived = body.archived;
          if (body.archived !== existing.archived) {
            activityInserts.push({
              taskId: id,
              userId: user!.id,
              type: body.archived
                ? BoardTaskActivityType.archived
                : BoardTaskActivityType.unarchived,
            });
          }
        }

        const [updated] = await prisma.$transaction([
          prisma.boardTask.update({
            where: { id },
            data,
            include: taskInclude,
          }),
          ...(activityInserts.length > 0
            ? [prisma.boardTaskActivity.createMany({ data: activityInserts })]
            : []),
        ]);

        return { task: mapTask(updated as unknown as TaskRow) };
      } catch (error) {
        console.error("Error updating board task:", error);
        return serverError(set, "Failed to update task");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.Nullable(t.String())),
        status: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        start_date: t.Optional(t.Nullable(t.String())),
        due_date: t.Optional(t.Nullable(t.String())),
        assignee_id: t.Optional(t.Nullable(t.Number())),
        tag_ids: t.Optional(t.Array(t.Number())),
        estimated_minutes: t.Optional(t.Nullable(t.Number())),
        archived: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete("/:id", async ({ params, set }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return badRequest(set, "Invalid id");
    }

    try {
      const existing = await prisma.boardTask.findUnique({ where: { id } });
      if (!existing) {
        return notFound(set, "Task not found");
      }

      await prisma.boardTask.delete({ where: { id } });
      return { success: true, message: "Task deleted" };
    } catch (error) {
      console.error("Error deleting board task:", error);
      return serverError(set, "Failed to delete task");
    }
  })

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
  })

  .post(
    "/sync",
    async ({ body, set }) => {
      const { tasks: taskUpdates } = body;

      if (!Array.isArray(taskUpdates) || taskUpdates.length === 0) {
        return badRequest(set, "tasks must be a non-empty array");
      }

      for (const u of taskUpdates) {
        if (typeof u.id !== "number" || !Number.isFinite(u.id)) {
          return badRequest(set, "Each task must have a valid numeric id");
        }
        if (!isValidStatus(u.status)) {
          return badRequest(set, "Invalid status in sync payload");
        }
        if (typeof u.position !== "number" || u.position < 0) {
          return badRequest(set, "Each task must have a valid position");
        }
      }

      const ids = taskUpdates.map((u) => u.id);
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        return badRequest(set, "Duplicate task ids in sync payload");
      }

      try {
        const existing = await prisma.boardTask.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });
        if (existing.length !== ids.length) {
          return badRequest(set, "One or more task ids do not exist");
        }

        await prisma.$transaction(
          taskUpdates.map((u) => {
            const statusApi = u.status as StatusApi;
            return prisma.boardTask.update({
              where: { id: u.id },
              data: {
                status: API_TO_PRISMA_STATUS[statusApi],
                position: u.position,
              },
            });
          }),
        );

        return { success: true, message: "Board synced" };
      } catch (error) {
        console.error("Error syncing board tasks:", error);
        return serverError(set, "Failed to sync board");
      }
    },
    {
      body: t.Object({
        tasks: t.Array(
          t.Object({
            id: t.Number(),
            status: t.String(),
            position: t.Number(),
          }),
        ),
      }),
    },
  );
