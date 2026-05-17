import { Elysia, t } from "elysia";

import { requireUser, resolveUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, serverError } from "@hously/api/errors";
import {
  addJob,
  libraryMigrateQueue,
  libraryReindexLanguagesQueue,
  libraryRemuxQueue,
  scheduledTasksQueue,
  QUEUE_NAMES,
  SCHEDULED_JOB_NAMES,
} from "@hously/api/services/queueService";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import type { LibraryMigrateProgress } from "@hously/api/services/jobs/libraryMigrateWorker";
import type { LibraryReindexLanguagesProgress } from "@hously/api/services/jobs/libraryReindexLanguagesWorker";
import type { LibraryRemuxJobData } from "@hously/api/services/jobs/libraryRemuxWorker";
import {
  getLastRssRun,
  getRssRunHistory,
} from "@hously/api/services/rssRunStatus";
import { libraryEventBus } from "@hously/api/services/libraryEvents";
import {
  listOpenLibraryAttentionForApi,
  dismissLibraryAttentionAlert,
} from "@hously/api/services/libraryAttention";
import { buildLibraryStatsResponse } from "./libraryStats";

/**
 * Background jobs, SSE stream, stats, attention, language tags, remux, migrate, RSS status.
 * GET /api/library/stats
 * GET /api/library/attention
 * PATCH /api/library/attention/:alertId/dismiss
 * GET /api/library/language-tags
 * POST /api/library/reindex-languages
 * GET /api/library/reindex-languages/status
 * GET /api/library/events (SSE)
 * GET /api/library/rss-status
 * POST /api/library/migrate
 * GET /api/library/migrate/status
 * POST /api/library/files/:fileId/remux
 * GET /api/library/files/:fileId/remux/status
 * GET /api/library/download-history
 * GET /api/library/download-history/stats
 */
export const libraryJobRoutes = new Elysia({ prefix: "/api/library" })
  .use(requireUser)

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

  .get("/attention", async ({ request, set }) => {
    const u = await resolveUser(request);
    if (!u) return ((set.status = 401), { error: "Unauthorized" });
    if (!u.is_admin) return ((set.status = 403), { error: "Forbidden" });
    try {
      return await listOpenLibraryAttentionForApi();
    } catch (error) {
      console.error("[library/attention]", error);
      return serverError(set, "Failed to fetch library attention");
    }
  })

  .patch(
    "/attention/:alertId/dismiss",
    async ({ request, params, set }) => {
      const u = await resolveUser(request);
      if (!u) return ((set.status = 401), { error: "Unauthorized" });
      if (!u.is_admin) return ((set.status = 403), { error: "Forbidden" });
      try {
        const alertId = parseInt(params.alertId, 10);
        if (!Number.isFinite(alertId))
          return badRequest(set, "Invalid alert id");
        const ok = await dismissLibraryAttentionAlert(alertId);
        if (!ok) return badRequest(set, "Alert not found or not open");
        return { success: true };
      } catch (error) {
        console.error("[library/attention/dismiss]", error);
        return serverError(set, "Failed to dismiss alert");
      }
    },
    {
      params: t.Object({ alertId: t.String() }),
    },
  )

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
  });
