import { copyFile, link, mkdir, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join } from "node:path";

import { prisma } from "@hously/api/db";
import { classifyLanguageTags, type LibraryAudioTrack } from "@hously/shared";
import {
  parseFilenameMetadata,
  parseReleaseTitle,
} from "@hously/api/utils/medias/filenameParser";
import {
  scanMediaInfo,
  remapPath,
} from "@hously/api/utils/medias/mediainfoScanner";
import {
  findVideoFile,
  listVideoFilesUnder,
} from "@hously/api/utils/medias/fileIdentifier";
import {
  renderEpisodeTemplate,
  renderMovieTemplate,
  sanitizeFilenamePart,
  sanitizePathTemplateOutput,
} from "@hously/api/utils/medias/fileTemplate";
import { getQbittorrentPluginConfig } from "@hously/api/services/qbittorrent/config";
import {
  deleteQbittorrentTorrent,
  fetchQbittorrentTorrent,
  fetchQbittorrentTorrentProperties,
} from "@hously/api/services/qbittorrent/torrents";
import { notifyAdminsPostProcessFailed } from "@hously/api/workers/notifyPostProcessFailed";
import { notifyAdminsMediaDownloaded } from "@hously/api/workers/notifyMediaDownloaded";
import { emitLibraryUpdate } from "@hously/api/services/libraryEvents";
import { triggerJellyfinLibraryScan } from "@hously/api/services/jellyfinLibraryRefresh";

function qualityStringsFromParsed(
  qualityParsed: unknown,
  releaseTitle: string,
): { resolution: string | null; source: string | null; codec: string | null } {
  if (qualityParsed && typeof qualityParsed === "object") {
    const q = qualityParsed as Record<string, unknown>;
    const res = q.resolution;
    const resolution =
      typeof res === "number"
        ? `${res}p`
        : typeof res === "string"
          ? res
          : null;
    const source = typeof q.source === "string" ? q.source : null;
    const codec = typeof q.codec === "string" ? q.codec : null;
    if (resolution || source || codec) return { resolution, source, codec };
  }
  const p = parseReleaseTitle(releaseTitle);
  return {
    resolution: p.resolution ? `${p.resolution}p` : null,
    source: p.source,
    codec: p.codec,
  };
}

function resolveTorrentContentPath(
  contentPath: string | null | undefined,
  savePath: string | null | undefined,
  torrentName: string,
): string | null {
  const cp = contentPath?.trim();
  if (cp) {
    if (isAbsolute(cp)) return cp;
    const sp = savePath?.replace(/\/+$/, "") ?? "";
    if (sp) return join(sp, cp);
    return cp;
  }
  const sp = savePath?.replace(/\/+$/, "");
  if (sp && torrentName) return join(sp, torrentName);
  return null;
}

async function ensureDestinationDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function placeFile(
  src: string,
  dst: string,
  operation: "hardlink" | "move",
): Promise<void> {
  try {
    await stat(dst);
    console.warn(`[postProcess] Destination already exists, skipping: ${dst}`);
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[postProcess] stat destination failed (${dst}):`, e);
    }
    // absent — proceed
  }

  await ensureDestinationDir(dst);

  if (operation === "move") {
    try {
      await rename(src, dst);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EXDEV") {
        await copyFile(src, dst);
        await unlink(src);
      } else {
        throw e;
      }
    }
    return;
  }

  try {
    await link(src, dst);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      await copyFile(src, dst);
    } else {
      throw e;
    }
  }
}

async function markItemDownloaded(dh: {
  media: { id: number; type: string };
  episode: { id: number } | null;
}): Promise<void> {
  if (dh.episode) {
    await prisma.libraryEpisode.update({
      where: { id: dh.episode.id },
      data: { status: "downloaded", downloadedAt: new Date() },
    });
  } else {
    await prisma.libraryMedia.update({
      where: { id: dh.media.id },
      data: { status: "downloaded" },
    });
  }
}

/** Parse season and episode numbers from a video filename. */
function parseSeasonEpisode(
  filename: string,
): { season: number; episode: number } | null {
  const m = filename.match(/S(\d{1,2})E(\d{1,3})/i);
  if (!m) return null;
  return { season: parseInt(m[1], 10), episode: parseInt(m[2], 10) };
}

/**
 * Post-process a season pack / intégrale: find all video files under the torrent
 * folder, match each to a LibraryEpisode by SxxExx, hardlink/move to library.
 */
async function postProcessSeasonPack(
  downloadHistoryId: number,
  dh: {
    id: number;
    media: { id: number; type: string; title: string; year: number | null };
    episode: null;
    torrentHash: string | null;
    releaseTitle: string;
    qualityParsed: unknown;
  },
  settings: {
    showsLibraryPath: string | null;
    episodeTemplate: string | null;
    fileOperation: string | null;
    minSeedRatio: number;
  },
  op: "hardlink" | "move",
): Promise<
  | { success: true; destinationPath: string }
  | { success: false; reason: string }
> {
  const hash = dh.torrentHash?.trim();
  if (!hash) return { success: false, reason: "Torrent hash unknown" };

  const qb = await getQbittorrentPluginConfig();
  if (!qb.enabled || !qb.config)
    return { success: false, reason: "qBittorrent not configured" };

  const tRes = await fetchQbittorrentTorrent(qb.config, qb.enabled, hash);
  if (!tRes.torrent)
    return {
      success: false,
      reason: tRes.error ?? "Torrent not found in qBittorrent",
    };

  const tor = tRes.torrent;
  let savePathForJoin: string | null = null;
  const cpTrim = tor.content_path?.trim() ?? "";
  if (!cpTrim || !isAbsolute(cpTrim)) {
    const pRes = await fetchQbittorrentTorrentProperties(
      qb.config,
      qb.enabled,
      hash,
    );
    savePathForJoin = pRes.properties?.save_path ?? null;
  }

  const contentBase = resolveTorrentContentPath(
    tor.content_path,
    savePathForJoin,
    tor.name,
  );
  if (!contentBase)
    return { success: false, reason: "Could not resolve torrent content path" };

  const allVideos = await listVideoFilesUnder(remapPath(contentBase));
  if (allVideos.length === 0)
    return { success: false, reason: "No video files found in torrent folder" };

  // Load all episodes for this show
  const episodes = await prisma.libraryEpisode.findMany({
    where: { mediaId: dh.media.id },
  });
  const epMap = new Map(episodes.map((e) => [`${e.season}x${e.episode}`, e]));

  const root = settings.showsLibraryPath!.replace(/\/+$/, "");
  const q = qualityStringsFromParsed(dh.qualityParsed, dh.releaseTitle);

  let processed = 0;
  const errors: string[] = [];
  let firstDest: string | null = null;

  for (const srcVideo of allVideos) {
    const fn = basename(srcVideo);
    const se = parseSeasonEpisode(fn);
    if (!se) {
      console.warn(
        `[postProcess/pack] Could not parse SxxExx from "${fn}", skipping`,
      );
      continue;
    }

    const ep = epMap.get(`${se.season}x${se.episode}`);
    if (!ep) {
      console.warn(
        `[postProcess/pack] No LibraryEpisode for S${se.season}E${se.episode} of "${dh.media.title}", skipping`,
      );
      continue;
    }

    const ext = extname(srcVideo) || ".mkv";
    const epStem =
      renderEpisodeTemplate(settings.episodeTemplate ?? "", {
        show: dh.media.title,
        season: ep.season,
        episode: ep.episode,
        title: ep.title,
        resolution: q.resolution,
        source: q.source,
        ext,
      }) ||
      sanitizePathTemplateOutput(
        `${dh.media.title}/Season ${ep.season}/${dh.media.title} - S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`,
      );
    const destinationPath = join(root, `${epStem}${ext}`);

    try {
      await placeFile(srcVideo, destinationPath, op);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`S${se.season}E${se.episode}: ${msg}`);
      continue;
    }

    if (!firstDest) firstDest = destinationPath;

    // MediaFile record
    try {
      const fnData = parseFilenameMetadata(fn);
      const mi = await scanMediaInfo(destinationPath);
      const existingFile = await prisma.mediaFile.findFirst({
        where: { filePath: destinationPath },
        select: { id: true },
      });
      const fileData = mi
        ? {
            mediaId: dh.media.id,
            episodeId: ep.id,
            filePath: destinationPath,
            fileName: basename(destinationPath),
            sizeBytes: mi.sizeBytes,
            durationSecs: mi.durationSecs,
            releaseGroup: mi.releaseGroup,
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
            languageTags: classifyLanguageTags(
              mi.audioTracks as LibraryAudioTrack[],
              dh.releaseTitle,
            ),
          }
        : {
            mediaId: dh.media.id,
            episodeId: ep.id,
            filePath: destinationPath,
            fileName: basename(destinationPath),
            sizeBytes: BigInt(0),
            releaseGroup: null as string | null,
            resolution: fnData.resolution,
            source: fnData.source ?? q.source,
            hdrFormat: fnData.hdrFormat,
            audioTracks: [] as object[],
            subtitleTracks: [] as object[],
            languageTags: [] as string[],
          };
      if (existingFile) {
        await prisma.mediaFile.update({
          where: { id: existingFile.id },
          data: fileData,
        });
      } else {
        await prisma.mediaFile.create({ data: fileData });
      }
    } catch (e) {
      console.warn(`[postProcess/pack] MediaFile upsert failed for ${fn}:`, e);
    }

    // Mark episode downloaded
    await prisma.libraryEpisode.update({
      where: { id: ep.id },
      data: { status: "downloaded", downloadedAt: new Date() },
    });

    processed++;
  }

  if (processed === 0) {
    return {
      success: false,
      reason:
        errors.length > 0
          ? errors.join("; ")
          : "No episodes could be matched or placed",
    };
  }

  // Mark the show as downloaded and update the DH record
  await prisma.libraryMedia.update({
    where: { id: dh.media.id },
    data: { status: "downloaded" },
  });
  await prisma.downloadHistory.update({
    where: { id: downloadHistoryId },
    data: { postProcessDestinationPath: firstDest, postProcessError: null },
  });

  console.log(
    `[postProcess/pack] Processed ${processed} episodes for "${dh.media.title}" (${errors.length} errors)`,
  );

  // Remove torrent if seed ratio met
  const ratio = tor.ratio;
  const min = settings.minSeedRatio;
  const shouldRemove = min <= 0 || (ratio != null && ratio >= min);
  if (shouldRemove) {
    const del = await deleteQbittorrentTorrent(qb.config, qb.enabled, {
      hash,
      delete_files: false,
    });
    if (!del.success)
      console.warn(
        `[postProcess/pack] Could not remove torrent ${hash}:`,
        del.error,
      );
  }

  return { success: true, destinationPath: firstDest! };
}

/**
 * After a library torrent completes: hardlink/move into the configured library tree.
 */
export async function postProcess(
  downloadHistoryId: number,
): Promise<
  | { success: true; destinationPath: string }
  | { success: false; reason: string }
> {
  const dh = await prisma.downloadHistory.findUnique({
    where: { id: downloadHistoryId },
    include: {
      media: true,
      episode: true,
    },
  });
  if (!dh || !dh.media) {
    return { success: false, reason: "Download history or media not found" };
  }
  if (dh.failed || !dh.completedAt) {
    return { success: false, reason: "Download not completed" };
  }

  const settings = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  if (!settings?.postProcessingEnabled) {
    return { success: false, reason: "Post-processing disabled" };
  }

  const op = settings.fileOperation === "move" ? "move" : "hardlink";

  if (dh.media.type === "movie") {
    if (!settings.moviesLibraryPath?.trim()) {
      return { success: false, reason: "Movies library path not configured" };
    }
  } else if (dh.media.type === "show") {
    if (!settings.showsLibraryPath?.trim()) {
      return { success: false, reason: "Shows library path not configured" };
    }
    // Season pack / intégrale — no episodeId — process all files in the folder
    if (!dh.episode) {
      return postProcessSeasonPack(
        downloadHistoryId,
        {
          id: dh.id,
          media: dh.media!,
          episode: null,
          torrentHash: dh.torrentHash,
          releaseTitle: dh.releaseTitle,
          qualityParsed: dh.qualityParsed,
        },
        settings,
        op,
      );
    }
  } else {
    return { success: false, reason: "Unknown media type" };
  }

  // ── Pre-scan: check if a MediaFile already exists on disk for this item ──────
  // This handles cases where files were placed manually or by a previous run.
  // If found, register the file and mark as downloaded without touching qBittorrent.
  {
    const existingFiles = await prisma.mediaFile.findMany({
      where: dh.episode
        ? { episodeId: dh.episode.id }
        : { mediaId: dh.media.id, episodeId: null },
      select: { id: true, filePath: true },
    });
    for (const ef of existingFiles) {
      try {
        await stat(ef.filePath);
        // File is on disk — mark complete and return without hardlinking
        await markItemDownloaded({ media: dh.media!, episode: dh.episode });
        await prisma.downloadHistory.update({
          where: { id: downloadHistoryId },
          data: {
            postProcessDestinationPath: ef.filePath,
            postProcessError: null,
          },
        });
        return { success: true, destinationPath: ef.filePath };
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(
            `[postProcess] stat existing file unexpected error (${ef.filePath}):`,
            e,
          );
        }
        // File gone from disk — continue to normal flow
      }
    }
  }

  const hash = dh.torrentHash?.trim();
  if (!hash) {
    return { success: false, reason: "Torrent hash unknown" };
  }

  const qb = await getQbittorrentPluginConfig();
  if (!qb.enabled || !qb.config) {
    return { success: false, reason: "qBittorrent not configured" };
  }

  const tRes = await fetchQbittorrentTorrent(qb.config, qb.enabled, hash);
  if (!tRes.torrent) {
    return {
      success: false,
      reason: tRes.error ?? "Torrent not found in qBittorrent",
    };
  }

  const tor = tRes.torrent;
  const cpTrim = tor.content_path?.trim() ?? "";
  let savePathForJoin: string | null = null;
  if (!cpTrim || !isAbsolute(cpTrim)) {
    const pRes = await fetchQbittorrentTorrentProperties(
      qb.config,
      qb.enabled,
      hash,
    );
    savePathForJoin = pRes.properties?.save_path ?? null;
  }

  const contentBase = resolveTorrentContentPath(
    tor.content_path,
    savePathForJoin,
    tor.name,
  );
  if (!contentBase) {
    return { success: false, reason: "Could not resolve torrent content path" };
  }

  const srcVideo = await findVideoFile(remapPath(contentBase));
  if (!srcVideo) {
    return { success: false, reason: "No video file found" };
  }

  const ext = extname(srcVideo) || ".mkv";
  const q = qualityStringsFromParsed(dh.qualityParsed, dh.releaseTitle);

  const root =
    dh.media.type === "movie"
      ? settings.moviesLibraryPath!.replace(/\/+$/, "")
      : settings.showsLibraryPath!.replace(/\/+$/, "");

  let relativeDest: string;
  if (dh.media.type === "movie") {
    const stem =
      renderMovieTemplate(settings.movieTemplate, {
        title: dh.media.title,
        year: dh.media.year,
        resolution: q.resolution,
        source: q.source,
        codec: q.codec,
        ext,
      }) || sanitizeFilenamePart(dh.media.title);
    relativeDest = `${stem}${ext}`;
  } else {
    const ep = dh.episode!;
    const epStem =
      renderEpisodeTemplate(settings.episodeTemplate, {
        show: dh.media.title,
        season: ep.season,
        episode: ep.episode,
        title: ep.title,
        resolution: q.resolution,
        source: q.source,
        ext,
      }) ||
      sanitizePathTemplateOutput(
        `${dh.media.title}/Season ${ep.season}/${dh.media.title} - S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`,
      );
    relativeDest = `${epStem}${ext}`;
  }

  const destinationPath = join(root, relativeDest);

  try {
    await placeFile(srcVideo, destinationPath, op);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, reason: msg };
  }

  // Create (or refresh) a MediaFile record so the library listing reflects the processed file.
  try {
    const destFileName = basename(destinationPath);
    const fnData = parseFilenameMetadata(destFileName);
    const mi = await scanMediaInfo(destinationPath);

    const existingFile = await prisma.mediaFile.findFirst({
      where: { filePath: destinationPath },
      select: { id: true },
    });

    const fileData = mi
      ? {
          mediaId: dh.media!.id,
          episodeId: dh.episode?.id ?? null,
          filePath: destinationPath,
          fileName: destFileName,
          sizeBytes: mi.sizeBytes,
          durationSecs: mi.durationSecs,
          releaseGroup: mi.releaseGroup,
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
          languageTags: classifyLanguageTags(
            mi.audioTracks as LibraryAudioTrack[],
            dh.releaseTitle,
          ),
        }
      : {
          mediaId: dh.media!.id,
          episodeId: dh.episode?.id ?? null,
          filePath: destinationPath,
          fileName: destFileName,
          sizeBytes: BigInt(0),
          releaseGroup: null as string | null,
          resolution: fnData.resolution,
          source: fnData.source ?? q.source,
          hdrFormat: fnData.hdrFormat,
          audioTracks: [] as object[],
          subtitleTracks: [] as object[],
          languageTags: [] as string[],
        };

    if (existingFile) {
      await prisma.mediaFile.update({
        where: { id: existingFile.id },
        data: fileData,
      });
    } else {
      await prisma.mediaFile.create({ data: fileData });
    }
  } catch (e) {
    // Non-fatal: file is on disk, the record can be recovered via manual rescan.
    console.warn("[postProcess] MediaFile upsert failed:", e);
  }

  // Mark the library item as downloaded now that the file is on disk.
  try {
    await markItemDownloaded({ media: dh.media!, episode: dh.episode });
  } catch (e) {
    console.warn("[postProcess] Status update to downloaded failed:", e);
  }

  const ratio = tor.ratio;
  const min = settings.minSeedRatio;
  const shouldRemove = min <= 0 || (ratio != null && ratio >= min);
  if (shouldRemove) {
    const del = await deleteQbittorrentTorrent(qb.config, qb.enabled, {
      hash,
      delete_files: false,
    });
    if (!del.success) {
      console.warn(
        `[postProcess] Could not remove torrent ${hash}:`,
        del.error,
      );
    }
  }

  return { success: true, destinationPath };
}

/**
 * Scan the library destination folder for video files that exist on disk but have
 * no MediaFile record. Creates missing records and marks episodes/movies as downloaded.

 */
export async function scanAndImportLibraryFiles(media: {
  id: number;
  type: string;
  title: string;
  year: number | null;
}): Promise<number> {
  const settings = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  if (!settings?.postProcessingEnabled) return 0;

  const root =
    media.type === "movie"
      ? settings.moviesLibraryPath?.trim()
      : settings.showsLibraryPath?.trim();
  if (!root) return 0;

  const scanRoot = join(
    root.replace(/\/+$/, ""),
    sanitizePathTemplateOutput(media.title),
  );

  let allVideos: string[];
  try {
    allVideos = await listVideoFilesUnder(scanRoot);
  } catch (e) {
    console.warn(`[postProcess] listVideoFilesUnder failed (${scanRoot}):`, e);
    return 0; // folder doesn't exist or isn't accessible
  }
  if (allVideos.length === 0) return 0;

  const existing = await prisma.mediaFile.findMany({
    where: { mediaId: media.id },
    select: { filePath: true, episodeId: true },
  });
  const existingPaths = new Set(existing.map((f) => f.filePath));
  const existingEpisodeIds = new Set(
    existing.map((f) => f.episodeId).filter((id): id is number => id != null),
  );

  let imported = 0;

  if (media.type === "show") {
    const episodes = await prisma.libraryEpisode.findMany({
      where: { mediaId: media.id },
    });
    const epMap = new Map(episodes.map((e) => [`${e.season}x${e.episode}`, e]));

    for (const videoPath of allVideos) {
      if (existingPaths.has(videoPath)) continue;
      const fn = basename(videoPath);
      const se = parseSeasonEpisode(fn);
      if (!se) continue;
      const ep = epMap.get(`${se.season}x${se.episode}`);
      if (!ep) continue;
      if (existingEpisodeIds.has(ep.id)) continue;

      try {
        const fnData = parseFilenameMetadata(fn);
        const mi = await scanMediaInfo(videoPath);
        const fileData = mi
          ? {
              mediaId: media.id,
              episodeId: ep.id,
              filePath: videoPath,
              fileName: fn,
              sizeBytes: mi.sizeBytes,
              durationSecs: mi.durationSecs,
              releaseGroup: mi.releaseGroup,
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
              languageTags: classifyLanguageTags(
                mi.audioTracks as LibraryAudioTrack[],
                fn,
              ),
            }
          : {
              mediaId: media.id,
              episodeId: ep.id,
              filePath: videoPath,
              fileName: fn,
              sizeBytes: BigInt(0),
              releaseGroup: null as string | null,
              resolution: fnData.resolution,
              source: fnData.source,
              hdrFormat: fnData.hdrFormat,
              audioTracks: [] as object[],
              subtitleTracks: [] as object[],
              languageTags: [] as string[],
            };
        await prisma.mediaFile.create({ data: fileData });
        await prisma.libraryEpisode.update({
          where: { id: ep.id },
          data: { status: "downloaded", downloadedAt: new Date() },
        });
        existingEpisodeIds.add(ep.id);
        imported++;
        console.log(
          `[scanLibrary] Imported untracked file "${fn}" for "${media.title}" S${se.season}E${se.episode}`,
        );
      } catch (e) {
        console.warn(`[scanLibrary] Failed to import "${fn}":`, e);
      }
    }

    if (imported > 0) {
      await prisma.libraryMedia.update({
        where: { id: media.id },
        data: { status: "downloaded" },
      });
    }
  } else if (media.type === "movie") {
    for (const videoPath of allVideos) {
      if (existingPaths.has(videoPath)) continue;

      // For movies, only import if there's no MediaFile at all
      const existingFile = await prisma.mediaFile.findFirst({
        where: { mediaId: media.id },
      });
      if (existingFile) break;

      try {
        const fn = basename(videoPath);
        const fnData = parseFilenameMetadata(fn);
        const mi = await scanMediaInfo(videoPath);
        const fileData = mi
          ? {
              mediaId: media.id,
              episodeId: null as number | null,
              filePath: videoPath,
              fileName: fn,
              sizeBytes: mi.sizeBytes,
              durationSecs: mi.durationSecs,
              releaseGroup: mi.releaseGroup,
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
              languageTags: classifyLanguageTags(
                mi.audioTracks as LibraryAudioTrack[],
                fn,
              ),
            }
          : {
              mediaId: media.id,
              episodeId: null as number | null,
              filePath: videoPath,
              fileName: fn,
              sizeBytes: BigInt(0),
              releaseGroup: null as string | null,
              resolution: fnData.resolution,
              source: fnData.source,
              hdrFormat: fnData.hdrFormat,
              audioTracks: [] as object[],
              subtitleTracks: [] as object[],
              languageTags: [] as string[],
            };
        await prisma.mediaFile.create({ data: fileData });
        await prisma.libraryMedia.update({
          where: { id: media.id },
          data: { status: "downloaded" },
        });
        imported++;
        console.log(
          `[scanLibrary] Imported untracked movie file "${fn}" for "${media.title}"`,
        );
        break; // one file per movie
      } catch (e) {
        console.warn(`[scanLibrary] Failed to import movie file:`, e);
      }
    }
  }

  return imported;
}

/**
 * Run after marking a download complete — never await from cron/webhook handlers.
 */
export function enqueueLibraryPostProcess(downloadHistoryId: number): void {
  void (async () => {
    try {
      const settings = await prisma.mediaSettings.findUnique({
        where: { id: 1 },
      });
      if (!settings?.postProcessingEnabled) return;

      const result = await postProcess(downloadHistoryId);

      // Look up mediaId for SSE broadcast (needed regardless of success/failure)
      const dh = await prisma.downloadHistory.findUnique({
        where: { id: downloadHistoryId },
        select: { mediaId: true },
      });

      if (!result.success) {
        await prisma.downloadHistory.update({
          where: { id: downloadHistoryId },
          data: { postProcessError: result.reason },
        });
        if (dh?.mediaId != null) emitLibraryUpdate(dh.mediaId);
        await notifyAdminsPostProcessFailed(downloadHistoryId, result.reason);
        return;
      }
      await prisma.downloadHistory.update({
        where: { id: downloadHistoryId },
        data: {
          postProcessDestinationPath: result.destinationPath,
          postProcessError: null,
        },
      });
      if (dh?.mediaId != null) {
        emitLibraryUpdate(dh.mediaId);
        await notifyAdminsMediaDownloaded(dh.mediaId);
      }
      await triggerJellyfinLibraryScan();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[enqueueLibraryPostProcess] Unexpected error dh=${downloadHistoryId}:`,
        e,
      );
      try {
        await prisma.downloadHistory.update({
          where: { id: downloadHistoryId },
          data: { postProcessError: msg },
        });
        await notifyAdminsPostProcessFailed(downloadHistoryId, msg);
      } catch (e) {
        console.warn(
          `[postProcess] failed to persist postProcessError dh=${downloadHistoryId}:`,
          e,
        );
      }
    }
  })();
}
