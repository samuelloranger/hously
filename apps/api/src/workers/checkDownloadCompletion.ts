import { prisma } from "@hously/api/db";
import { getQbittorrentPluginConfig } from "@hously/api/services/qbittorrent/config";
import { emitLibraryUpdate } from "@hously/api/services/libraryEvents";
import {
  fetchMaindata,
  resetMaindataState,
} from "@hously/api/services/qbittorrent/client";
import { enqueueLibraryPostProcess } from "@hously/api/services/postProcessor";

/** qBittorrent states that indicate the torrent finished downloading */
export function isCompletedDownloadState(state: string): boolean {
  return (
    state === "uploading" ||
    state === "pausedUP" ||
    state === "stoppedUP" ||
    state === "stalledUP" ||
    state === "queuedUP" ||
    state === "forcedUP"
  );
}

export function isFailedState(state: string): boolean {
  return state === "error" || state === "missingFiles";
}

/** If qBittorrent reports failure and no other active grab exists, unblock stuck "downloading" rows */
export async function revertLibraryDownloadingIfNoOtherActiveGrabs(dh: {
  id: number;
  mediaId: number | null;
  episodeId: number | null;
}): Promise<void> {
  if (dh.episodeId == null && dh.mediaId == null) return;

  const otherPending = await prisma.downloadHistory.count({
    where: {
      id: { not: dh.id },
      failed: false,
      completedAt: null,
      ...(dh.episodeId != null
        ? { episodeId: dh.episodeId }
        : { mediaId: dh.mediaId, episodeId: null }),
    },
  });
  if (otherPending > 0) return;

  if (dh.episodeId != null) {
    await prisma.libraryEpisode.updateMany({
      where: { id: dh.episodeId, status: "downloading" },
      data: { status: "wanted" },
    });
  } else if (dh.mediaId != null) {
    await prisma.libraryMedia.updateMany({
      where: { id: dh.mediaId, status: "downloading" },
      data: { status: "wanted" },
    });
  }
}

export async function markDownloadHistoryComplete(dh: {
  id: number;
  mediaId: number | null;
  episodeId: number | null;
}): Promise<void> {
  const completedAt = new Date();
  await prisma.downloadHistory.update({
    where: { id: dh.id },
    data: { completedAt },
  });

  if (dh.episodeId != null) {
    await prisma.libraryEpisode.update({
      where: { id: dh.episodeId },
      data: { status: "downloaded", downloadedAt: completedAt },
    });
  } else if (dh.mediaId != null) {
    await prisma.libraryMedia.update({
      where: { id: dh.mediaId },
      data: { status: "downloaded" },
    });
  }
}

/**
 * Mark a single download as complete by its torrent hash.
 * Called directly by the qBittorrent webhook for immediate completion.
 * Returns the download_history id when a matching pending row was updated, else null.
 */
export async function completeDownloadByHash(
  hash: string,
): Promise<number | null> {
  const normalizedHash = hash.toLowerCase().trim();
  if (!normalizedHash) return null;

  const dh = await prisma.downloadHistory.findFirst({
    where: { torrentHash: normalizedHash, completedAt: null, failed: false },
  });
  if (!dh) return null;

  await markDownloadHistoryComplete(dh);
  if (dh.mediaId != null) emitLibraryUpdate(dh.mediaId);
  return dh.id;
}

/**
 * Safety-net fallback: polls qBittorrent for all pending downloads.
 * Runs every 30 minutes to catch completions that the webhook may have missed
 * (e.g. Hously was down when the torrent finished, or hash was not yet known).
 */
export async function checkDownloadCompletion(): Promise<void> {
  const qb = await getQbittorrentPluginConfig();
  if (!qb.enabled || !qb.config) return;

  const pending = await prisma.downloadHistory.findMany({
    where: { completedAt: null, failed: false },
  });

  if (!pending.length) return;

  resetMaindataState();
  let torrents: Map<string, Record<string, unknown>>;
  try {
    ({ torrents } = await fetchMaindata(qb.config));
  } catch (e) {
    console.warn("[checkDownloadCompletion] fetchMaindata failed:", e);
    return;
  }

  const byHash = new Map<string, Record<string, unknown>>();
  for (const [h, raw] of torrents) {
    byHash.set(h.toLowerCase(), raw);
  }

  for (let dh of pending) {
    try {
      let raw: Record<string, unknown> | undefined;
      const tag = `hously-dh-${dh.id}`.toLowerCase();

      if (dh.torrentHash) {
        raw = byHash.get(dh.torrentHash.toLowerCase());
      }
      if (!raw) {
        for (const [h, torrentRow] of torrents) {
          const tStr =
            typeof torrentRow.tags === "string" ? torrentRow.tags : "";
          const tags = tStr
            .split(",")
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean);
          if (tags.includes(tag)) {
            raw = torrentRow;
            if (!dh.torrentHash) {
              const nh = h.toLowerCase();
              await prisma.downloadHistory.update({
                where: { id: dh.id },
                data: { torrentHash: nh },
              });
              dh = { ...dh, torrentHash: nh };
            }
            break;
          }
        }
      }

      if (!raw) continue;

      const state = typeof raw.state === "string" ? raw.state : "";
      const progress =
        typeof raw.progress === "number" && Number.isFinite(raw.progress)
          ? raw.progress
          : 0;

      if (isFailedState(state)) {
        await prisma.downloadHistory.update({
          where: { id: dh.id },
          data: {
            failed: true,
            failReason: `qBittorrent state: ${state || "unknown"}`,
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
        if (completedId == null && !dh.torrentHash) {
          await markDownloadHistoryComplete(dh);
          completedId = dh.id;
        }
        if (completedId != null) {
          enqueueLibraryPostProcess(completedId);
        }
      }
    } catch (e) {
      console.warn(
        `[checkDownloadCompletion] Failed for download_history ${dh.id}:`,
        e,
      );
    }
  }
}
