import { Elysia, t } from "elysia";
import {
  BoardTaskStatus,
  BoardTaskPriority,
  BoardTaskActivityType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@hously/api/db";
import { requireUser } from "@hously/api/middleware/auth";
import { sanitizeInput, sanitizeRichText } from "@hously/api/utils";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import {
  mapTask,
  taskInclude,
  parseStatus,
  parsePriority,
  isValidStatus,
  isValidPriority,
  syncBoardTasks,
  type TaskRow,
} from "./boardTaskMappers";
import {
  API_TO_PRISMA_STATUS,
  PRISMA_TO_API_STATUS,
  API_TO_PRISMA_PRIORITY,
  PRISMA_TO_API_PRIORITY,
} from "./mappers";

export const boardTaskCrudRoutes = new Elysia()
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
            assigneeId:
              body.assignee_id == null ? null : String(body.assignee_id),
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
        assignee_id: t.Optional(t.Nullable(t.String())),
        tag_ids: t.Optional(t.Array(t.Number())),
      }),
    },
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
          assigneeId?: string | null;
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
          const newAssigneeId =
            body.assignee_id == null ? null : String(body.assignee_id);
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
        assignee_id: t.Optional(t.Nullable(t.String())),
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

  .post(
    "/sync",
    async ({ body, set }) => {
      try {
        const result = await syncBoardTasks(body.tasks);
        if (!result.ok) {
          return badRequest(set, result.message);
        }
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
