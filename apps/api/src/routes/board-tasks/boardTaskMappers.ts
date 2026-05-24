import { BoardTaskStatus, BoardTaskPriority } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { formatIso } from "@hously/api/utils";
import {
  STATUS_VALUES,
  PRIORITY_VALUES,
  API_TO_PRISMA_STATUS,
  PRISMA_TO_API_STATUS,
  API_TO_PRISMA_PRIORITY,
  PRISMA_TO_API_PRIORITY,
} from "./mappers";
import type { StatusApi, PriorityApi } from "./mappers";

export function parseStatus(
  s: string | undefined,
  fallback: BoardTaskStatus,
): BoardTaskStatus {
  if (!s) return fallback;
  const api = s as StatusApi;
  return API_TO_PRISMA_STATUS[api] ?? fallback;
}

export function parsePriority(
  s: string | undefined,
  fallback: BoardTaskPriority,
): BoardTaskPriority {
  if (!s) return fallback;
  const api = s as PriorityApi;
  return API_TO_PRISMA_PRIORITY[api] ?? fallback;
}

export function isValidStatus(s: string): s is StatusApi {
  return (STATUS_VALUES as readonly string[]).includes(s);
}

export function isValidPriority(s: string): s is PriorityApi {
  return (PRIORITY_VALUES as readonly string[]).includes(s);
}

function toDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().split("T")[0];
}

export function computeSlug(id: number): string {
  return `HSLY-${String(id).padStart(3, "0")}`;
}

export const taskInclude = {
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

export type TaskRow = {
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

export function mapTask(row: TaskRow) {
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

export type BoardTaskSyncUpdate = {
  id: number;
  status: string;
  position: number;
};

export async function syncBoardTasks(
  taskUpdates: BoardTaskSyncUpdate[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Array.isArray(taskUpdates) || taskUpdates.length === 0) {
    return { ok: false, message: "tasks must be a non-empty array" };
  }

  for (const u of taskUpdates) {
    if (typeof u.id !== "number" || !Number.isFinite(u.id)) {
      return { ok: false, message: "Each task must have a valid numeric id" };
    }
    if (!isValidStatus(u.status)) {
      return { ok: false, message: "Invalid status in sync payload" };
    }
    if (typeof u.position !== "number" || u.position < 0) {
      return { ok: false, message: "Each task must have a valid position" };
    }
  }

  const ids = taskUpdates.map((u) => u.id);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: "Duplicate task ids in sync payload" };
  }

  const existing = await prisma.boardTask.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (existing.length !== ids.length) {
    return { ok: false, message: "One or more task ids do not exist" };
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

  return { ok: true };
}
