import { stat as statFile } from "node:fs/promises";
import { prisma } from "@hously/api/db";
import {
  scanMediaInfo,
  remapPath,
} from "@hously/api/utils/medias/mediainfoScanner";
import { parseFilenameMetadata } from "@hously/api/utils/medias/filenameParser";
import { enqueueLibraryPostProcess } from "@hously/api/services/postProcessor";
import { getQbittorrentIntegrationConfig } from "@hously/api/services/qbittorrent/config";
import { fetchMaindata } from "@hously/api/services/qbittorrent/client";
import {
  isCompletedDownloadState,
  reconcilePendingDownloads,
} from "@hously/api/workers/checkDownloadCompletion";

export type RescanResult = {
  rescanned: number; // files whose MediaInfo was updated
  failed: number; // files that exist on disk but MediaInfo failed to read
  deleted: number; // stale MediaFile records removed (file gone from disk)
  imported: number; // always 0; use Downloads Import UI instead of automatic folder scan
  requeued: number; // post-process jobs queued (file in downloads, not yet hardlinked)
  episodesReset: number; // LibraryEpisode rows reset to "wanted"
  mediaReset: boolean; // whether LibraryMedia.status was reset to "wanted"
  pendingReconciled: {
    completed: number;
    failed: number;
    missing: number;
  };
};

export async function rescanLibraryItem(
  mediaId: number,
): Promise<RescanResult | null> {
  const media = await prisma.libraryMedia.findUnique({
    where: { id: mediaId },
    include: {
      downloadHistories: {
        where: { failed: false, completedAt: { not: null } },
        select: { id: true, torrentHash: true, episodeId: true },
      },
    },
  });
  if (!media) return null;

  // ── Step 0: Reconcile pending download_history rows against qBittorrent ──
  // If the item is stuck in "downloading" because the torrent was deleted or
  // errored out, mark the download_history failed and revert status so the
  // rescan can re-evaluate from "wanted". Missing torrents are treated as
  // failed to unstick the UI.
  const pendingDhs = await prisma.downloadHistory.findMany({
    where: { mediaId, completedAt: null, failed: false },
    select: { id: true, mediaId: true, episodeId: true, torrentHash: true },
  });
  const pendingReconciled = await reconcilePendingDownloads(pendingDhs, {
    treatMissingAsFailed: true,
  });

  const imported = 0;

  // ── Step 1: Process existing MediaFile records ────────────────────────────────
  // Update MediaInfo for valid files; delete records for files gone from disk.
  const files = await prisma.mediaFile.findMany({ where: { mediaId } });

  const toDeleteIds: number[] = [];
  const toUpdateOps: Array<() => Promise<unknown>> = [];
  let rescanned = 0;
  let failed = 0;
  const validEpisodeIds = new Set<number>();
  let hasValidFile = false;

  const SCAN_CONCURRENCY = 4;
  for (let i = 0; i < files.length; i += SCAN_CONCURRENCY) {
    const chunk = files.slice(i, i + SCAN_CONCURRENCY);
    await Promise.all(
      chunk.map(async (file) => {
        const mi = await scanMediaInfo(file.filePath);
        if (!mi) {
          try {
            await statFile(remapPath(file.filePath));
            // File is on disk but MediaInfo can't read it (corrupt / unsupported format)
            failed++;
            hasValidFile = true;
            if (file.episodeId != null) validEpisodeIds.add(file.episodeId);
          } catch {
            toDeleteIds.push(file.id);
          }
          return;
        }

        hasValidFile = true;
        if (file.episodeId != null) validEpisodeIds.add(file.episodeId);

        const fnData = parseFilenameMetadata(file.fileName);
        toUpdateOps.push(() =>
          prisma.mediaFile.update({
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
          }),
        );
        rescanned++;
      }),
    );
  }

  const deleted = toDeleteIds.length;
  if (toDeleteIds.length > 0) {
    await prisma.mediaFile.deleteMany({ where: { id: { in: toDeleteIds } } });
  }
  await Promise.all(toUpdateOps.map((op) => op()));

  // ── Step 2: qBittorrent — re-queue post-processing for completed downloads ────
  // Handles the case where a torrent finished downloading but the hardlink/move
  // step was missed. Only fires if the torrent is still present in qBittorrent
  // in a completed state, so intentionally-deleted torrents are never re-queued.
  let requeued = 0;
  const completedDhs = media.downloadHistories.filter((dh) => dh.torrentHash);

  if (completedDhs.length > 0) {
    const qbCompleteHashes = new Set<string>();
    try {
      const qbCfg = await getQbittorrentIntegrationConfig();
      if (qbCfg.enabled && qbCfg.config) {
        const { torrents } = await fetchMaindata(qbCfg.config);
        for (const [hash, raw] of torrents) {
          const state = typeof raw.state === "string" ? raw.state : "";
          const progress =
            typeof raw.progress === "number" && Number.isFinite(raw.progress)
              ? raw.progress
              : 0;
          if (isCompletedDownloadState(state) || progress >= 1) {
            qbCompleteHashes.add(hash.toLowerCase());
          }
        }
      }
    } catch {
      // qBittorrent unreachable — skip re-queue
    }

    for (const dh of completedDhs) {
      if (!dh.torrentHash) continue;
      if (!qbCompleteHashes.has(dh.torrentHash.toLowerCase())) continue;

      // Re-queue only if the target file is actually missing from the library
      const needsRequeue =
        dh.episodeId != null
          ? !validEpisodeIds.has(dh.episodeId)
          : !hasValidFile;

      if (needsRequeue) {
        enqueueLibraryPostProcess(dh.id);
        requeued++;
      }
    }
  }

  // ── Step 3: Reconcile statuses ────────────────────────────────────────────────
  // Skip if a post-processing job was just requeued (it completes asynchronously).
  let episodesReset = 0;
  let mediaReset = false;

  if (imported === 0 && requeued === 0) {
    if (media.type === "show") {
      const result = await prisma.libraryEpisode.updateMany({
        where: {
          mediaId,
          status: { notIn: ["wanted", "skipped"] },
          files: { none: {} },
        },
        data: { status: "wanted", searchAttempts: 0, downloadedAt: null },
      });
      episodesReset = result?.count ?? 0;
    }

    const remainingFiles = await prisma.mediaFile.count({ where: { mediaId } });
    if (
      remainingFiles === 0 &&
      media.status !== "wanted" &&
      media.status !== "skipped"
    ) {
      await prisma.libraryMedia.update({
        where: { id: mediaId },
        data: { status: "wanted", searchAttempts: 0 },
      });
      mediaReset = true;
    }
  }

  return {
    rescanned,
    failed,
    deleted,
    imported,
    requeued,
    episodesReset,
    mediaReset,
    pendingReconciled,
  };
}
