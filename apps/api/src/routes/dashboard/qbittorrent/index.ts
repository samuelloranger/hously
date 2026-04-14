import { QBITTORRENT_TORRENTS_PAGE_SIZE } from "@hously/shared";
import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import { getQbittorrentSnapshot } from "@hously/api/utils/dashboard/qbittorrent";
import { createPollerSseResponse } from "@hously/api/services/qbittorrentPoller";
import {
  addQbittorrentMagnet,
  addQbittorrentTorrentFile,
  deleteQbittorrentTorrent,
  fetchQbittorrentCategories,
  fetchQbittorrentTorrentFiles,
  fetchQbittorrentTorrent,
  fetchQbittorrentTorrentPeers,
  fetchQbittorrentTorrentProperties,
  fetchQbittorrentTorrents,
  fetchQbittorrentTags,
  pauseQbittorrentTorrent,
  renameQbittorrentTorrent,
  renameQbittorrentTorrentFile,
  resumeQbittorrentTorrent,
  reannounceQbittorrentTorrent,
  setQbittorrentTorrentCategory,
  setQbittorrentTorrentTags,
} from "@hously/api/services/qbittorrent/torrents";
import { fetchQbittorrentTorrentTrackers } from "@hously/api/services/qbittorrent/trackers";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";
import {
  applyQbittorrentFetchStatus,
  applyQbittorrentMutationStatus,
  getQbittorrentConfigErrorResponse,
  getQbittorrentConfigOrError,
  getQbittorrentRid,
  validateQbittorrentUploadRequest,
} from "@hously/api/utils/qbittorrent/helpers";
import { prisma } from "@hously/api/db";

type UserDashboardConfig = {
  pinned_qbittorrent_hash?: string | null;
  [key: string]: unknown;
};

const getDashboardConfigObject = (value: unknown): UserDashboardConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
};

const getPinnedTorrentHashFromConfig = (value: unknown): string | null => {
  const config = getDashboardConfigObject(value);
  const hash =
    typeof config.pinned_qbittorrent_hash === "string"
      ? config.pinned_qbittorrent_hash.trim()
      : "";
  return hash.length > 0 ? hash : null;
};

const savePinnedTorrentHashForUser = async (
  userId: number,
  hash: string | null,
): Promise<UserDashboardConfig> => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardConfig: true },
  });

  const nextConfig = getDashboardConfigObject(currentUser?.dashboardConfig);
  if (hash) {
    nextConfig.pinned_qbittorrent_hash = hash;
  } else {
    delete nextConfig.pinned_qbittorrent_hash;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      dashboardConfig:
        Object.keys(nextConfig).length > 0
          ? (nextConfig as Prisma.InputJsonValue)
          : Prisma.DbNull,
    },
    select: { dashboardConfig: true },
  });

  return getDashboardConfigObject(updatedUser.dashboardConfig);
};

const getPinnedTorrentResponse = async (userId: number) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardConfig: true },
  });
  const pinnedHash = getPinnedTorrentHashFromConfig(
    currentUser?.dashboardConfig,
  );

  if (!pinnedHash) {
    return {
      enabled: false,
      connected: false,
      pinned_hash: null,
      torrent: null,
    };
  }

  const configStatus: { status?: number } = {};
  const config = await getQbittorrentConfigOrError(configStatus);
  if (!config) {
    return {
      enabled: false,
      connected: false,
      pinned_hash: pinnedHash,
      torrent: null,
      error: "qBittorrent plugin is not configured",
    };
  }

  const result = await fetchQbittorrentTorrent(config, true, pinnedHash);
  const isCompleted = (result.torrent?.progress ?? 0) >= 0.999;

  if (!result.torrent || isCompleted) {
    await savePinnedTorrentHashForUser(userId, null);
    return {
      enabled: result.enabled,
      connected: result.connected,
      pinned_hash: null,
      torrent: null,
      error: result.torrent ? undefined : result.error,
    };
  }

  return {
    enabled: result.enabled,
    connected: result.connected,
    pinned_hash: pinnedHash,
    torrent: result.torrent,
    error: result.error,
  };
};

export const dashboardQbittorrentRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/qbittorrent/status", async ({ set }) => {
    try {
      const snapshot = await getQbittorrentSnapshot();
      return { ...snapshot, updated_at: new Date().toISOString() };
    } catch (error) {
      console.error("Error fetching qBittorrent status:", error);
      return serverError(set, "Failed to get qBittorrent status");
    }
  })
  .get(
    "/qbittorrent/torrents",
    async ({ set, query }) => {
      const config = await getQbittorrentConfigOrError(set);
      const parsedOffset = query.offset ? parseInt(query.offset, 10) : 0;
      const safeOffset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0
          ? Math.trunc(parsedOffset)
          : 0;
      if (!config) {
        return {
          enabled: false,
          connected: false,
          torrents: [],
          total_count: 0,
          offset: safeOffset,
          limit: QBITTORRENT_TORRENTS_PAGE_SIZE,
        };
      }

      const result = await fetchQbittorrentTorrents(config, true, {
        filter: query.filter,
        category: query.category,
        tag: query.tag,
        sort: query.sort,
        reverse: query.reverse ? query.reverse === "true" : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return applyQbittorrentFetchStatus(set, result);
    },
    {
      query: t.Object({
        filter: t.Optional(t.String()),
        category: t.Optional(t.String()),
        tag: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        reverse: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  .get("/qbittorrent/torrents/stream", async ({ request }) => {
    const url = new URL(request.url);
    const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const offset =
      Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.trunc(rawOffset) : 0;
    return createPollerSseResponse(request, `torrents:${offset}`);
  })
  .get("/qbittorrent/pinned", async ({ user, set }) => {
    try {
      return await getPinnedTorrentResponse(user!.id);
    } catch (error) {
      console.error("Error fetching pinned qBittorrent torrent:", error);
      return serverError(set, "Failed to get pinned qBittorrent torrent");
    }
  })
  .post(
    "/qbittorrent/pinned",
    async ({ user, body, set }) => {
      const hash = typeof body.hash === "string" ? body.hash.trim() : "";
      const nextHash = hash.length > 0 ? hash : null;

      try {
        if (nextHash) {
          const config = await getQbittorrentConfigOrError(set);
          if (!config) {
            return getQbittorrentConfigErrorResponse();
          }

          const result = await fetchQbittorrentTorrent(config, true, nextHash);
          if (!result.connected) {
            set.status = 502;
            return {
              enabled: result.enabled,
              connected: result.connected,
              pinned_hash: null,
              torrent: null,
              error: result.error ?? "Unable to connect to qBittorrent",
            };
          }

          if (!result.torrent) {
            return badRequest(set, "Torrent not found");
          }
        }

        await savePinnedTorrentHashForUser(user!.id, nextHash);
        return await getPinnedTorrentResponse(user!.id);
      } catch (error) {
        console.error("Error updating pinned qBittorrent torrent:", error);
        return serverError(set, "Failed to update pinned qBittorrent torrent");
      }
    },
    {
      body: t.Object({
        hash: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .get("/qbittorrent/torrents/:hash/properties", async ({ set, params }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTorrentProperties(
      config,
      true,
      params.hash,
    );
    return applyQbittorrentFetchStatus(set, result);
  })
  .get("/qbittorrent/torrents/:hash/trackers", async ({ set, params }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTorrentTrackers(
      config,
      true,
      params.hash,
    );
    return applyQbittorrentFetchStatus(set, result);
  })
  .get("/qbittorrent/categories", async ({ set }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentCategories(config, true);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get("/qbittorrent/options", async ({ set }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const [categoriesResult, tagsResult] = await Promise.all([
      fetchQbittorrentCategories(config, true),
      fetchQbittorrentTags(config, true),
    ]);

    const connected = categoriesResult.connected && tagsResult.connected;
    if (!connected) {
      set.status = 502;
    }

    return {
      enabled: true,
      connected,
      categories: categoriesResult.categories,
      tags: tagsResult.tags,
      error: categoriesResult.error ?? tagsResult.error,
    };
  })
  .get("/qbittorrent/tags", async ({ set }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTags(config, true);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get("/qbittorrent/torrents/:hash/files", async ({ set, params }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTorrentFiles(
      config,
      true,
      params.hash,
    );
    return applyQbittorrentFetchStatus(set, result);
  })
  .get(
    "/qbittorrent/torrents/:hash/peers",
    async ({ set, params, query }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const rid = getQbittorrentRid(query?.rid);
      const result = await fetchQbittorrentTorrentPeers(
        config,
        true,
        params.hash,
        rid,
      );
      return applyQbittorrentFetchStatus(set, result);
    },
    {
      query: t.Object({
        rid: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/qbittorrent/torrents/:hash/peers/stream",
    async ({ set, params, request }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      let rid = 0;
      return createJsonSseResponse({
        request,
        poll: async () => {
          const snapshot = await fetchQbittorrentTorrentPeers(
            config,
            true,
            params.hash,
            rid,
          );
          if (snapshot.connected) {
            rid = snapshot.rid;
          }
          return snapshot;
        },
        intervalMs: 1000,
        retryMs: 3000,
        onError: (error) => ({
          enabled: true,
          connected: false,
          rid,
          full_update: true,
          peers: [],
          error:
            error instanceof Error
              ? error.message
              : "Unable to connect to qBittorrent",
        }),
        logLabel: "qBittorrent peers stream",
      });
    },
  )
  .get("/qbittorrent/torrents/:hash/stream", async ({ params, request }) => {
    return createPollerSseResponse(request, `torrent:${params.hash}`);
  })
  .post(
    "/qbittorrent/torrents/:hash/rename",
    async ({ set, params, body }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const result = await renameQbittorrentTorrent(config, true, {
        hash: params.hash,
        name: body.name,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        name: t.String(),
      }),
    },
  )
  .post(
    "/qbittorrent/torrents/:hash/rename-file",
    async ({ set, params, body }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const result = await renameQbittorrentTorrentFile(config, true, {
        hash: params.hash,
        old_path: body.old_path,
        new_path: body.new_path,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        old_path: t.String(),
        new_path: t.String(),
      }),
    },
  )
  .post(
    "/qbittorrent/torrents/:hash/set-category",
    async ({ set, params, body }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const category = typeof body.category === "string" ? body.category : null;
      const result = await setQbittorrentTorrentCategory(config, true, {
        hash: params.hash,
        category,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        category: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/qbittorrent/torrents/:hash/set-tags",
    async ({ set, params, body }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const tags = Array.isArray(body.tags) ? body.tags : [];
      const previousTags = Array.isArray(body.previous_tags)
        ? body.previous_tags
        : null;
      const result = await setQbittorrentTorrentTags(config, true, {
        hash: params.hash,
        tags,
        previous_tags: previousTags,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        tags: t.Array(t.String()),
        previous_tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .post("/qbittorrent/torrents/:hash/pause", async ({ set, params }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await pauseQbittorrentTorrent(config, true, {
      hash: params.hash,
    });
    return applyQbittorrentMutationStatus(set, result);
  })
  .post("/qbittorrent/torrents/:hash/resume", async ({ set, params }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await resumeQbittorrentTorrent(config, true, {
      hash: params.hash,
    });
    return applyQbittorrentMutationStatus(set, result);
  })
  .post("/qbittorrent/torrents/:hash/reannounce", async ({ set, params }) => {
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await reannounceQbittorrentTorrent(config, true, {
      hash: params.hash,
    });
    return applyQbittorrentMutationStatus(set, result);
  })
  .post(
    "/qbittorrent/torrents/:hash/delete",
    async ({ set, params, body }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const deleteFiles = Boolean(body.delete_files);
      const result = await deleteQbittorrentTorrent(config, true, {
        hash: params.hash,
        delete_files: deleteFiles,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        delete_files: t.Optional(t.Boolean()),
      }),
    },
  )
  .post(
    "/qbittorrent/torrents/add-magnet",
    async ({ set, body }) => {
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const result = await addQbittorrentMagnet(config, true, {
        magnet: body.magnet,
        category: body.category ?? null,
        tags: body.tags ?? null,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        magnet: t.String(),
        category: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
      }),
    },
  )
  .post(
    "/qbittorrent/torrents/add-file",
    async ({ user, set, body }) => {
      const logPrefix = "[qbittorrent:add-file]";
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        console.warn(
          `${logPrefix} plugin disabled or misconfigured for user id=${user!.id}`,
        );
        return getQbittorrentConfigErrorResponse();
      }

      console.log(
        `${logPrefix} user id=${user!.id} body keys=${Object.keys(body || {}).join(",") || "none"} category=${body.category ?? "none"} tags=${body.tags ?? "none"}`,
      );
      const validationResult = validateQbittorrentUploadRequest(
        set,
        body,
        logPrefix,
      );
      if ("error" in validationResult) return validationResult;

      const { torrents, tags } = validationResult;

      // We add them one by one for now to reuse the service function
      const results = [];
      for (const torrent of torrents) {
        results.push(
          await addQbittorrentTorrentFile(config, true, {
            torrent,
            category: body.category ?? null,
            tags,
          }),
        );
      }

      const allSuccess = results.every((r) => r.success);
      const someSuccess = results.some((r) => r.success);
      console.log(
        `${logPrefix} completed all_success=${allSuccess} some_success=${someSuccess} results=${JSON.stringify(results)}`,
      );

      if (!someSuccess) {
        set.status = 502;
        return {
          enabled: true,
          connected: true,
          success: false,
          error: results[0].error,
        };
      }

      return {
        enabled: true,
        connected: true,
        success: true,
        partial: !allSuccess,
      };
    },
    {
      body: t.Object({
        torrents: t.Union([t.Any(), t.Array(t.Any())]),
        category: t.Optional(t.String()),
        tags: t.Optional(t.String()),
      }),
      type: "multipart/form-data",
    },
  )
  .get("/qbittorrent/stream", async ({ request }) => {
    return createPollerSseResponse(request, "dashboard");
  });
