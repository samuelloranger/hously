import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { libraryMigrateQueue } from "@hously/api/services/queueService";
import { createJsonSseResponse } from "@hously/api/utils/sse";
import type { LibraryMigrateProgress } from "@hously/api/services/jobs/libraryMigrateWorker";
import { scanMediaInfo } from "@hously/api/utils/medias/mediainfoScanner";
import {
  parseFilenameMetadata,
  parseReleaseTitle,
} from "@hously/api/utils/medias/filenameParser";
import {
  QBIT_CATEGORY_HOUSLY_MOVIES,
  QBIT_CATEGORY_HOUSLY_SHOWS,
} from "@hously/api/constants/libraryGrab";
import { grabRelease, searchAndGrab } from "@hously/api/services/mediaGrabber";
import { notifyAdminsLibraryGrabSkipped } from "@hously/api/workers/notifyLibraryGrabSkipped";
import { MAX_LIBRARY_GRAB_ATTEMPTS } from "@hously/api/constants/libraryGrab";
import { libraryEventBus } from "@hously/api/services/libraryEvents";
import { addOrUpdateLibraryFromTmdb } from "@hously/api/services/nativeLibraryFromTmdb";

function mapLibraryMedia(item: {
  id: number;
  tmdbId: number;
  type: string;
  title: string;
  sortTitle: string | null;
  year: number | null;
  status: string;
  posterUrl: string | null;
  overview: string | null;
  digitalReleaseDate: Date | null;
  qualityProfileId: number | null;
  searchAttempts: number;
  qualityProfile: { id: number; name: string } | null;
  downloadHistories?: { grabbedAt: Date }[];
  addedAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id,
    tmdb_id: item.tmdbId,
    type: item.type,
    title: item.title,
    sort_title: item.sortTitle,
    year: item.year,
    status: item.status,
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
  };
}

const libraryMediaInclude = {
  qualityProfile: { select: { id: true, name: true } },
  downloadHistories: {
    orderBy: { grabbedAt: "desc" as const },
    take: 1,
    select: { grabbedAt: true },
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
        const { type, status, q } = query;
        const titleFilter = q
          ? { title: { contains: q, mode: "insensitive" as const } }
          : {};
        const sharedWhere = {
          ...(status ? { status } : {}),
          ...titleFilter,
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
      }),
    },
  )

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
      } catch {}
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
        const validStatuses = [
          "wanted",
          "downloading",
          "downloaded",
          "skipped",
        ];
        if (!validStatuses.includes(body.status)) {
          return badRequest(
            set,
            `status must be one of: ${validStatuses.join(", ")}`,
          );
        }
        const item = await prisma.libraryMedia.update({
          where: { id },
          data: { status: body.status },
          include: libraryMediaInclude,
        });
        return { item: mapLibraryMedia(item) };
      } catch {
        return serverError(set, "Failed to update status");
      }
    },
    {
      body: t.Object({ status: t.String() }),
    },
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

        if (body.quality_profile_id != null) {
          const prof = await prisma.qualityProfile.findUnique({
            where: { id: body.quality_profile_id },
          });
          if (!prof) {
            return badRequest(set, "Quality profile not found");
          }
        }

        const item = await prisma.libraryMedia.update({
          where: { id },
          data: { qualityProfileId: body.quality_profile_id },
          include: libraryMediaInclude,
        });
        return { item: mapLibraryMedia(item) };
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

  // POST /api/library/:id/refresh-status — sync status from qBittorrent + disk
  // - If a MediaFile exists on disk → status = "downloaded"
  // - If a torrent is completed in qB → queue post-process (hardlink/move)
  // - If a torrent is still downloading → status = "downloading"
  // - If completed DH missed post-processing → re-queue it
  // - Otherwise → revert to "wanted"
  .post("/:id/refresh-status", async ({ params, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const media = await prisma.libraryMedia.findUnique({
        where: { id },
        include: {
          files: { select: { id: true, filePath: true } },
          downloadHistories: {
            where: { failed: false },
            orderBy: { grabbedAt: "desc" },
          },
        },
      });
      if (!media) return notFound(set, "Library item not found");

      // 0. Scan library destination folder for files on disk with no MediaFile record
      const { scanAndImportLibraryFiles } =
        await import("@hously/api/services/postProcessor");
      const scanned = await scanAndImportLibraryFiles(media);
      if (scanned > 0) {
        const updated = await prisma.libraryMedia.findUnique({
          where: { id },
          include: libraryMediaInclude,
        });
        return { item: mapLibraryMedia(updated!), detail: "files_imported" };
      }

      const { stat } = await import("node:fs/promises");

      // 1. Iterate ALL MediaFile records: delete stale ones, track if any valid file remains
      let hasValidFile = false;
      for (const f of media.files) {
        try {
          await stat(f.filePath);
          hasValidFile = true;
        } catch {
          // file missing — remove stale MediaFile record
          try {
            await prisma.mediaFile.delete({ where: { id: f.id } });
          } catch (deleteErr) {
            console.warn(
              `[refreshStatus] Failed to delete stale MediaFile ${f.id}:`,
              deleteErr,
            );
          }
        }
      }

      if (hasValidFile && media.status !== "downloaded") {
        await prisma.libraryMedia.update({
          where: { id },
          data: { status: "downloaded" },
        });
      }

      // 2. Check completed DH entries that missed post-processing → re-queue ALL of them
      const { enqueueLibraryPostProcess } =
        await import("@hously/api/services/postProcessor");
      let requeuedCount = 0;
      for (const dh of media.downloadHistories) {
        if (
          dh.completedAt &&
          !dh.postProcessDestinationPath &&
          !dh.postProcessError
        ) {
          enqueueLibraryPostProcess(dh.id);
          requeuedCount++;
        }
      }
      if (requeuedCount > 0) {
        const updated = await prisma.libraryMedia.findUnique({
          where: { id },
          include: libraryMediaInclude,
        });
        return {
          item: mapLibraryMedia(updated!),
          detail: "post_process_requeued",
        };
      }

      if (hasValidFile) {
        const updated = await prisma.libraryMedia.findUnique({
          where: { id },
          include: libraryMediaInclude,
        });
        return { item: mapLibraryMedia(updated!), detail: "file_on_disk" };
      }

      // 3. Check qBittorrent for pending torrents
      const { getQbittorrentPluginConfig } =
        await import("@hously/api/services/qbittorrent/config");
      const { fetchMaindata } =
        await import("@hously/api/services/qbittorrent/client");
      const {
        completeDownloadByHash,
        revertLibraryDownloadingIfNoOtherActiveGrabs,
        isCompletedDownloadState,
        isFailedState,
        markDownloadHistoryComplete,
      } = await import("@hously/api/workers/checkDownloadCompletion");

      const qb = await getQbittorrentPluginConfig();
      if (qb.enabled && qb.config) {
        const pendingDhs = media.downloadHistories.filter(
          (dh) => !dh.completedAt,
        );
        if (pendingDhs.length > 0) {
          try {
            const { torrents } = await fetchMaindata(qb.config);
            const byHash = new Map<string, Record<string, unknown>>();
            for (const [h, raw] of torrents) byHash.set(h.toLowerCase(), raw);

            let hasActiveDownload = false;
            for (const dh of pendingDhs) {
              if (!dh.torrentHash) continue;
              const raw = byHash.get(dh.torrentHash.toLowerCase());
              if (!raw) continue;

              const state = typeof raw.state === "string" ? raw.state : "";
              const progress =
                typeof raw.progress === "number" &&
                Number.isFinite(raw.progress)
                  ? raw.progress
                  : 0;

              if (isFailedState(state)) {
                await prisma.downloadHistory.update({
                  where: { id: dh.id },
                  data: {
                    failed: true,
                    failReason: `qBittorrent state: ${state}`,
                  },
                });
                await revertLibraryDownloadingIfNoOtherActiveGrabs(dh);
                continue;
              }

              if (isCompletedDownloadState(state) || progress >= 1) {
                let completedId: number | null = null;
                if (dh.torrentHash) {
                  completedId = await completeDownloadByHash(dh.torrentHash);
                }
                if (completedId == null) {
                  await markDownloadHistoryComplete(dh);
                  completedId = dh.id;
                }
                if (completedId != null) enqueueLibraryPostProcess(completedId);
                const updated = await prisma.libraryMedia.findUnique({
                  where: { id },
                  include: libraryMediaInclude,
                });
                return {
                  item: mapLibraryMedia(updated!),
                  detail: "post_process_queued",
                };
              } else {
                hasActiveDownload = true;
              }
            }

            if (hasActiveDownload) {
              if (media.status !== "downloading") {
                await prisma.libraryMedia.update({
                  where: { id },
                  data: { status: "downloading" },
                });
              }
              const updated = await prisma.libraryMedia.findUnique({
                where: { id },
                include: libraryMediaInclude,
              });
              return {
                item: mapLibraryMedia(updated!),
                detail: "still_downloading",
              };
            }
          } catch (e) {
            console.warn("[refreshStatus] qBittorrent check failed:", e);
          }
        }
      }

      // 4. Scan for untracked qBittorrent torrents by title matching
      //    Handles manually-added torrents that have no DownloadHistory entry.
      if (qb.enabled && qb.config) {
        try {
          const { torrents } = await fetchMaindata(qb.config);
          const knownHashes = new Set(
            media.downloadHistories
              .map((dh) => dh.torrentHash?.toLowerCase())
              .filter(Boolean),
          );

          const expectedCategory =
            media.type === "show"
              ? QBIT_CATEGORY_HOUSLY_SHOWS
              : QBIT_CATEGORY_HOUSLY_MOVIES;

          const normalize = (s: string) =>
            s
              .toLowerCase()
              .replace(/[^a-z0-9]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          const titleWords = normalize(media.title).split(" ").filter(Boolean);

          for (const [hash, raw] of torrents) {
            if (knownHashes.has(hash.toLowerCase())) continue;

            // Only consider torrents in the Hously category or tagged "hously"
            const torrentCategory =
              typeof raw.category === "string" ? raw.category : "";
            const torrentTags =
              typeof raw.tags === "string"
                ? raw.tags.split(",").map((t) => t.trim().toLowerCase())
                : [];
            const isHouslyOwned =
              torrentCategory === expectedCategory ||
              torrentTags.includes("hously");
            if (!isHouslyOwned) continue;

            const torrentName = typeof raw.name === "string" ? raw.name : "";
            if (!torrentName) continue;
            if (titleWords.length === 0) continue;
            const torrentWordSet = new Set(
              normalize(torrentName).split(" ").filter(Boolean),
            );
            if (!titleWords.every((w) => torrentWordSet.has(w))) continue;

            // Title match — link this torrent to the library item
            const state = typeof raw.state === "string" ? raw.state : "";
            const progress =
              typeof raw.progress === "number" && Number.isFinite(raw.progress)
                ? raw.progress
                : 0;

            const parsed = parseReleaseTitle(torrentName);
            const qualityParsed = {
              resolution: parsed.resolution,
              source: parsed.source,
              codec: parsed.codec,
              hdr: parsed.hdr,
            };

            const dh = await prisma.downloadHistory.create({
              data: {
                mediaId: id,
                releaseTitle: torrentName,
                torrentHash: hash.toLowerCase(),
                qualityParsed,
                completedAt:
                  isCompletedDownloadState(state) || progress >= 1
                    ? new Date()
                    : null,
              },
            });

            console.log(
              `[refreshStatus] Linked untracked torrent "${torrentName}" (${hash}) to library item ${id}`,
            );

            if (isCompletedDownloadState(state) || progress >= 1) {
              enqueueLibraryPostProcess(dh.id);
              const updated = await prisma.libraryMedia.findUnique({
                where: { id },
                include: libraryMediaInclude,
              });
              return {
                item: mapLibraryMedia(updated!),
                detail: "linked_and_post_process_queued",
              };
            } else {
              await prisma.libraryMedia.update({
                where: { id },
                data: { status: "downloading" },
              });
              const updated = await prisma.libraryMedia.findUnique({
                where: { id },
                include: libraryMediaInclude,
              });
              return {
                item: mapLibraryMedia(updated!),
                detail: "linked_downloading",
              };
            }
          }
        } catch (e) {
          console.warn("[refreshStatus] Untracked torrent scan failed:", e);
        }
      }

      // 5. Nothing found → revert to wanted
      if (media.status !== "wanted" && media.status !== "skipped") {
        await prisma.libraryMedia.update({
          where: { id },
          data: { status: "wanted", searchAttempts: 0 },
        });
      }
      const updated = await prisma.libraryMedia.findUnique({
        where: { id },
        include: libraryMediaInclude,
      });
      return { item: mapLibraryMedia(updated!), detail: "reverted_to_wanted" };
    } catch {
      return serverError(set, "Failed to refresh status");
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
        if (media.type === "movie") {
          if (
            media.status === "downloading" ||
            media.status === "downloaded" ||
            media.status === "skipped"
          ) {
            return badRequest(
              set,
              "This item cannot be grabbed in its current state",
            );
          }
          if (media.searchAttempts >= MAX_LIBRARY_GRAB_ATTEMPTS) {
            return badRequest(
              set,
              "Maximum search attempts reached; item was skipped",
            );
          }
        }

        const episodeId = body.episode_id ?? undefined;

        const result = await grabRelease({
          mediaId: id,
          episodeId,
          downloadUrl: body.download_url,
          releaseTitle: body.release_title,
          indexer: body.indexer ?? null,
          qualityParsed: body.quality_parsed,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        // Only increment media-level attempts for movies
        if (media.type === "movie") {
          const next = media.searchAttempts + 1;
          await prisma.libraryMedia.update({
            where: { id },
            data: { searchAttempts: next },
          });

          if (next >= MAX_LIBRARY_GRAB_ATTEMPTS) {
            await prisma.libraryMedia.update({
              where: { id },
              data: { status: "skipped" },
            });
            await notifyAdminsLibraryGrabSkipped(
              `Movie "${media.title}" (${id}) exceeded ${MAX_LIBRARY_GRAB_ATTEMPTS} failed grab attempts (${result.reason}). Status set to skipped.`,
            );
          }
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
        if (
          media.status === "downloading" ||
          media.status === "downloaded" ||
          media.status === "skipped"
        ) {
          return badRequest(
            set,
            "This item cannot be grabbed in its current state",
          );
        }
        if (media.searchAttempts >= MAX_LIBRARY_GRAB_ATTEMPTS) {
          return badRequest(
            set,
            "Maximum search attempts reached; item was skipped",
          );
        }

        const q =
          body.search_query?.trim() ||
          (media.year ? `${media.title} ${media.year}` : media.title);

        const result = await searchAndGrab({
          mediaId: id,
          searchQuery: q,
          qualityProfileId: media.qualityProfileId,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        const next = media.searchAttempts + 1;
        await prisma.libraryMedia.update({
          where: { id },
          data: { searchAttempts: next },
        });

        if (next >= MAX_LIBRARY_GRAB_ATTEMPTS) {
          await prisma.libraryMedia.update({
            where: { id },
            data: { status: "skipped" },
          });
          await notifyAdminsLibraryGrabSkipped(
            `Movie "${media.title}" (${id}) exceeded ${MAX_LIBRARY_GRAB_ATTEMPTS} failed grab attempts (${result.reason}). Status set to skipped.`,
          );
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

        if (
          ep.status === "downloading" ||
          ep.status === "downloaded" ||
          ep.status === "skipped"
        ) {
          return badRequest(
            set,
            "This episode cannot be grabbed in its current state",
          );
        }
        if (ep.searchAttempts >= MAX_LIBRARY_GRAB_ATTEMPTS) {
          return badRequest(
            set,
            "Maximum search attempts reached for this episode",
          );
        }

        const s = String(ep.season).padStart(2, "0");
        const e = String(ep.episode).padStart(2, "0");
        const defaultQ = `${media.title} S${s}E${e}`;
        const q = body.search_query?.trim() || defaultQ;

        const result = await searchAndGrab({
          mediaId,
          episodeId,
          searchQuery: q,
          qualityProfileId: media.qualityProfileId,
        });

        if (result.grabbed) {
          return { grabbed: true, release_title: result.releaseTitle };
        }

        const next = ep.searchAttempts + 1;
        await prisma.libraryEpisode.update({
          where: { id: episodeId },
          data: { searchAttempts: next },
        });

        if (next >= MAX_LIBRARY_GRAB_ATTEMPTS) {
          await prisma.libraryEpisode.update({
            where: { id: episodeId },
            data: { status: "skipped" },
          });
          await notifyAdminsLibraryGrabSkipped(
            `Episode "${media.title}" S${ep.season}E${ep.episode} (${episodeId}) exceeded ${MAX_LIBRARY_GRAB_ATTEMPTS} failed grab attempts (${result.reason}). Status set to skipped.`,
          );
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
      const media = await prisma.libraryMedia.findUnique({ where: { id } });
      if (!media) return notFound(set, "Library item not found");

      const files = await prisma.mediaFile.findMany({ where: { mediaId: id } });
      if (!files.length) return { rescanned: 0, failed: 0 };

      let rescanned = 0;
      let failed = 0;

      const { stat: statFile } = await import("node:fs/promises");

      for (const file of files) {
        const mi = await scanMediaInfo(file.filePath);
        if (!mi) {
          // Check if the file is actually gone; if so, clean up the stale record
          try {
            await statFile(file.filePath);
            failed++; // file exists but mediainfo couldn't read it
          } catch {
            await prisma.mediaFile.delete({ where: { id: file.id } });
            failed++;
          }
          continue;
        }

        const fnData = parseFilenameMetadata(file.fileName);
        await prisma.mediaFile.update({
          where: { id: file.id },
          data: {
            sizeBytes: mi.sizeBytes,
            durationSecs: mi.durationSecs,
            releaseGroup: file.releaseGroup ?? mi.releaseGroup,
            videoCodec: mi.videoCodec,
            videoProfile: mi.videoProfile,
            width: mi.width,
            height: mi.height,
            frameRate: mi.frameRate,
            bitDepth: mi.bitDepth,
            videoBitrate: mi.videoBitrate,
            hdrFormat: mi.hdrFormat ?? fnData.hdrFormat,
            resolution: mi.resolution ?? fnData.resolution,
            source: mi.source ?? fnData.source,
            audioTracks: mi.audioTracks as object[],
            subtitleTracks: mi.subtitleTracks as object[],
          },
        });
        rescanned++;
      }

      return { rescanned, failed };
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
        if ((data as any)?.state === "active") return 1500;
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
