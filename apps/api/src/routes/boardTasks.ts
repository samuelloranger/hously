import { Elysia, t } from 'elysia';
import { BoardTaskStatus } from '@prisma/client';
import { prisma } from '../db';
import { auth } from '../auth';
import { requireUser } from '../middleware/auth';
import { formatIso, sanitizeInput } from '../utils';
import { badRequest, notFound, serverError } from '../utils/errors';

const STATUS_VALUES = ['on_hold', 'todo', 'in_progress', 'done'] as const;
type StatusApi = (typeof STATUS_VALUES)[number];

const API_TO_PRISMA: Record<StatusApi, BoardTaskStatus> = {
  on_hold: BoardTaskStatus.ON_HOLD,
  todo: BoardTaskStatus.TODO,
  in_progress: BoardTaskStatus.IN_PROGRESS,
  done: BoardTaskStatus.DONE,
};

const PRISMA_TO_API: Record<BoardTaskStatus, StatusApi> = {
  [BoardTaskStatus.ON_HOLD]: 'on_hold',
  [BoardTaskStatus.TODO]: 'todo',
  [BoardTaskStatus.IN_PROGRESS]: 'in_progress',
  [BoardTaskStatus.DONE]: 'done',
};

function parseStatus(s: string | undefined, fallback: BoardTaskStatus): BoardTaskStatus {
  if (!s) return fallback;
  const api = s as StatusApi;
  return API_TO_PRISMA[api] ?? fallback;
}

function isValidStatus(s: string): s is StatusApi {
  return (STATUS_VALUES as readonly string[]).includes(s);
}

const taskInclude = {
  createdByUser: { select: { email: true as const, firstName: true as const } },
};

type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: BoardTaskStatus;
  position: number;
  createdBy: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  createdByUser: { email: string; firstName: string | null };
};

function mapTask(row: TaskRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: PRISMA_TO_API[row.status],
    position: row.position,
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

      return { tasks: tasks.map(row => mapTask(row)) };
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

      const description = body.description ? sanitizeInput(body.description.trim()) || null : null;
      const status = parseStatus(body.status, BoardTaskStatus.TODO);

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
            createdBy: user!.id,
          },
          include: taskInclude,
        });

        return { task: mapTask(created) };
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

        const { title, description, status: statusRaw } = body;

        const data: {
          title?: string;
          description?: string | null;
          status?: BoardTaskStatus;
          position?: number;
        } = {};

        if (title !== undefined) {
          const sanitized = sanitizeInput(title.trim());
          if (!sanitized) {
            return badRequest(set, 'Title cannot be empty');
          }
          data.title = sanitized;
        }

        if (description !== undefined) {
          data.description = description ? sanitizeInput(description.trim()) || null : null;
        }

        if (statusRaw !== undefined) {
          if (!isValidStatus(statusRaw)) {
            return badRequest(set, 'Invalid status');
          }
          const nextStatus = API_TO_PRISMA[statusRaw];
          if (nextStatus !== existing.status) {
            const maxPos = await prisma.boardTask.aggregate({
              _max: { position: true },
              where: { status: nextStatus },
            });
            data.status = nextStatus;
            data.position = (maxPos._max.position ?? -1) + 1;
          }
        }

        const updated = await prisma.boardTask.update({
          where: { id },
          data,
          include: taskInclude,
        });

        return { task: mapTask(updated) };
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
                status: API_TO_PRISMA[statusApi],
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
