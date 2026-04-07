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
import {
  normalizeRadarrConfig,
  normalizeSonarrConfig,
} from "@hously/api/utils/plugins/normalizers";
import { mapRadarrMovie, mapSonarrSeries } from "@hously/api/utils/medias/mappers";

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
        const [recipes, chores, shopping, users, boardTasks] = await Promise.all([
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

        // Medias from Radarr/Sonarr — filter by title in-memory
        let medias: {
          id: number;
          title: string;
          service: string;
          media_type: string;
          source_id: string;
          year?: number;
        }[] = [];
        try {
          const [radarrPlugin, sonarrPlugin] = await Promise.all([
            prisma.plugin.findFirst({
              where: { type: "radarr" },
              select: { enabled: true, config: true },
            }),
            prisma.plugin.findFirst({
              where: { type: "sonarr" },
              select: { enabled: true, config: true },
            }),
          ]);

          const mediaFetches: Promise<void>[] = [];

          if (radarrPlugin?.enabled) {
            const radarrConfig = normalizeRadarrConfig(radarrPlugin.config);
            if (radarrConfig) {
              mediaFetches.push(
                fetch(new URL("/api/v3/movie", radarrConfig.website_url).toString(), {
                  headers: {
                    "X-Api-Key": radarrConfig.api_key,
                    Accept: "application/json",
                  },
                  signal: AbortSignal.timeout(5000),
                })
                  .then(async (res) => {
                    if (!res.ok) return;
                    const movies = (await res.json()) as unknown[];
                    for (const raw of movies) {
                      const item = mapRadarrMovie(raw, radarrConfig.website_url);
                      if (!item) continue;
                      if (!item.title.toLowerCase().includes(q)) continue;
                      medias.push({
                        id: item.source_id,
                        title: item.title,
                        service: "radarr",
                        media_type: "movie",
                        source_id: String(item.source_id),
                        year: item.year ?? undefined,
                      });
                      if (medias.length >= limit) break;
                    }
                  })
                  .catch(() => {}),
              );
            }
          }

          if (sonarrPlugin?.enabled) {
            const sonarrConfig = normalizeSonarrConfig(sonarrPlugin.config);
            if (sonarrConfig) {
              mediaFetches.push(
                fetch(new URL("/api/v3/series", sonarrConfig.website_url).toString(), {
                  headers: {
                    "X-Api-Key": sonarrConfig.api_key,
                    Accept: "application/json",
                  },
                  signal: AbortSignal.timeout(5000),
                })
                  .then(async (res) => {
                    if (!res.ok) return;
                    const series = (await res.json()) as unknown[];
                    let added = 0;
                    for (const raw of series) {
                      if (medias.length >= limit) break;
                      const item = mapSonarrSeries(raw, sonarrConfig.website_url);
                      if (!item) continue;
                      if (!item.title.toLowerCase().includes(q)) continue;
                      medias.push({
                        id: item.source_id,
                        title: item.title,
                        service: "sonarr",
                        media_type: "series",
                        source_id: String(item.source_id),
                        year: item.year ?? undefined,
                      });
                      added++;
                    }
                  })
                  .catch(() => {}),
              );
            }
          }

          await Promise.all(mediaFetches);
          medias = medias.slice(0, limit);
        } catch {
          // Media plugins unreachable — return empty
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
              c.assignedToUser?.firstName || c.assignedToUser?.email || undefined,
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
