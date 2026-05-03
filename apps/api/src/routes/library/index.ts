import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import {
  addJob,
  libraryMigrateQueue,
  libraryReindexLanguagesQueue,
  libraryRemuxQueue,
  QUEUE_NAMES,
} from "@hously/api/services/queueService";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import type { LibraryMigrateProgress } from "@hously/api/services/jobs/libraryMigrateWorker";
import type { LibraryReindexLanguagesProgress } from "@hously/api/services/jobs/libraryReindexLanguagesWorker";
import type { LibraryRemuxJobData } from "@hously/api/services/jobs/libraryRemuxWorker";
import {
  grabRelease,
  searchAndGrab,
  profileToScoreInput,
} from "@hously/api/services/mediaGrabber";
import { filesFailProfile } from "@hously/api/services/upgradeDetection";
import {
  getLastRssRun,
  getRssRunHistory,
} from "@hously/api/services/rssRunStatus";
import {
  scheduledTasksQueue,
  SCHEDULED_JOB_NAMES,
} from "@hously/api/services/queueService";
import { libraryEventBus } from "@hously/api/services/libraryEvents";
import { addOrUpdateLibraryFromTmdb } from "@hously/api/services/libraryFromTmdb";
import { rescanLibraryItem } from "@hously/api/services/library/rescan";
import { buildLibraryStatsResponse } from "./libraryStats";
import { deleteCache } from "@hously/api/services/cache";
import { TMDB_UPCOMING_CACHE_KEY } from "@hously/api/utils/dashboard/tmdbUpcoming";

function computeTotalSizeBytes(
  files: { sizeBytes: bigint }[],
  episodes: { files: { sizeBytes: bigint }[] }[],
): string | null {
  let total = 0n;
  for (const f of files) total += f.sizeBytes;
  for (const ep of episodes) for (const f of ep.files) total += f.sizeBytes;
  return total === 0n ? null : total.toString();
}

function mapLibraryMedia(item: {
  id: number;
  tmdbId: number;
  type: string;
  title: string;
  sortTitle: string | null;
  year: number | null;
  status: string;
  monitored: boolean;
  posterUrl: string | null;
  overview: string | null;
  digitalReleaseDate: Date | null;
  qualityProfileId: number | null;
  searchAttempts: number;
  qualityProfile: { id: number; name: string } | null;
  downloadHistories?: { grabbedAt: Date }[];
  addedAt: Date;
  updatedAt: Date;
  files?: { sizeBytes: bigint }[];
  episodes?: { files: { sizeBytes: bigint }[] }[];
}) {
  return {
    id: item.id,
    tmdb_id: item.tmdbId,
    type: item.type,
    title: item.title,
    sort_title: item.sortTitle,
    year: item.year,
    status: item.status,
    monitored: item.monitored,
    poster_url: item.posterUrl,
    overview: item.overview,
    digital_release_date: item.digitalReleaseDate?.toISOString() ?? null,
    quality_profile_id: item.qualityProfileId,
    search_attempts: item.searchAttempts,
    quality_profile: item.qualityProfile
      ? { id: item.qualityProfile.id, name: item.qualityProfile.name }
      : null,
    added_at: item.addedAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
    last_grabbed_at:
      item.downloadHistories?.[0]?.grabbedAt.toISOString() ?? null,
    total_size_bytes: computeTotalSizeBytes(
      item.files ?? [],
      item.episodes ?? [],
    ),
  };
}

const libraryMediaInclude = {
  qualityProfile: { select: { id: true, name: true } },
  downloadHistories: {
    orderBy: { grabbedAt: "desc" as const },
    take: 1,
    select: { grabbedAt: true },
  },
  files: { select: { sizeBytes: true } },
  episodes: {
    include: {
      files: { select: { sizeBytes: true } },
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────

export const libraryRoutes = new Elysia({ prefix: "/api/library" })
  .use(auth)
  .use(requireUser)

  // GET /api/library — list library
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const { type, status, q, language } = query;
        const titleFilter = q
          ? { title: { contains: q, mode: "insensitive" as const } }
          : {};
        const sharedWhere: Prisma.LibraryMediaWhereInput = {
          ...(status ? { status } : {}),
          ...titleFilter,
          ...(language && language.length > 0
            ? { files: { some: { languageTags: { has: language } } } }
            : {}),
        };
        const [items, counts] = await Promise.all([
          prisma.libraryMedia.findMany({
            where: { ...sharedWhere, ...(type ? { type } : {}) },
            orderBy: { title: "asc" },
            include: libraryMediaInclude,
          }),
          prisma.libraryMedia.groupBy({
            by: ["type"],
            where: sharedWhere,
            _count: true,
          }),
        ]);
        const movieCount = counts.find((c) => c.type === "movie")?._count ?? 0;
        const showCount = counts.find((c) => c.type === "show")?._count ?? 0;
        return {
          items: items.map(mapLibraryMedia),
          movie_count: movieCount,
          show_count: showCount,
        };
      } catch {
        return serverError(set, "Failed to fetch library");
      }
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        q: t.Optional(t.String()),
        language: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/library/stats — aggregate KPIs for dashboard
  .get("/stats", async ({ set }) => {
    try {
      const [typeStatusRows, tmdbStatusRows, files] = await Promise.all([
        prisma.libraryMedia.groupBy({
          by: ["type", "status"],
          _count: true,
        }),
        prisma.libraryMedia.groupBy({
          by: ["tmdbStatus"],
          where: { type: "show" },
          _count: true,
        }),
        prisma.$queryRaw<{ resolution: number | null; size_bytes: bigint }[]>`
          SELECT resolution, SUM(size_bytes) AS size_bytes
          FROM media_files
          GROUP BY resolution
        `,
      ]);

      const stats = buildLibraryStatsResponse({
        byTypeStatus: typeStatusRows.map((r) => ({
          type: r.type,
          status: r.status,
          count: r._count,
        })),
        byTmdbStatus: tmdbStatusRows.map((r) => ({
          tmdb_status: r.tmdbStatus,
          count: r._count,
        })),
        files: files.map((f) => ({
          resolution: f.resolution,
          size_bytes: f.size_bytes,
        })),
      });

      return { stats };
    } catch {
      return serverError(set, "Failed to fetch library stats");
    }
  })

  // GET /api/library/language-tags — distinct language tags present in the library
  .get("/language-tags", async ({ set }) => {
    try {
      const rows = await prisma.$queryRaw<
        { tag: string }[]
      >`SELECT DISTINCT UNNEST(language_tags) AS tag FROM media_files`;
      const tags = rows.map((r) => r.tag).filter(Boolean);
      const order: Record<string, number> = {
        EN: 0,
        VFQ: 1,
        VFF: 2,
        VFI: 3,
        FR: 4,
      };
      tags.sort((a, b) => {
        const ai = order[a] ?? 100;
        const bi = order[b] ?? 100;
        if (ai !== bi) return ai - bi;
        return a.localeCompare(b);
      });
      return { tags };
    } catch {
      return serverError(set, "Failed to fetch language tags");
    }
  })

  // POST /api/library/reindex-languages — enqueue background reindex (admin only)
  .post("/reindex-languages", async ({ user, set }) => {
    if (!user?.is_admin) return badRequest(set, "Admin access required");
    try {
      const job = await libraryReindexLanguagesQueue.add(
        "library-reindex-languages",
        {},
        { jobId: "library-reindex-languages-singleton" },
      );
      const state = await job?.getState();
      if (state === "active" || state === "waiting") {
        return badRequest(set, "A language reindex job is already running");
      }
      return { job_id: job?.id };
    } catch {
      return serverError(set, "Failed to enqueue reindex job");
    }
  })

  // GET /api/library/reindex-languages/status — current or latest reindex job
  .get("/reindex-languages/status", async ({ set }) => {
    try {
      const [active, waiting, completed, failed] = await Promise.all([
        libraryReindexLanguagesQueue.getJobs(["active"]),
        libraryReindexLanguagesQueue.getJobs(["waiting"]),
        libraryReindexLanguagesQueue.getJobs(["completed"], 0, 1, false),
        libraryReindexLanguagesQueue.getJobs(["failed"], 0, 1, false),
      ]);
      const job = active[0] ?? waiting[0] ?? completed[0] ?? failed[0] ?? null;
      if (!job) {
        return {
          state: "unknown",
          job_id: null,
          progress: null,
          result: null,
          error: null,
          started_at: null,
          finished_at: null,
        };
      }
      const state = await job.getState();
      const progress =
        (job.progress as LibraryReindexLanguagesProgress | null | number) ??
        null;
      const typedProgress =
        typeof progress === "object" && progress !== null
          ? (progress as LibraryReindexLanguagesProgress)
          : null;
      return {
        job_id: job.id ?? null,
        state,
        progress: typedProgress,
        result: state === "completed" ? (job.returnvalue ?? null) : null,
        error: state === "failed" ? (job.failedReason ?? null) : null,
        started_at: job.processedOn
          ? new Date(job.processedOn).toISOString()
          : null,
        finished_at: job.finishedOn
          ? new Date(job.finishedOn).toISOString()
          : null,
      };
    } catch {
      return serverError(set, "Failed to fetch reindex status");
    }
  })

  // POST /api/library/files/:fileId/remux — enqueue a per-file remux job
  .post(
    "/files/:fileId/remux",
    async ({ params, set, body }) => {
      const fileId = parseInt(params.fileId, 10);
      if (!Number.isFinite(fileId)) return badRequest(set, "Invalid file id");
      if (!body.keep_audio_track_indices.length)
        return badRequest(set, "At least one audio track must be kept");
      try {
        const jobId = `library-remux-file-${fileId}`;
        const existing = await libraryRemuxQueue.getJob(jobId);
        const existingState = existing ? await existing.getState() : null;
        if (existingState === "active" || existingState === "waiting") {
          return badRequest(set, "A remux job for this file is already queued");
        }
        const job = await libraryRemuxQueue.add(
          "library-remux-file",
          {
            file_id: fileId,
            keep_audio_track_indices: body.keep_audio_track_indices,
            keep_subtitle_track_indices: body.keep_subtitle_track_indices,
          } satisfies LibraryRemuxJobData,
          { jobId },
        );
        return { job_id: job?.id };
      } catch {
        return serverError(set, "Failed to enqueue remux job");
      }
    },
    {
      body: t.Object({
        keep_audio_track_indices: t.Array(t.Number(), { minItems: 1 }),
        keep_subtitle_track_indices: t.Array(t.Number()),
      }),
    },
  )

  // GET /api/library/files/:fileId/remux/status — status of that file's remux job
  .get("/files/:fileId/remux/status", async ({ params, set }) => {
    const fileId = parseInt(params.fileId, 10);
    if (!Number.isFinite(fileId)) return badRequest(set, "Invalid file id");
    try {
      const jobId = `library-remux-file-${fileId}`;
      const job = await libraryRemuxQueue.getJob(jobId);
      if (!job) {
        return { state: "unknown", job_id: null, result: null, error: null };
      }
      const state = await job.getState();
      return {
        job_id: job.id ?? null,
        state,
        result: state === "completed" ? (job.returnvalue ?? null) : null,
        error: state === "failed" ? (job.failedReason ?? null) : null,
      };
    } catch {
      return serverError(set, "Failed to fetch remux status");
    }
  })

  // GET /api/library/events — SSE stream for real-time library updates
  .get("/events", ({ request, set }) => {
    set.headers["Content-Type"] = "text/event-stream";
    set.headers["Cache-Control"] = "no-cache";
    set.headers["Connection"] = "keep-alive";
    set.headers["X-Accel-Buffering"] = "no";

    const enc = new TextEncoder();
    let closed = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
      cancel() {
        closed = true;
      },
    });

    function send(chunk: string) {
      if (closed) return;
      try {
        controller.enqueue(enc.encode(chunk));
      } catch {
        closed = true;
      }
    }

    function onUpdate(payload: { mediaId: number; ts: number }) {
      send(`data: ${JSON.stringify(payload)}\n\n`);
    }

    libraryEventBus.on("update", onUpdate);
    const heartbeat = setInterval(() => send(": ping\n\n"), 15_000);

    request.signal.addEventListener("abort", () => {
      closed = true;
      libraryEventBus.off("update", onUpdate);
      clearInterval(heartbeat);
      try {
        controller.close();
      } catch (e) {
        console.warn("[library SSE] controller.close on abort:", e);
      }
    });

    send(`data: ${JSON.stringify({ connected: true, ts: Date.now() })}\n\n`);

    return new Response(stream);
  })

  // POST /api/library — add item by TMDB ID
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const { tmdb_id, type } = body;
        if (type !== "movie" && type !== "show") {
          return badRequest(set, "type must be 'movie' or 'show'");
        }
        try {
          const item = await addOrUpdateLibraryFromTmdb({ tmdb_id, type });
          await deleteCache(TMDB_UPCOMING_CACHE_KEY);
          return { item: mapLibraryMedia(item) };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg === "TMDB is not configured") {
            return badRequest(set, msg);
          }
          throw e;
        }
      } catch (err) {
        console.error("Library add error:", err);
        return serverError(set, "Failed to add item to library");
      }
    },
    {
      body: t.Object({
        tmdb_id: t.Number(),
        type: t.Union([t.Literal("movie"), t.Literal("show")]),
      }),
    },
  )

  // DELETE /api/library/:id — remove item (cascade deletes episodes + files)
  // ?delete_files=true also removes hardlinked/moved files from disk
  .delete(
    "/:id",
    async ({ params, query, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const existing = await prisma.libraryMedia.findUnique({
          where: { id },
          include: {
            files: { select: { filePath: true } },
            downloadHistories: {
              select: { postProcessDestinationPath: true },
            },
          },
        });
        if (!existing) return notFound(set, "Library item not found");

        if (query.delete_files === "true") {
          const { rm } = await import("node:fs/promises");
          const paths = new Set<string>();
          for (const f of existing.files) paths.add(f.filePath);
          for (const dh of existing.downloadHistories) {
            if (dh.postProcessDestinationPath)
              paths.add(dh.postProcessDestinationPath);
          }
          await Promise.allSettled(
            [...paths].map((p) => rm(p, { force: true })),
          );
        }

        // Delete download history explicitly (onDelete: SetNull keeps orphans)
        await prisma.downloadHistory.deleteMany({ where: { mediaId: id } });
        // Cascade deletes episodes + MediaFile records
        await prisma.libraryMedia.delete({ where: { id } });
        return { success: true };
      } catch {
        return serverError(set, "Failed to remove library item");
      }
    },
    {
      query: t.Object({
        delete_files: t.Optional(t.String()),
      }),
    },
  )

  // PATCH /api/library/:id/status — update status
  .patch(
    "/:id/status",
    async ({ params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const item = await prisma.libraryMedia.update({
          where: { id },
          data: {
            status: body.status,
            ...(body.status === "wanted" ? { searchAttempts: 0 } : {}),
          },
          include: libraryMediaInclude,
        });
        return { item: mapLibraryMedia(item) };
      } catch {
        return serverError(set, "Failed to update status");
      }
    },
    {
      body: t.Object({
        status: t.Union([
          t.Literal("wanted"),
          t.Literal("downloading"),
          t.Literal("downloaded"),
          t.Literal("skipped"),
        ]),
      }),
    },
  )

  // PATCH /api/library/:id/episodes/:episodeId/status — reset episode status (e.g. retry skipped)
  .patch(
    "/:id/episodes/:episodeId/status",
    async ({ params, body, set }) => {
      try {
        const mediaId = parseInt(params.id, 10);
        const episodeId = parseInt(params.episodeId, 10);
        const ep = await prisma.libraryEpisode.update({
          where: { id: episodeId, mediaId },
          data: {
            status: body.status,
            ...(body.status === "wanted" ? { searchAttempts: 0 } : {}),
          },
        });
        return {
          episode: {
            id: ep.id,
            status: ep.status,
            search_attempts: ep.searchAttempts,
          },
        };
      } catch {
        return serverError(set, "Failed to update episode status");
      }
    },
    {
      body: t.Object({
        status: t.Union([
          t.Literal("wanted"),
          t.Literal("downloading"),
          t.Literal("downloaded"),
          t.Literal("skipped"),
        ]),
      }),
    },
  )

  // POST /api/library/:id/seasons/:season/retry-skipped — reset all skipped episodes in a season
  .post("/:id/seasons/:season/retry-skipped", async ({ params, set }) => {
    try {
      const mediaId = parseInt(params.id, 10);
      const season = parseInt(params.season, 10);
      const result = await prisma.libraryEpisode.updateMany({
        where: { mediaId, season, status: "skipped" },
        data: { status: "wanted", searchAttempts: 0 },
      });
      return { retried: result.count };
    } catch {
      return serverError(set, "Failed to retry skipped episodes");
    }
  })

  // POST /api/library/:id/seasons/:season/search — auto-grab best season pack
  .post(
    "/:id/seasons/:season/search",
    async ({ params, body, set }) => {
      try {
        const mediaId = parseInt(params.id, 10);
        const season = parseInt(params.season, 10);

        const media = await prisma.libraryMedia.findUnique({
          where: { id: mediaId },
        });
        if (!media) return notFound(set, "Library item not found");
        if (media.type !== "show") {
          return badRequest(set, "Season search only applies to TV shows");
        }

        const downloadingCount = await prisma.libraryEpisode.count({
          where: { mediaId, season, status: "downloading" },
        });
        if (downloadingCount > 0) {
          return badRequest(
            set,
            "One or more episodes in this season are already downloading",
          );
        }

        // Manual search resets skipped episodes so users can retry without being blocked.
        await prisma.libraryEpisode.updateMany({
          where: { mediaId, season, status: "skipped" },
          data: { status: "wanted", searchAttempts: 0 },
        });

        const wantedEpisodes = await prisma.libraryEpisode.findMany({
          where: { mediaId, season, status: "wanted" },
        });
        if (wantedEpisodes.length === 0) {
          return badRequest(set, "No wanted episodes in this season");
        }

        const s = String(season).padStart(2, "0");
        const defaultQ = `${media.title} S${s}`;
        const q = body.search_query?.trim() || defaultQ;

        const result = await searchAndGrab({
          mediaId,
          mediaType: "tv",
          searchQuery: q,
          qualityProfileId: media.qualityProfileId,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        return { grabbed: false, reason: result.reason };
      } catch (err) {
        console.error("Library season search error:", err);
        return serverError(set, "Search failed");
      }
    },
    {
      body: t.Object({
        search_query: t.Optional(t.String({ maxLength: 400 })),
      }),
    },
  )

  // PATCH /api/library/:id/monitored — toggle monitoring for a movie or show
  .patch(
    "/:id/monitored",
    async ({ params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const item = await prisma.libraryMedia.update({
          where: { id },
          data: { monitored: body.monitored },
          include: libraryMediaInclude,
        });
        return { item: mapLibraryMedia(item) };
      } catch {
        return serverError(set, "Failed to update monitored status");
      }
    },
    { body: t.Object({ monitored: t.Boolean() }) },
  )

  // PATCH /api/library/:id/episodes/:episodeId/monitored — toggle monitoring for an episode
  .patch(
    "/:id/episodes/:episodeId/monitored",
    async ({ params, body, set }) => {
      try {
        const mediaId = parseInt(params.id, 10);
        const episodeId = parseInt(params.episodeId, 10);
        const ep = await prisma.libraryEpisode.update({
          where: { id: episodeId, mediaId },
          data: { monitored: body.monitored },
        });
        return {
          episode: {
            id: ep.id,
            monitored: ep.monitored,
          },
        };
      } catch {
        return serverError(set, "Failed to update episode monitored status");
      }
    },
    { body: t.Object({ monitored: t.Boolean() }) },
  )

  // PATCH /api/library/:id/seasons/:season/monitored — bulk toggle monitoring for a season
  .patch(
    "/:id/seasons/:season/monitored",
    async ({ params, body, set }) => {
      try {
        const mediaId = parseInt(params.id, 10);
        const season = parseInt(params.season, 10);
        const result = await prisma.libraryEpisode.updateMany({
          where: { mediaId, season },
          data: { monitored: body.monitored },
        });
        return { updated: result.count };
      } catch {
        return serverError(set, "Failed to update season monitored status");
      }
    },
    { body: t.Object({ monitored: t.Boolean() }) },
  )

  // PATCH /api/library/:id/quality-profile
  .patch(
    "/:id/quality-profile",
    async ({ params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const existing = await prisma.libraryMedia.findUnique({
          where: { id },
        });
        if (!existing) return notFound(set, "Library item not found");

        let newProfile: Awaited<
          ReturnType<typeof prisma.qualityProfile.findUnique>
        > | null = null;
        if (body.quality_profile_id != null) {
          newProfile = await prisma.qualityProfile.findUnique({
            where: { id: body.quality_profile_id },
          });
          if (!newProfile) {
            return badRequest(set, "Quality profile not found");
          }
        }

        const item = await prisma.libraryMedia.update({
          where: { id },
          data: { qualityProfileId: body.quality_profile_id },
          include: libraryMediaInclude,
        });

        // Detect whether existing files fail the new profile
        let needs_upgrade = false;
        let affected_episodes: number | undefined = undefined;

        const profileChanged =
          body.quality_profile_id !== existing.qualityProfileId;
        if (
          profileChanged &&
          existing.status === "downloaded" &&
          newProfile != null
        ) {
          const profileInput = profileToScoreInput(newProfile);

          const fileSelect = {
            episodeId: true,
            resolution: true,
            source: true,
            videoCodec: true,
            hdrFormat: true,
            sizeBytes: true,
            languageTags: true,
          } as const;

          if (existing.type === "movie") {
            const files = await prisma.mediaFile.findMany({
              where: { mediaId: id, episodeId: null },
              select: fileSelect,
            });
            needs_upgrade = filesFailProfile(files, profileInput);
          } else {
            // show — check each downloaded episode
            const episodes = await prisma.libraryEpisode.findMany({
              where: { mediaId: id, status: "downloaded" },
              select: { id: true },
            });

            // Bulk fetch all files for these episodes in one query
            const episodeIds = episodes.map((ep) => ep.id);
            const allFiles = await prisma.mediaFile.findMany({
              where: { episodeId: { in: episodeIds } },
              select: fileSelect,
            });

            // Group files by episodeId
            const byEpisode = new Map<number, typeof allFiles>();
            for (const f of allFiles) {
              if (f.episodeId == null) continue;
              const bucket = byEpisode.get(f.episodeId) ?? [];
              bucket.push(f);
              byEpisode.set(f.episodeId, bucket);
            }

            let failCount = 0;
            for (const ep of episodes) {
              const files = byEpisode.get(ep.id) ?? [];
              if (filesFailProfile(files, profileInput)) failCount++;
            }

            if (failCount > 0) {
              needs_upgrade = true;
              affected_episodes = failCount;
            }
          }
        }

        return {
          item: {
            ...mapLibraryMedia(item),
            ...(needs_upgrade ? { needs_upgrade: true } : {}),
            ...(affected_episodes !== undefined ? { affected_episodes } : {}),
          },
        };
      } catch {
        return serverError(set, "Failed to update quality profile");
      }
    },
    {
      body: t.Object({
        quality_profile_id: t.Union([t.Number(), t.Null()]),
      }),
    },
  )

  // POST /api/library/:id/upgrade
  .post(
    "/:id/upgrade",
    async ({ params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) return badRequest(set, "Invalid library id");

        if (body.mode === "manual") {
          return { queued: false, mode: "manual" as const };
        }

        // mode === "auto"
        const media = await prisma.libraryMedia.findUnique({
          where: { id },
          select: { id: true, type: true, status: true },
        });
        if (!media) return notFound(set, "Library item not found");

        if (media.type === "movie") {
          await prisma.libraryMedia.update({
            where: { id },
            data: { status: "upgrading" },
          });
          await addJob(
            QUEUE_NAMES.SCHEDULED_TASKS,
            SCHEDULED_JOB_NAMES.UPGRADE_MEDIA_SEARCH,
            { mediaId: id, episodeId: null },
          );
          return { queued: true, mode: "auto" as const, count: 1 };
        } else {
          // show — upgrade all downloaded episodes
          const episodes = await prisma.libraryEpisode.findMany({
            where: { mediaId: id, status: "downloaded" },
            select: { id: true },
          });

          await prisma.libraryEpisode.updateMany({
            where: { id: { in: episodes.map((ep) => ep.id) } },
            data: { status: "upgrading" },
          });

          await Promise.all(
            episodes.map((ep) =>
              addJob(
                QUEUE_NAMES.SCHEDULED_TASKS,
                SCHEDULED_JOB_NAMES.UPGRADE_MEDIA_SEARCH,
                { mediaId: id, episodeId: ep.id },
              ),
            ),
          );

          return {
            queued: true,
            mode: "auto" as const,
            count: episodes.length,
          };
        }
      } catch {
        return serverError(set, "Failed to enqueue upgrade");
      }
    },
    {
      body: t.Object({
        mode: t.Union([t.Literal("auto"), t.Literal("manual")]),
      }),
    },
  )

  // GET /api/library/:id/episodes — episodes grouped by season
  .get("/:id/episodes", async ({ params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const media = await prisma.libraryMedia.findUnique({ where: { id } });
      if (!media) return notFound(set, "Library item not found");

      const episodes = await prisma.libraryEpisode.findMany({
        where: { mediaId: id },
        orderBy: [{ season: "asc" }, { episode: "asc" }],
      });

      const bySeason = new Map<number, typeof episodes>();
      for (const ep of episodes) {
        if (!bySeason.has(ep.season)) bySeason.set(ep.season, []);
        bySeason.get(ep.season)!.push(ep);
      }

      return {
        seasons: Array.from(bySeason.entries()).map(([seasonNumber, eps]) => ({
          season: seasonNumber,
          episodes: eps.map((ep) => ({
            id: ep.id,
            season: ep.season,
            episode: ep.episode,
            title: ep.title,
            air_date: ep.airDate?.toISOString().slice(0, 10) ?? null,
            status: ep.status,
            monitored: ep.monitored,
            tmdb_episode_id: ep.tmdbEpisodeId,
            downloaded_at: ep.downloadedAt?.toISOString() ?? null,
            search_attempts: ep.searchAttempts,
          })),
        })),
      };
    } catch {
      return serverError(set, "Failed to fetch episodes");
    }
  })

  // GET /api/library/:id/downloads — Prowlarr/qBittorrent grab history
  .get("/:id/downloads", async ({ params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const media = await prisma.libraryMedia.findUnique({ where: { id } });
      if (!media) return notFound(set, "Library item not found");

      const items = await prisma.downloadHistory.findMany({
        where: { mediaId: id },
        orderBy: { grabbedAt: "desc" },
      });

      return {
        items: items.map((h) => ({
          id: h.id,
          release_title: h.releaseTitle,
          indexer: h.indexer,
          torrent_hash: h.torrentHash,
          grabbed_at: h.grabbedAt.toISOString(),
          completed_at: h.completedAt?.toISOString() ?? null,
          failed: h.failed,
          fail_reason: h.failReason,
          episode_id: h.episodeId,
          post_process_error: h.postProcessError,
          post_process_destination_path: h.postProcessDestinationPath,
        })),
      };
    } catch {
      return serverError(set, "Failed to fetch download history");
    }
  })

  // POST /api/library/downloads/:dhId/retry-post-process — re-run post-processing for a completed download
  .post("/downloads/:dhId/retry-post-process", async ({ params, set }) => {
    try {
      const dhId = parseInt(params.dhId, 10);
      if (isNaN(dhId)) return badRequest(set, "Invalid download history id");

      const dh = await prisma.downloadHistory.findUnique({
        where: { id: dhId },
        select: { id: true, completedAt: true, failed: true },
      });
      if (!dh) return notFound(set, "Download history not found");
      if (dh.failed) return badRequest(set, "Download is marked as failed");
      if (!dh.completedAt) return badRequest(set, "Download not yet completed");

      const { enqueueLibraryPostProcess } =
        await import("@hously/api/services/postProcessor");
      enqueueLibraryPostProcess(dhId);
      return { queued: true, download_history_id: dhId };
    } catch {
      return serverError(set, "Failed to queue post-processing");
    }
  })

  // POST /api/library/:id/grab — interactive grab (known download URL → qB + history)
  .post(
    "/:id/grab",
    async ({ params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const media = await prisma.libraryMedia.findUnique({ where: { id } });
        if (!media) return notFound(set, "Library item not found");
        // For shows, episode-level status governs grabs — don't gate on media status
        if (media.type === "movie" && media.status === "downloading") {
          return badRequest(
            set,
            "This item cannot be grabbed in its current state",
          );
        }

        const episodeId = body.episode_id ?? undefined;

        const result = await grabRelease({
          mediaId: id,
          episodeId,
          downloadUrl: body.download_url,
          releaseTitle: body.release_title,
          indexer: body.indexer ?? null,
          qualityParsed: body.quality_parsed,
          isUpgrade: body.is_upgrade ?? false,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        return { grabbed: false, reason: result.reason };
      } catch (err) {
        console.error("Library grab error:", err);
        return serverError(set, "Grab failed");
      }
    },
    {
      body: t.Object({
        download_url: t.String({ maxLength: 8192 }),
        release_title: t.String({ maxLength: 500 }),
        indexer: t.Optional(t.String({ maxLength: 200 })),
        quality_parsed: t.Optional(t.Any()),
        size_bytes: t.Optional(t.Union([t.Number(), t.Null()])),
        episode_id: t.Optional(t.Union([t.Number(), t.Null()])),
        is_upgrade: t.Optional(t.Boolean()),
      }),
    },
  )

  // POST /api/library/:id/search — manual Prowlarr search + grab (movies)
  .post(
    "/:id/search",
    async ({ params, body, set }) => {
      try {
        const id = parseInt(params.id, 10);
        const media = await prisma.libraryMedia.findUnique({ where: { id } });
        if (!media) return notFound(set, "Library item not found");
        if (media.type !== "movie") {
          return badRequest(set, "Search is only available for movies");
        }
        if (media.status === "downloading") {
          return badRequest(
            set,
            "This item cannot be grabbed in its current state",
          );
        }

        // Manual search resets counter + status so users can always retry.
        await prisma.libraryMedia.update({
          where: { id },
          data: { searchAttempts: 0, status: "wanted" },
        });

        const q =
          body.search_query?.trim() ||
          (media.year ? `${media.title} ${media.year}` : media.title);

        const result = await searchAndGrab({
          mediaId: id,
          mediaType: "movie",
          searchQuery: q,
          qualityProfileId: media.qualityProfileId,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        return { grabbed: false, reason: result.reason };
      } catch (err) {
        console.error("Library search error:", err);
        return serverError(set, "Search failed");
      }
    },
    {
      body: t.Object({
        search_query: t.Optional(t.String({ maxLength: 400 })),
      }),
    },
  )

  // POST /api/library/:id/episodes/:episodeId/search — episode grab (shows)
  .post(
    "/:id/episodes/:episodeId/search",
    async ({ params, body, set }) => {
      try {
        const mediaId = parseInt(params.id, 10);
        const episodeId = parseInt(params.episodeId, 10);

        const media = await prisma.libraryMedia.findUnique({
          where: { id: mediaId },
        });
        if (!media) return notFound(set, "Library item not found");
        if (media.type !== "show") {
          return badRequest(set, "Episode search only applies to TV shows");
        }

        const ep = await prisma.libraryEpisode.findFirst({
          where: { id: episodeId, mediaId },
        });
        if (!ep) return notFound(set, "Episode not found");

        if (ep.status === "downloading") {
          return badRequest(
            set,
            "This episode cannot be grabbed in its current state",
          );
        }

        // Manual search resets counter + status so users can always retry.
        await prisma.libraryEpisode.update({
          where: { id: episodeId },
          data: { searchAttempts: 0, status: "wanted" },
        });

        const s = String(ep.season).padStart(2, "0");
        const e = String(ep.episode).padStart(2, "0");
        const defaultQ = `${media.title} S${s}E${e}`;
        const q = body.search_query?.trim() || defaultQ;

        const result = await searchAndGrab({
          mediaId,
          episodeId,
          mediaType: "tv",
          searchQuery: q,
          qualityProfileId: media.qualityProfileId,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        return { grabbed: false, reason: result.reason };
      } catch (err) {
        console.error("Library episode search error:", err);
        return serverError(set, "Search failed");
      }
    },
    {
      body: t.Object({
        search_query: t.Optional(t.String({ maxLength: 400 })),
      }),
    },
  )

  // GET /api/library/:id/files — file metadata for a library item
  .get("/:id/files", async ({ params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const media = await prisma.libraryMedia.findUnique({ where: { id } });
      if (!media) return notFound(set, "Library item not found");

      const files = await prisma.mediaFile.findMany({
        where: { mediaId: id },
        include: {
          episode: { select: { season: true, episode: true, title: true } },
        },
      });

      // Sort: episodes by season → episode number; non-episode files by filename
      files.sort((a, b) => {
        const ae = a.episode,
          be = b.episode;
        if (ae && be) {
          if (ae.season !== be.season) return ae.season - be.season;
          return ae.episode - be.episode;
        }
        if (ae) return 1;
        if (be) return -1;
        return a.fileName.localeCompare(b.fileName);
      });

      return {
        media_type: media.type,
        files: files.map((f) => ({
          id: f.id,
          file_name: f.fileName,
          file_path: f.filePath,
          size_bytes: f.sizeBytes.toString(),
          duration_secs: f.durationSecs,
          release_group: f.releaseGroup,
          video_codec: f.videoCodec,
          video_profile: f.videoProfile,
          width: f.width,
          height: f.height,
          frame_rate: f.frameRate,
          bit_depth: f.bitDepth,
          video_bitrate: f.videoBitrate,
          hdr_format: f.hdrFormat,
          resolution: f.resolution,
          source: f.source,
          audio_tracks: f.audioTracks,
          subtitle_tracks: f.subtitleTracks,
          scanned_at: f.scannedAt.toISOString(),
          season: f.episode?.season ?? null,
          episode: f.episode?.episode ?? null,
          episode_title: f.episode?.title ?? null,
        })),
      };
    } catch {
      return serverError(set, "Failed to fetch file info");
    }
  })

  // POST /api/library/:id/rescan — re-scan MediaInfo for all files of a library item
  .post("/:id/rescan", async ({ params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const result = await rescanLibraryItem(id);
      if (!result) return notFound(set, "Library item not found");
      return {
        rescanned: result.rescanned,
        failed: result.failed,
        deleted: result.deleted,
        imported: result.imported,
        requeued: result.requeued,
      };
    } catch {
      return serverError(set, "Failed to rescan files");
    }
  })

  // DELETE /api/library/files/:fileId — remove a single MediaFile record
  // ?delete_file=true also removes the physical file from disk
  .delete(
    "/files/:fileId",
    async ({ params, query, set }) => {
      try {
        const fileId = parseInt(params.fileId, 10);
        if (!Number.isFinite(fileId)) return badRequest(set, "Invalid file id");

        const file = await prisma.mediaFile.findUnique({
          where: { id: fileId },
        });
        if (!file) return notFound(set, "File not found");

        if (query.delete_file === "true") {
          const { rm } = await import("node:fs/promises");
          try {
            await rm(file.filePath);
          } catch {
            // ignore — file may already be gone
          }
        }

        await prisma.mediaFile.delete({ where: { id: fileId } });

        // If the parent media item now has no files left, reset it to "wanted"
        if (file.mediaId !== null) {
          const remaining = await prisma.mediaFile.count({
            where: { mediaId: file.mediaId },
          });
          if (remaining === 0) {
            await prisma.libraryMedia.updateMany({
              where: {
                id: file.mediaId,
                status: { notIn: ["wanted", "skipped"] },
              },
              data: { status: "wanted", searchAttempts: 0 },
            });
          }
        }

        return { success: true };
      } catch {
        return serverError(set, "Failed to delete file");
      }
    },
    {
      query: t.Object({
        delete_file: t.Optional(t.String()),
      }),
    },
  )

  // DELETE /api/library/:id/episodes/:episodeId — remove all files for an episode
  // and reset it to "wanted". ?delete_file=true also removes files from disk.
  .delete(
    "/:id/episodes/:episodeId",
    async ({ params, query, set }) => {
      try {
        const mediaId = parseInt(params.id, 10);
        const episodeId = parseInt(params.episodeId, 10);
        if (!Number.isFinite(mediaId) || !Number.isFinite(episodeId)) {
          return badRequest(set, "Invalid id");
        }

        const ep = await prisma.libraryEpisode.findFirst({
          where: { id: episodeId, mediaId },
          include: { files: true },
        });
        if (!ep) return notFound(set, "Episode not found");

        if (query.delete_file === "true" && ep.files.length > 0) {
          const { rm } = await import("node:fs/promises");
          for (const f of ep.files) {
            try {
              await rm(f.filePath);
            } catch {
              // ignore — file may already be gone
            }
          }
        }

        if (ep.files.length > 0) {
          await prisma.mediaFile.deleteMany({ where: { episodeId } });
        }

        await prisma.libraryEpisode.update({
          where: { id: episodeId },
          data: { status: "wanted", searchAttempts: 0, downloadedAt: null },
        });

        const remainingFiles = await prisma.mediaFile.count({
          where: { mediaId },
        });
        if (remainingFiles === 0) {
          await prisma.libraryMedia.updateMany({
            where: {
              id: mediaId,
              status: { notIn: ["wanted", "skipped"] },
            },
            data: { status: "wanted", searchAttempts: 0 },
          });
        }

        return { success: true };
      } catch {
        return serverError(set, "Failed to delete episode");
      }
    },
    {
      query: t.Object({
        delete_file: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/library/item/:id — single library item (integrations / c411-manager)
  .get("/item/:id", async ({ params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      if (!Number.isFinite(id)) return badRequest(set, "Invalid id");
      const item = await prisma.libraryMedia.findUnique({
        where: { id },
        include: libraryMediaInclude,
      });
      if (!item) return notFound(set, "Library item not found");
      return { item: mapLibraryMedia(item) };
    } catch {
      return serverError(set, "Failed to fetch library item");
    }
  })

  // GET /api/library/download-history — global paginated download history
  .get(
    "/download-history",
    async ({ query, set }) => {
      try {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(100, Math.max(1, query.limit ?? 25));
        const { status, days } = query;

        const where: Record<string, unknown> = {};
        if (status === "completed") {
          Object.assign(where, { completedAt: { not: null }, failed: false });
        } else if (status === "failed") {
          where.failed = true;
        } else if (status === "active") {
          Object.assign(where, { completedAt: null, failed: false });
        }
        if (days && days > 0) {
          where.grabbedAt = {
            gte: new Date(Date.now() - days * 86_400_000),
          };
        }

        const [items, total] = await Promise.all([
          prisma.downloadHistory.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { grabbedAt: "desc" },
            include: {
              media: { select: { id: true, title: true, type: true } },
            },
          }),
          prisma.downloadHistory.count({ where }),
        ]);

        return {
          items: items.map((h) => ({
            id: h.id,
            release_title: h.releaseTitle,
            indexer: h.indexer,
            torrent_hash: h.torrentHash,
            grabbed_at: h.grabbedAt.toISOString(),
            completed_at: h.completedAt?.toISOString() ?? null,
            failed: h.failed,
            fail_reason: h.failReason,
            episode_id: h.episodeId,
            post_process_error: h.postProcessError,
            post_process_destination_path: h.postProcessDestinationPath,
            media_id: h.mediaId,
            media_title: h.media?.title ?? null,
            media_type: h.media?.type ?? null,
          })),
          total,
          page,
          limit,
          has_more: page * limit < total,
        };
      } catch {
        return serverError(set, "Failed to fetch download history");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Number()),
        limit: t.Optional(t.Number()),
        status: t.Optional(
          t.Union([
            t.Literal("all"),
            t.Literal("completed"),
            t.Literal("failed"),
            t.Literal("active"),
          ]),
        ),
        days: t.Optional(t.Number()),
      }),
    },
  )

  // GET /api/library/download-history/stats — aggregate grab analytics
  .get("/download-history/stats", async ({ set }) => {
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);

      const [total, completed, failed, byIndexer, recentGrabs] =
        await Promise.all([
          prisma.downloadHistory.count(),
          prisma.downloadHistory.count({
            where: { completedAt: { not: null }, failed: false },
          }),
          prisma.downloadHistory.count({ where: { failed: true } }),
          prisma.downloadHistory.groupBy({
            by: ["indexer"],
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 5,
          }),
          prisma.downloadHistory.findMany({
            where: { grabbedAt: { gte: fourteenDaysAgo } },
            select: { grabbedAt: true },
          }),
        ]);

      const active = Math.max(0, total - completed - failed);
      const successRate =
        completed + failed > 0
          ? Math.round((completed / (completed + failed)) * 100)
          : null;

      // Build last-14-days sparkline
      const dayMap = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86_400_000);
        dayMap.set(d.toISOString().slice(0, 10), 0);
      }
      for (const g of recentGrabs) {
        const key = g.grabbedAt.toISOString().slice(0, 10);
        if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
      }

      return {
        stats: {
          total_grabs: total,
          completed_grabs: completed,
          failed_grabs: failed,
          active_grabs: active,
          success_rate: successRate,
          top_indexers: byIndexer.map((r) => ({
            name: r.indexer ?? "Unknown",
            count: r._count.id,
          })),
          grabs_by_day: Array.from(dayMap.entries()).map(([date, count]) => ({
            date,
            count,
          })),
        },
      };
    } catch {
      return serverError(set, "Failed to fetch download history stats");
    }
  })

  // GET /api/library/rss-status — last RSS run result + next scheduled run
  .get("/rss-status", async ({ set }) => {
    try {
      const [lastRun, history, repeatableJobs] = await Promise.all([
        getLastRssRun(),
        getRssRunHistory(),
        scheduledTasksQueue.getRepeatableJobs(),
      ]);
      const rssJob = repeatableJobs.find(
        (j) => j.name === SCHEDULED_JOB_NAMES.POLL_INDEXER_RSS,
      );
      const bullNext = rssJob?.next ? new Date(rssJob.next) : null;
      const now = new Date();
      // BullMQ's sorted set can hold stale timestamps after restarts.
      // If the stored next-run is in the past, compute the real next
      // */15 boundary from the current time.
      const nextRunAt =
        bullNext && bullNext > now
          ? bullNext.toISOString()
          : (() => {
              const mins = now.getUTCMinutes();
              const nextMins = Math.ceil((mins + 1) / 15) * 15;
              return new Date(
                Date.UTC(
                  now.getUTCFullYear(),
                  now.getUTCMonth(),
                  now.getUTCDate(),
                  now.getUTCHours() + Math.floor(nextMins / 60),
                  nextMins % 60,
                  0,
                  0,
                ),
              ).toISOString();
            })();
      return {
        server_time: new Date().toISOString(),
        last_run: lastRun,
        history,
        next_run_at: nextRunAt,
      };
    } catch {
      return serverError(set, "Failed to fetch RSS status");
    }
  })

  // POST /api/library/migrate — enqueue import job (admin only)
  .post(
    "/migrate",
    async ({ body, user, set }) => {
      if (!user?.is_admin) return badRequest(set, "Admin access required");

      const { source, radarr_url, radarr_api_key, sonarr_url, sonarr_api_key } =
        body;

      try {
        // Use a fixed jobId so BullMQ atomically deduplicates concurrent requests.
        // If a job with this ID is already waiting or active, BullMQ returns the
        // existing job rather than creating a duplicate.
        const job = await libraryMigrateQueue.add(
          "library-migrate",
          {
            source,
            requested_by: user!.id,
            radarr_url: radarr_url?.trim() || undefined,
            radarr_api_key: radarr_api_key?.trim() || undefined,
            sonarr_url: sonarr_url?.trim() || undefined,
            sonarr_api_key: sonarr_api_key?.trim() || undefined,
          },
          { jobId: "library-migrate-singleton" },
        );
        const state = await job?.getState();
        if (state === "active" || state === "waiting") {
          return badRequest(set, "A migration job is already running");
        }
        return { job_id: job?.id };
      } catch {
        return serverError(set, "Failed to enqueue migration job");
      }
    },
    {
      body: t.Object({
        source: t.Union([
          t.Literal("radarr"),
          t.Literal("sonarr"),
          t.Literal("both"),
        ]),
        radarr_url: t.Optional(t.String()),
        radarr_api_key: t.Optional(t.String()),
        sonarr_url: t.Optional(t.String()),
        sonarr_api_key: t.Optional(t.String()),
      }),
    },
  )

  // GET /api/library/migrate/status — SSE stream for the latest migration job
  .get("/migrate/status", ({ request }) => {
    return createJsonSseResponse({
      request,
      logLabel: "LibraryMigrate",
      intervalMs: (data) => {
        // Poll faster while active, slower when done/unknown
        if ((data as { state?: string })?.state === "active") return 1500;
        return 3000;
      },
      poll: async () => {
        // Find the most recent migration job (completed, active, waiting, or failed)
        const [active, waiting, completed, failed] = await Promise.all([
          libraryMigrateQueue.getJobs(["active"]),
          libraryMigrateQueue.getJobs(["waiting"]),
          libraryMigrateQueue.getJobs(["completed"], 0, 1, false),
          libraryMigrateQueue.getJobs(["failed"], 0, 1, false),
        ]);

        const job =
          active[0] ?? waiting[0] ?? completed[0] ?? failed[0] ?? null;

        if (!job) {
          return {
            state: "unknown",
            job_id: null,
            progress: null,
            result: null,
            error: null,
            started_at: null,
            finished_at: null,
          };
        }

        const state = await job.getState();
        const progress =
          (job.progress as LibraryMigrateProgress | null | number) ?? null;
        const typedProgress =
          typeof progress === "object" && progress !== null
            ? (progress as LibraryMigrateProgress)
            : null;

        return {
          job_id: job.id ?? null,
          state,
          progress: typedProgress,
          result: state === "completed" ? (job.returnvalue ?? null) : null,
          error: state === "failed" ? (job.failedReason ?? null) : null,
          started_at: job.processedOn
            ? new Date(job.processedOn).toISOString()
            : null,
          finished_at: job.finishedOn
            ? new Date(job.finishedOn).toISOString()
            : null,
        };
      },
    });
  });
