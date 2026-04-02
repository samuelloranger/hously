import { Elysia, t } from 'elysia';
import { BoardTaskStatus, BoardTaskPriority } from '@prisma/client';
import { prisma } from '../db';
import { auth } from '../auth';
import { requireUser } from '../middleware/auth';
import { formatIso, sanitizeInput, sanitizeRichText } from '../utils';
import { badRequest, notFound, serverError } from '../utils/errors';

const STATUS_VALUES = ['backlog', 'on_hold', 'todo', 'in_progress', 'done'] as const;
type StatusApi = (typeof STATUS_VALUES)[number];

const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;
type PriorityApi = (typeof PRIORITY_VALUES)[number];

const API_TO_PRISMA_STATUS: Record<StatusApi, BoardTaskStatus> = {
  backlog: BoardTaskStatus.BACKLOG,
  on_hold: BoardTaskStatus.ON_HOLD,
  todo: BoardTaskStatus.TODO,
  in_progress: BoardTaskStatus.IN_PROGRESS,
  done: BoardTaskStatus.DONE,
};

const PRISMA_TO_API_STATUS: Record<BoardTaskStatus, StatusApi> = {
  [BoardTaskStatus.BACKLOG]: 'backlog',
  [BoardTaskStatus.ON_HOLD]: 'on_hold',
  [BoardTaskStatus.TODO]: 'todo',
  [BoardTaskStatus.IN_PROGRESS]: 'in_progress',
  [BoardTaskStatus.DONE]: 'done',
};

const API_TO_PRISMA_PRIORITY: Record<PriorityApi, BoardTaskPriority> = {
  low: BoardTaskPriority.LOW,
  medium: BoardTaskPriority.MEDIUM,
  high: BoardTaskPriority.HIGH,
  urgent: BoardTaskPriority.URGENT,
};

const PRISMA_TO_API_PRIORITY: Record<BoardTaskPriority, PriorityApi> = {
  [BoardTaskPriority.LOW]: 'low',
  [BoardTaskPriority.MEDIUM]: 'medium',
  [BoardTaskPriority.HIGH]: 'high',
  [BoardTaskPriority.URGENT]: 'urgent',
};

function parseStatus(s: string | undefined, fallback: BoardTaskStatus): BoardTaskStatus {
  if (!s) return fallback;
  const api = s as StatusApi;
  return API_TO_PRISMA_STATUS[api] ?? fallback;
}

function parsePriority(s: string | undefined, fallback: BoardTaskPriority): BoardTaskPriority {
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
  return d.toISOString().split('T')[0];
}

function computeSlug(id: number): string {
  return `HSLY-${String(id).padStart(3, '0')}`;
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
  createdByUser: { email: string; firstName: string | null };
  assignee: { id: number; firstName: string | null; lastName: string | null; email: string; avatarUrl: string | null } | null;
};

function mapTask(row: TaskRow) {
  const assigneeName = row.assignee
    ? (row.assignee.firstName
        ? `${row.assignee.firstName}${row.assignee.lastName ? ' ' + row.assignee.lastName : ''}`
        : row.assignee.email)
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
    tags: row.tags,
    created_by: row.createdBy,
    created_at: formatIso(row.createdAt),
    updated_at: formatIso(row.updatedAt),
    created_by_username: row.createdByUser.firstName ?? row.createdByUser.email,
  };
}

export const boardTasksRoutes = new Elysia({ prefix: '/api/board-tasks' })
  .use(auth)
  .use(requireUser)
  .get('/', async ({ set }) => {
    try {
      const tasks = await prisma.boardTask.findMany({
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
        include: taskInclude,
      });

      return { tasks: tasks.map(row => mapTask(row as unknown as TaskRow)) };
    } catch (error) {
      console.error('Error listing board tasks:', error);
      return serverError(set, 'Failed to list board tasks');
    }
  })

  .post(
    '/',
    async ({ user, body, set }) => {
      const title = sanitizeInput((body.title || '').trim());
      if (!title) {
        return badRequest(set, 'Title is required');
      }

      const description = body.description ? sanitizeRichText(body.description.trim()) || null : null;
      const status = parseStatus(body.status, BoardTaskStatus.TODO);
      const priority = parsePriority(body.priority, BoardTaskPriority.MEDIUM);
      const tags = Array.isArray(body.tags)
        ? body.tags.map((t: string) => sanitizeInput(t.trim())).filter(Boolean)
        : [];

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
            tags,
            createdBy: user!.id,
          },
          include: taskInclude,
        });

        return { task: mapTask(created as unknown as TaskRow) };
      } catch (error) {
        console.error('Error creating board task:', error);
        return serverError(set, 'Failed to create task');
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
        tags: t.Optional(t.Array(t.String())),
      }),
    }
  )

  .patch(
    '/:id',
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) {
        return badRequest(set, 'Invalid id');
      }

      try {
        const existing = await prisma.boardTask.findUnique({ where: { id } });
        if (!existing) {
          return notFound(set, 'Task not found');
        }

        const { title, description, status: statusRaw, priority: priorityRaw } = body;

        const data: {
          title?: string;
          description?: string | null;
          status?: BoardTaskStatus;
          position?: number;
          priority?: BoardTaskPriority;
          startDate?: Date | null;
          dueDate?: Date | null;
          assigneeId?: number | null;
          tags?: string[];
        } = {};

        if (title !== undefined) {
          const sanitized = sanitizeInput(title.trim());
          if (!sanitized) {
            return badRequest(set, 'Title cannot be empty');
          }
          data.title = sanitized;
        }

        if (description !== undefined) {
          data.description = description ? sanitizeRichText(description.trim()) || null : null;
        }

        if (statusRaw !== undefined) {
          if (!isValidStatus(statusRaw)) {
            return badRequest(set, 'Invalid status');
          }
          const nextStatus = API_TO_PRISMA_STATUS[statusRaw];
          if (nextStatus !== existing.status) {
            const maxPos = await prisma.boardTask.aggregate({
              _max: { position: true },
              where: { status: nextStatus },
            });
            data.status = nextStatus;
            data.position = (maxPos._max.position ?? -1) + 1;
          }
        }

        if (priorityRaw !== undefined) {
          if (!isValidPriority(priorityRaw)) {
            return badRequest(set, 'Invalid priority');
          }
          data.priority = API_TO_PRISMA_PRIORITY[priorityRaw];
        }

        if ('start_date' in body) {
          data.startDate = body.start_date ? new Date(body.start_date) : null;
        }

        if ('due_date' in body) {
          data.dueDate = body.due_date ? new Date(body.due_date) : null;
        }

        if ('assignee_id' in body) {
          data.assigneeId = body.assignee_id ?? null;
        }

        if (body.tags !== undefined) {
          data.tags = Array.isArray(body.tags)
            ? body.tags.map((t: string) => sanitizeInput(t.trim())).filter(Boolean)
            : [];
        }

        const updated = await prisma.boardTask.update({
          where: { id },
          data,
          include: taskInclude,
        });

        return { task: mapTask(updated as TaskRow) };
      } catch (error) {
        console.error('Error updating board task:', error);
        return serverError(set, 'Failed to update task');
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
        tags: t.Optional(t.Array(t.String())),
      }),
    }
  )

  .delete('/:id', async ({ params, set }) => {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return badRequest(set, 'Invalid id');
    }

    try {
      const existing = await prisma.boardTask.findUnique({ where: { id } });
      if (!existing) {
        return notFound(set, 'Task not found');
      }

      await prisma.boardTask.delete({ where: { id } });
      return { success: true, message: 'Task deleted' };
    } catch (error) {
      console.error('Error deleting board task:', error);
      return serverError(set, 'Failed to delete task');
    }
  })

  .post(
    '/sync',
    async ({ body, set }) => {
      const { tasks: taskUpdates } = body;

      if (!Array.isArray(taskUpdates) || taskUpdates.length === 0) {
        return badRequest(set, 'tasks must be a non-empty array');
      }

      for (const u of taskUpdates) {
        if (typeof u.id !== 'number' || !Number.isFinite(u.id)) {
          return badRequest(set, 'Each task must have a valid numeric id');
        }
        if (!isValidStatus(u.status)) {
          return badRequest(set, 'Invalid status in sync payload');
        }
        if (typeof u.position !== 'number' || u.position < 0) {
          return badRequest(set, 'Each task must have a valid position');
        }
      }

      const ids = taskUpdates.map(u => u.id);
      const uniqueIds = new Set(ids);
      if (uniqueIds.size !== ids.length) {
        return badRequest(set, 'Duplicate task ids in sync payload');
      }

      try {
        const existing = await prisma.boardTask.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        });
        if (existing.length !== ids.length) {
          return badRequest(set, 'One or more task ids do not exist');
        }

        await prisma.$transaction(
          taskUpdates.map(u => {
            const statusApi = u.status as StatusApi;
            return prisma.boardTask.update({
              where: { id: u.id },
              data: {
                status: API_TO_PRISMA_STATUS[statusApi],
                position: u.position,
              },
            });
          })
        );

        return { success: true, message: 'Board synced' };
      } catch (error) {
        console.error('Error syncing board tasks:', error);
        return serverError(set, 'Failed to sync board');
      }
    },
    {
      body: t.Object({
        tasks: t.Array(
          t.Object({
            id: t.Number(),
            status: t.String(),
            position: t.Number(),
          })
        ),
      }),
    }
  );
