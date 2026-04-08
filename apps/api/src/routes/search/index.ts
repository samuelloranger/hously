import { Elysia, t } from "elysia";
import { BoardTaskStatus, BoardTaskPriority } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { serverError } from "@hously/api/errors";
import { getQbittorrentPluginConfig } from "@hously/api/services/qbittorrent/config";
import {
  fetchMaindata,
  toTorrentListItem,
} from "@hously/api/services/qbittorrent/client";

const PRISMA_TO_API_STATUS: Record<BoardTaskStatus, string> = {
  [BoardTaskStatus.BACKLOG]: "backlog",
  [BoardTaskStatus.ON_HOLD]: "on_hold",
  [BoardTaskStatus.TODO]: "todo",
  [BoardTaskStatus.IN_PROGRESS]: "in_progress",
  [BoardTaskStatus.DONE]: "done",
};

const PRISMA_TO_API_PRIORITY: Record<BoardTaskPriority, string> = {
  [BoardTaskPriority.LOW]: "low",
  [BoardTaskPriority.MEDIUM]: "medium",
  [BoardTaskPriority.HIGH]: "high",
  [BoardTaskPriority.URGENT]: "urgent",
};

export const searchRoutes = new Elysia({ prefix: "/api/search" })
  .use(auth)
  .use(requireUser)
  .get(
    "/quick",
    async ({ query, set }) => {
      try {
        const q = (query.q ?? "").trim().toLowerCase();
        const limit = Math.min(parseInt(query.limit || "6", 10) || 6, 20);

        const empty = {
          torrents: [],
          medias: [],
          recipes: [],
          chores: [],
          shopping: [],
          users: [],
          board_tasks: [],
        };

        if (!q || q.length < 2) {
          return empty;
        }

        // Parallel DB queries
        const [recipes, chores, shopping, users, boardTasks] =
          await Promise.all([
            prisma.recipe.findMany({
              where: { name: { contains: q, mode: "insensitive" } },
              take: limit,
              select: {
                id: true,
                name: true,
                category: true,
                isFavorite: true,
              },
            }),
            prisma.chore.findMany({
              where: {
                completed: false,
                choreName: { contains: q, mode: "insensitive" },
              },
              take: limit,
              select: {
                id: true,
                choreName: true,
                description: true,
                completed: true,
                assignedToUser: {
                  select: { firstName: true, email: true },
                },
              },
            }),
            prisma.shoppingItem.findMany({
              where: { itemName: { contains: q, mode: "insensitive" } },
              take: limit,
              select: {
                id: true,
                itemName: true,
                notes: true,
                completed: true,
              },
            }),
            prisma.user.findMany({
              where: {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
              take: limit,
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            }),
            prisma.boardTask.findMany({
              where: {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              },
              take: limit,
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                priority: true,
                assignee: {
                  select: { firstName: true, email: true },
                },
              },
            }),
          ]);

        // Torrents from qBittorrent — filter by name in-memory
        let torrents: {
          id: string;
          name: string;
          size_bytes: number;
          category: string;
          progress: number;
        }[] = [];
        try {
          const { enabled, config } = await getQbittorrentPluginConfig();
          if (enabled && config) {
            const { torrents: torrentMap } = await fetchMaindata(config);
            const matched: typeof torrents = [];
            for (const raw of torrentMap.values()) {
              const item = toTorrentListItem(raw);
              if (!item) continue;
              if (!item.name.toLowerCase().includes(q)) continue;
              matched.push({
                id: item.id,
                name: item.name,
                size_bytes: item.size_bytes,
                category: item.category ?? "",
                progress: item.progress,
              });
              if (matched.length >= limit) break;
            }
            torrents = matched;
          }
        } catch {
          // qBittorrent unreachable or not configured — return empty
        }

        // Medias from native library
        let medias: {
          id: number;
          title: string;
          type: string;
          year: number | null;
          status: string;
        }[] = [];
        try {
          medias = await prisma.libraryMedia.findMany({
            where: { title: { contains: q, mode: "insensitive" } },
            take: limit,
            select: {
              id: true,
              title: true,
              type: true,
              year: true,
              status: true,
            },
          });
        } catch {
          // library table not yet available — return empty
        }

        return {
          torrents,
          medias,
          recipes: recipes.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category ?? undefined,
            is_favorite: r.isFavorite === 1,
          })),
          chores: chores.map((c) => ({
            id: c.id,
            chore_name: c.choreName,
            description: c.description ?? undefined,
            assigned_to_username:
              c.assignedToUser?.firstName ||
              c.assignedToUser?.email ||
              undefined,
            completed: c.completed ?? false,
          })),
          shopping: shopping.map((s) => ({
            id: s.id,
            item_name: s.itemName,
            notes: s.notes ?? undefined,
            completed: s.completed ?? false,
          })),
          users: users.map((u) => ({
            id: u.id,
            name: u.firstName
              ? `${u.firstName}${u.lastName ? ` ${u.lastName}` : ""}`
              : u.email,
            email: u.email,
          })),
          board_tasks: boardTasks.map((bt) => ({
            id: bt.id,
            title: bt.title,
            description: bt.description ?? undefined,
            status: PRISMA_TO_API_STATUS[bt.status],
            priority: PRISMA_TO_API_PRIORITY[bt.priority],
            assignee_name:
              bt.assignee?.firstName || bt.assignee?.email || undefined,
          })),
        };
      } catch (error) {
        console.error("Error in quick search:", error);
        return serverError(set, "Search failed");
      }
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );
