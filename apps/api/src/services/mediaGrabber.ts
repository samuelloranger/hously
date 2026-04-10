import { createHash } from "node:crypto";

import type { QualityProfile } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@hously/api/db";
import {
  addQbittorrentMagnet,
  addQbittorrentTorrentFile,
} from "@hously/api/services/qbittorrent/torrents";
import { getQbittorrentPluginConfig } from "@hously/api/services/qbittorrent/config";
import { logActivity } from "@hously/api/utils/activityLogs";
import {
  parseReleaseTitle,
  type ParsedRelease,
} from "@hously/api/utils/medias/filenameParser";
import {
  extractProwlarrDownloadTarget,
  indexerNameFromRaw,
  infoHashFromMagnet,
  releaseTitleFromRaw,
  sizeBytesFromRaw,
  toBoolean,
  toRecord,
} from "@hously/api/utils/medias/prowlarrSearchUtils";
import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import { normalizeProwlarrConfig } from "@hously/api/utils/plugins/normalizers";
import {
  MAX_TORRENT_FILE_BYTES,
  QBIT_CATEGORY_HOUSLY_MOVIES,
  QBIT_CATEGORY_HOUSLY_SHOWS,
} from "@hously/api/constants/libraryGrab";
import {
  fetchHttpWithSafeRedirects,
  isHttpUrlSafeForServerTorrentFetch,
  MagnetRedirectError,
} from "@hously/api/utils/medias/safeTorrentFetchUrl";

function profileToScoreInput(p: QualityProfile): QualityProfileScoreInput {
  return {
    minResolution: p.minResolution,
    cutoffResolution: p.cutoffResolution ?? null,
    preferredSources: p.preferredSources,
    preferredCodecs: p.preferredCodecs,
    preferredLanguages: p.preferredLanguages ?? [],
    maxSizeGb: p.maxSizeGb,
    requireHdr: p.requireHdr,
    preferHdr: p.preferHdr,
  };
}

type CandidateRow = {
  raw: Record<string, unknown>;
  parsed: ParsedRelease;
  score: number;
  title: string;
  size: number | null;
};

function qbCategoryForLibraryType(type: string): string {
  return type === "show"
    ? QBIT_CATEGORY_HOUSLY_SHOWS
    : QBIT_CATEGORY_HOUSLY_MOVIES;
}

function qualityJsonValue(
  releaseTitle: string,
  qualityParsed: unknown | undefined,
): Prisma.InputJsonValue {
  if (qualityParsed != null && typeof qualityParsed === "object") {
    return JSON.parse(JSON.stringify(qualityParsed)) as Prisma.InputJsonValue;
  }
  const parsed = parseReleaseTitle(releaseTitle);
  return JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue;
}

async function prowlarrHeadersForTorrentUrl(
  downloadUrl: string,
): Promise<Record<string, string>> {
  const prowPlugin = await prisma.plugin.findFirst({
    where: { type: "prowlarr" },
    select: { enabled: true, config: true },
  });
  if (!prowPlugin?.enabled) return {};
  const prowCfg = normalizeProwlarrConfig(prowPlugin.config);
  if (!prowCfg) return {};
  try {
    const pu = new URL(prowCfg.website_url);
    const du = new URL(downloadUrl);
    if (du.hostname === pu.hostname) {
      return { "X-Api-Key": prowCfg.api_key };
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Extract the SHA-1 info hash from a raw .torrent file buffer.
 * Parses just enough bencode to locate and hash the "info" dictionary.
 * Returns null if parsing fails — never throws.
 */
function infoHashFromTorrentBuffer(buf: ArrayBuffer): string | null {
  try {
    const bytes = new Uint8Array(buf);

    // Walk a bencoded value starting at pos, return the index after it ends.
    function skipValue(pos: number): number {
      const ch = bytes[pos];
      if (ch === 0x64 /* d */ || ch === 0x6c /* l */) {
        pos++;
        while (bytes[pos] !== 0x65 /* e */) pos = skipValue(pos);
        return pos + 1;
      }
      if (ch === 0x69 /* i */) {
        while (pos < bytes.length && bytes[pos] !== 0x65 /* e */) pos++;
        if (pos >= bytes.length)
          throw new Error("malformed integer in bencode");
        return pos + 1;
      }
      // String: <digits>:<bytes>
      let colon = pos;
      while (bytes[colon] !== 0x3a /* : */) colon++;
      const len = parseInt(
        new TextDecoder().decode(bytes.slice(pos, colon)),
        10,
      );
      return colon + 1 + len;
    }

    // The info key is encoded as "4:info" (0x34 0x3a 0x69 0x6e 0x66 0x6f)
    const marker = [0x34, 0x3a, 0x69, 0x6e, 0x66, 0x6f]; // "4:info"
    outer: for (let i = 0; i < bytes.length - marker.length; i++) {
      for (let j = 0; j < marker.length; j++) {
        if (bytes[i + j] !== marker[j]) continue outer;
      }
      const infoStart = i + marker.length;
      const infoEnd = skipValue(infoStart);
      return createHash("sha1")
        .update(bytes.slice(infoStart, infoEnd))
        .digest("hex");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Add a known release URL to qBittorrent with Hously categories/tags,
 * create DownloadHistory, set library status, and log activity.
 */
export async function grabRelease(opts: {
  mediaId: number;
  episodeId?: number;
  downloadUrl: string;
  releaseTitle: string;
  indexer?: string | null;
  qualityParsed?: unknown;
}): Promise<
  { grabbed: true; releaseTitle: string } | { grabbed: false; reason: string }
> {
  let pendingDownloadHistoryId: number | null = null;
  let grabCommittedOk = false;
  let successReleaseTitle: string | null = null;

  try {
    const {
      mediaId,
      episodeId,
      downloadUrl: rawUrl,
      releaseTitle: rawTitle,
      indexer,
      qualityParsed,
    } = opts;

    const downloadUrl = rawUrl.trim();
    const releaseTitle = rawTitle.trim();
    if (!downloadUrl) return { grabbed: false, reason: "Missing download URL" };
    if (!releaseTitle)
      return { grabbed: false, reason: "Missing release title" };

    const media = await prisma.libraryMedia.findUnique({
      where: { id: mediaId },
    });
    if (!media) return { grabbed: false, reason: "Library item not found" };

    const isMagnet = downloadUrl.startsWith("magnet:");
    if (isMagnet) {
      if (downloadUrl.length > 16_384) {
        return { grabbed: false, reason: "Magnet link too long" };
      }
    } else if (!isHttpUrlSafeForServerTorrentFetch(downloadUrl)) {
      return {
        grabbed: false,
        reason: "Download URL is not allowed for server-side fetch",
      };
    }

    const qb = await getQbittorrentPluginConfig();
    if (!qb.enabled || !qb.config) {
      return { grabbed: false, reason: "qBittorrent not configured" };
    }

    const category = qbCategoryForLibraryType(media.type);
    const qJson = qualityJsonValue(releaseTitle, qualityParsed);

    const dhRow = await prisma.downloadHistory.create({
      data: {
        mediaId,
        episodeId: episodeId ?? null,
        releaseTitle,
        indexer: indexer?.trim() || null,
        torrentHash: null,
        downloadUrl,
        qualityParsed: qJson,
      },
    });
    pendingDownloadHistoryId = dhRow.id;

    let torrentHash: string | null = isMagnet
      ? infoHashFromMagnet(downloadUrl)
      : null;

    if (isMagnet) {
      const add = await addQbittorrentMagnet(qb.config, qb.enabled, {
        magnet: downloadUrl,
        category,
        tags: ["hously"],
      });
      if (!add.success) {
        await prisma.downloadHistory.update({
          where: { id: dhRow.id },
          data: { failed: true, failReason: add.error ?? "Magnet add failed" },
        });
        return { grabbed: false, reason: add.error ?? "Failed to add magnet" };
      }
    } else {
      // Try to fetch the .torrent file. Some indexers redirect to a magnet instead.
      let fetchedFile: File | null = null;
      let magnetFallback: string | null = null;

      try {
        const headers: Record<string, string> = {
          ...(await prowlarrHeadersForTorrentUrl(downloadUrl)),
        };
        const torrentRes = await fetchHttpWithSafeRedirects(downloadUrl, {
          headers,
          signal: AbortSignal.timeout(60_000),
        });
        if (!torrentRes.ok) {
          throw new Error(`HTTP ${torrentRes.status}`);
        }
        const cl = torrentRes.headers.get("content-length");
        if (cl) {
          const n = Number(cl);
          if (Number.isFinite(n) && n > MAX_TORRENT_FILE_BYTES) {
            throw new Error("Torrent file too large");
          }
        }
        const buf = await torrentRes.arrayBuffer();
        if (buf.byteLength > MAX_TORRENT_FILE_BYTES) {
          throw new Error("Torrent file too large");
        }
        torrentHash = infoHashFromTorrentBuffer(buf);
        fetchedFile = new File([buf], "release.torrent", {
          type: "application/x-bittorrent",
        });
      } catch (e) {
        if (e instanceof MagnetRedirectError) {
          magnetFallback = e.magnetUrl;
        } else {
          await prisma.downloadHistory.update({
            where: { id: dhRow.id },
            data: {
              failed: true,
              failReason:
                e instanceof Error ? e.message : "Torrent download failed",
            },
          });
          return { grabbed: false, reason: "Could not download .torrent file" };
        }
      }

      if (magnetFallback) {
        torrentHash = infoHashFromMagnet(magnetFallback);
        const add = await addQbittorrentMagnet(qb.config, qb.enabled, {
          magnet: magnetFallback,
          category,
          tags: ["hously"],
        });
        if (!add.success) {
          await prisma.downloadHistory.update({
            where: { id: dhRow.id },
            data: {
              failed: true,
              failReason: add.error ?? "Magnet add failed",
            },
          });
          return {
            grabbed: false,
            reason: add.error ?? "Failed to add magnet",
          };
        }
      } else if (fetchedFile) {
        const add = await addQbittorrentTorrentFile(qb.config, qb.enabled, {
          torrent: fetchedFile,
          category,
          tags: ["hously"],
        });
        if (!add.success) {
          await prisma.downloadHistory.update({
            where: { id: dhRow.id },
            data: {
              failed: true,
              failReason: add.error ?? "Torrent add failed",
            },
          });
          return {
            grabbed: false,
            reason: add.error ?? "Failed to add torrent",
          };
        }
      }
    }

    await prisma.downloadHistory.update({
      where: { id: dhRow.id },
      data: { torrentHash },
    });

    try {
      if (episodeId != null) {
        await prisma.libraryEpisode.update({
          where: { id: episodeId },
          data: { status: "downloading", searchAttempts: 0 },
        });
      } else {
        await prisma.libraryMedia.update({
          where: { id: mediaId },
          data: { status: "downloading", searchAttempts: 0 },
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Library status update failed";
      // The torrent was already handed to qBittorrent — don't mark DH as failed.
      // A failed status update leaves the row active so the completion webhook
      // and the safety-net poller can still process it when the download finishes.
      console.warn(
        `[mediaGrabber] Library status update failed for DH ${dhRow.id} (torrent already queued): ${msg}`,
      );
    }

    grabCommittedOk = true;
    successReleaseTitle = releaseTitle;

    await logActivity({
      type: "media_grab",
      payload: {
        media_id: mediaId,
        episode_id: episodeId ?? null,
        release_title: releaseTitle,
        quality: qJson,
      },
    });

    return { grabbed: true, releaseTitle };
  } catch (e) {
    console.warn("[mediaGrabber] grabRelease failed:", e);
    if (grabCommittedOk && successReleaseTitle) {
      console.warn(
        "[mediaGrabber] Error after torrent was queued; treating as success:",
        e,
      );
      return { grabbed: true, releaseTitle: successReleaseTitle };
    }
    if (pendingDownloadHistoryId != null) {
      try {
        await prisma.downloadHistory.update({
          where: { id: pendingDownloadHistoryId },
          data: {
            failed: true,
            failReason:
              e instanceof Error ? e.message : "Unexpected error during grab",
          },
        });
      } catch {
        // ignore secondary failure
      }
    }
    return {
      grabbed: false,
      reason: e instanceof Error ? e.message : "Unexpected error during grab",
    };
  }
}

export async function searchAndGrab(opts: {
  mediaId: number;
  episodeId?: number;
  searchQuery: string;
  qualityProfileId: number | null;
}): Promise<
  { grabbed: true; releaseTitle: string } | { grabbed: false; reason: string }
> {
  try {
    const { mediaId, episodeId, searchQuery, qualityProfileId } = opts;
    const qTrim = searchQuery.trim();
    if (!qTrim) return { grabbed: false, reason: "Empty search query" };

    const prowPlugin = await prisma.plugin.findFirst({
      where: { type: "prowlarr" },
      select: { enabled: true, config: true },
    });
    if (!prowPlugin?.enabled) {
      return { grabbed: false, reason: "Prowlarr not configured" };
    }
    const prowCfg = normalizeProwlarrConfig(prowPlugin.config);
    if (!prowCfg) return { grabbed: false, reason: "Prowlarr not configured" };

    const url = new URL("/api/v1/search", prowCfg.website_url);
    url.searchParams.set("query", qTrim);
    url.searchParams.set("type", "search");
    url.searchParams.set("limit", "100");

    const res = await fetch(url.toString(), {
      headers: { "X-Api-Key": prowCfg.api_key, Accept: "application/json" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return {
        grabbed: false,
        reason: `Prowlarr search failed (${res.status})`,
      };
    }

    let rawList: unknown[];
    try {
      const body = await res.json();
      if (!Array.isArray(body)) {
        return { grabbed: false, reason: "Invalid Prowlarr response" };
      }
      rawList = body;
    } catch {
      return { grabbed: false, reason: "Could not parse Prowlarr response" };
    }

    const rows: CandidateRow[] = [];

    let profileInput: QualityProfileScoreInput | null = null;
    if (qualityProfileId != null) {
      const prof = await prisma.qualityProfile.findUnique({
        where: { id: qualityProfileId },
      });
      if (prof) profileInput = profileToScoreInput(prof);
    }

    const baseUrl = prowCfg.website_url.replace(/\/+$/, "");

    for (const item of rawList) {
      const row = toRecord(item);
      if (!row) continue;
      if (toBoolean(row.rejected)) continue;
      const title = releaseTitleFromRaw(row);
      if (!title) continue;
      const target = extractProwlarrDownloadTarget(row, baseUrl);
      if (!target) continue;
      const parsed = parseReleaseTitle(title);
      const size = sizeBytesFromRaw(row);

      if (profileInput) {
        const sc = scoreRelease(parsed, profileInput, size, title);
        if (sc === null) continue;
        rows.push({ raw: row, parsed, score: sc, title, size });
      } else {
        rows.push({ raw: row, parsed, score: 0, title, size });
      }
    }

    rows.sort((a, b) => b.score - a.score);
    const best = rows[0];
    if (!best) {
      return { grabbed: false, reason: "No matching releases found" };
    }

    const downloadTarget = extractProwlarrDownloadTarget(best.raw, baseUrl);
    if (!downloadTarget) {
      return { grabbed: false, reason: "No download URL for best release" };
    }

    return grabRelease({
      mediaId,
      episodeId,
      downloadUrl: downloadTarget.url,
      releaseTitle: best.title,
      indexer: indexerNameFromRaw(best.raw),
      qualityParsed: best.parsed,
    });
  } catch (e) {
    console.warn("[mediaGrabber] searchAndGrab failed:", e);
    return {
      grabbed: false,
      reason:
        e instanceof Error ? e.message : "Unexpected error during search/grab",
    };
  }
}
