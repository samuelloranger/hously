import { Elysia, t } from "elysia";

import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { rescanLibraryItem } from "@hously/api/services/library/rescan";

/**
 * File-level operations: list, rescan, delete file, delete episode files.
 * GET /api/library/:id/files
 * POST /api/library/:id/rescan
 * DELETE /api/library/files/:fileId
 * DELETE /api/library/:id/episodes/:episodeId
 * GET /api/library/:id/episodes
 * GET /api/library/:id/downloads
 * DELETE /api/library/:id/downloads/failed
 * DELETE /api/library/:id/downloads/:dhId
 * POST /api/library/downloads/:dhId/retry-post-process
 */
export const libraryFilesRoutes = new Elysia()
  .use(requireUser)

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

  // DELETE /api/library/:id/downloads/failed — remove failed / post-process-error grab rows for this media
  .delete("/:id/downloads/failed", async ({ params, set }) => {
    try {
      const mediaId = parseInt(params.id, 10);
      if (!Number.isFinite(mediaId)) return badRequest(set, "Invalid id");

      const media = await prisma.libraryMedia.findUnique({
        where: { id: mediaId },
      });
      if (!media) return notFound(set, "Library item not found");

      const staleRows = await prisma.downloadHistory.findMany({
        where: {
          mediaId,
          OR: [
            { failed: true },
            {
              AND: [
                { postProcessError: { not: null } },
                { postProcessError: { not: "" } },
              ],
            },
          ],
        },
        select: { id: true },
      });
      const ids = staleRows.map((r) => r.id);
      if (ids.length === 0) return { deleted: 0 };

      const { emitLibraryUpdate } =
        await import("@hously/api/services/libraryEvents");

      await prisma.$transaction([
        prisma.libraryAttentionAlert.updateMany({
          where: {
            status: "open",
            downloadHistoryId: { in: ids },
          },
          data: {
            status: "resolved_auto",
            resolvedAt: new Date(),
          },
        }),
        prisma.downloadHistory.deleteMany({
          where: { id: { in: ids } },
        }),
      ]);

      emitLibraryUpdate(mediaId);
      return { deleted: ids.length };
    } catch (err) {
      console.error("Library clear failed downloads error:", err);
      return serverError(set, "Failed to delete download history");
    }
  })

  // DELETE /api/library/:id/downloads/:dhId — remove one failed / post-process-error grab row
  .delete("/:id/downloads/:dhId", async ({ params, set }) => {
    try {
      const mediaId = parseInt(params.id, 10);
      const dhId = parseInt(params.dhId, 10);
      if (!Number.isFinite(mediaId) || !Number.isFinite(dhId)) {
        return badRequest(set, "Invalid id");
      }

      const { isRemovableDownloadHistoryEntry } =
        await import("@hously/shared");

      const dh = await prisma.downloadHistory.findFirst({
        where: { id: dhId, mediaId },
        select: {
          id: true,
          failed: true,
          postProcessError: true,
        },
      });
      if (!dh) return notFound(set, "Download history not found");
      if (!isRemovableDownloadHistoryEntry(dh)) {
        return badRequest(
          set,
          "Only failed downloads or post-processing errors can be removed",
        );
      }

      const { emitLibraryUpdate } =
        await import("@hously/api/services/libraryEvents");

      await prisma.$transaction([
        prisma.libraryAttentionAlert.updateMany({
          where: {
            status: "open",
            downloadHistoryId: dhId,
          },
          data: {
            status: "resolved_auto",
            resolvedAt: new Date(),
          },
        }),
        prisma.downloadHistory.delete({ where: { id: dhId } }),
      ]);

      emitLibraryUpdate(mediaId);
      return { success: true };
    } catch (err) {
      console.error("Library delete download entry error:", err);
      return serverError(set, "Failed to delete download history");
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
        await import("@hously/api/services/postProcessorQueue");
      enqueueLibraryPostProcess(dhId);
      return { queued: true, download_history_id: dhId };
    } catch {
      return serverError(set, "Failed to queue post-processing");
    }
  })

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

  // PATCH /api/library/files/:fileId — update editable file fields (e.g. release group)
  .patch(
    "/files/:fileId",
    async ({ params, body, set }) => {
      try {
        const fileId = parseInt(params.fileId, 10);
        if (!Number.isFinite(fileId)) return badRequest(set, "Invalid file id");

        const file = await prisma.mediaFile.findUnique({
          where: { id: fileId },
        });
        if (!file) return notFound(set, "File not found");

        const updated = await prisma.mediaFile.update({
          where: { id: fileId },
          data: {
            ...(body.release_group !== undefined
              ? { releaseGroup: body.release_group }
              : {}),
          },
        });

        return {
          id: updated.id,
          release_group: updated.releaseGroup,
        };
      } catch {
        return serverError(set, "Failed to update file");
      }
    },
    {
      body: t.Object({
        release_group: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )

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
  );
