import type { Job } from "bullmq";
import { prisma } from "@hously/api/db";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeTmdbConfig } from "@hously/api/utils/integrations/normalizers";
import {
  scanMediaInfo,
  remapPath,
} from "@hously/api/utils/medias/mediainfoScanner";
import {
  parseFilenameMetadata,
  refineFrenchAudioLabel,
  expandLanguageCode,
} from "@hously/api/utils/medias/filenameParser";
import { sortTitleFromName } from "@hously/api/utils/medias/libraryHelpers";

// ─── Job data & progress types ────────────────────────────────────────────────

export type LibraryMigrateJobData = {
  source: "radarr" | "sonarr" | "both";
  requested_by: number;
  radarr_url?: string;
  radarr_api_key?: string;
  sonarr_url?: string;
  sonarr_api_key?: string;
};

export type LibraryMigrateProgress = {
  phase: "radarr" | "sonarr" | "done";
  current: number;
  total: number;
  current_title: string | null;
  radarr: {
    imported: number;
    already_existed: number;
    skipped: number;
    files_scanned: number;
    errors: number;
  };
  sonarr: {
    imported_shows: number;
    imported_episodes: number;
    imported_files: number;
    files_scanned: number;
    errors: number;
  };
};

export type LibraryMigrateResult = {
  radarr?: {
    imported: number;
    already_existed: number;
    skipped: number;
    files_scanned: number;
    errors: string[];
  };
  sonarr?: {
    imported_shows: number;
    imported_episodes: number;
    imported_files: number;
    files_scanned: number;
    errors: string[];
  };
};

// ─── Radarr type ─────────────────────────────────────────────────────────────

type RadarrMovie = {
  id: number;
  title: string;
  year: number;
  tmdbId: number;
  hasFile: boolean;
  overview?: string;
  added?: string;
  images: Array<{ remoteUrl: string; coverType: string }>;
  movieFile?: {
    id: number;
    path: string;
    size: number;
    releaseGroup?: string;
    edition?: string;
    languages?: Array<{ id: number; name: string }>;
    customFormats?: Array<{ name: string }>;
    mediaInfo?: {
      videoCodec?: string;
      width?: number;
      height?: number;
      videoBitDepth?: number;
      videoDynamicRangeType?: string;
      audioLanguages?: string;
      audioCodec?: string;
      audioChannels?: number;
      subtitles?: string;
      runTime?: string;
    };
  };
};

// ─── Sonarr types ─────────────────────────────────────────────────────────────

type SonarrSeries = {
  id: number;
  title: string;
  year: number;
  tvdbId: number;
  overview?: string;
  added?: string;
  images: Array<{ remoteUrl: string; coverType: string }>;
  seasons: Array<{
    seasonNumber: number;
    statistics?: { episodeFileCount: number };
  }>;
};

type SonarrEp = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title?: string;
  airDate?: string;
  hasFile: boolean;
  episodeFileId?: number | null;
};

type SonarrFile = {
  id: number;
  seasonNumber: number;
  path: string;
  size: number;
  releaseGroup?: string;
  languages?: Array<{ id: number; name: string }>;
  customFormats?: Array<{ name: string }>;
  mediaInfo?: {
    videoCodec?: string;
    width?: number;
    height?: number;
    videoBitDepth?: number;
    videoDynamicRangeType?: string;
    audioLanguages?: string;
    audioCodec?: string;
    audioChannels?: number;
    subtitles?: string;
    runTime?: string;
  };
};

// ─── Codec helpers ────────────────────────────────────────────────────────────

function normalizeVideoCodec(c: string | undefined): string | null {
  if (!c) return null;
  const m: Record<string, string> = {
    h265: "HEVC",
    x265: "HEVC",
    h264: "AVC",
    x264: "AVC",
    av1: "AV1",
    xvid: "XviD",
    divx: "DivX",
    mpeg2: "MPEG-2",
    vc1: "VC-1",
  };
  return m[c.toLowerCase()] ?? c;
}

function normalizeHdrFormat(d: string | undefined): string | null {
  if (!d) return null;
  const m: Record<string, string> = {
    HDR: "HDR10",
    HDR10: "HDR10",
    HDR10Plus: "HDR10+",
    DolbyVision: "Dolby Vision",
    HLG: "HLG",
  };
  return m[d] ?? null;
}

function parseChannelsLayout(n: number): string {
  if (n === 1) return "mono";
  if (n === 2) return "stereo";
  if (n === 6) return "5.1";
  if (n === 8) return "7.1";
  return `${n}ch`;
}

/**
 * Build audio tracks from Radarr/Sonarr flat mediaInfo fields + filename flags.
 * If `arrLanguages` is provided (movieFile.languages[]), use it as source of truth.
 */
function buildAudioTracksFromArr(
  mediaInfo: {
    audioLanguages?: string;
    audioCodec?: string;
    audioChannels?: number;
  },
  fileName: string,
  arrLanguages?: Array<{ id: number; name: string }>,
): object[] {
  const fnData = parseFilenameMetadata(fileName);

  // Prefer structured arrLanguages array over slash-delimited string
  const languages: string[] =
    arrLanguages && arrLanguages.length > 0
      ? arrLanguages.map((l) => l.name)
      : (mediaInfo.audioLanguages ?? "")
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);

  if (!languages.length) return [];

  let frenchIdx = 0;
  return languages.map((lang, i) => {
    const isoLang = lang.toLowerCase().slice(0, 3); // crude 3-letter code
    const isFrench =
      /^(fre|fra|fr|french)$/i.test(isoLang) || /french/i.test(lang);

    let finalLang = isoLang;
    let finalName = lang;
    if (isFrench) {
      const refined = refineFrenchAudioLabel(
        isoLang,
        null,
        fnData.audioFlags,
        frenchIdx++,
      );
      finalLang = refined.language;
      finalName = refined.language_name;
    } else {
      finalName =
        expandLanguageCode(isoLang) !== isoLang
          ? expandLanguageCode(isoLang)
          : lang;
    }

    return {
      index: i,
      language: finalLang,
      language_name: finalName,
      title: null,
      codec: i === 0 ? (mediaInfo.audioCodec ?? null) : null,
      channels: i === 0 ? (mediaInfo.audioChannels ?? null) : null,
      channel_layout:
        i === 0 && mediaInfo.audioChannels
          ? parseChannelsLayout(mediaInfo.audioChannels)
          : null,
      bitrate_kbps: null,
      default: i === 0,
      forced: false,
    };
  });
}

function buildSubtitleTracksFromArr(mediaInfo: {
  subtitles?: string;
}): object[] {
  return (mediaInfo.subtitles ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((lang, i) => ({
      index: i,
      language: lang.toLowerCase().slice(0, 3),
      language_name: expandLanguageCode(lang.toLowerCase().slice(0, 3)) || lang,
      title: null,
      format: null,
      forced: false,
      hearing_impaired: false,
    }));
}

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch<T>(
  path: string,
  apiKey: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}/${path}`);
  url.searchParams.set("api_key", apiKey);
  if (params)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`TMDB ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function pickDigitalRelease(
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ type: number; release_date: string }>;
  }>,
): Date | null {
  for (const country of ["US", ...results.map((r) => r.iso_3166_1)]) {
    const entry = results.find((r) => r.iso_3166_1 === country);
    const digital = entry?.release_dates.find((d) => d.type === 4);
    if (digital) return new Date(digital.release_date);
  }
  return null;
}

// ─── Main processor ───────────────────────────────────────────────────────────

export async function processLibraryMigrateJob(
  job: Job<LibraryMigrateJobData>,
): Promise<LibraryMigrateResult> {
  const { source, radarr_url, radarr_api_key, sonarr_url, sonarr_api_key } =
    job.data;

  const tmdbIntegration = await getIntegrationConfigRecord("tmdb");
  const tmdbConfig = tmdbIntegration?.enabled
    ? normalizeTmdbConfig(tmdbIntegration.config)
    : null;

  const mediaSettings = await prisma.mediaSettings.findUnique({
    where: { id: 1 },
  });
  const defaultQualityProfileId =
    mediaSettings?.defaultQualityProfileId ?? null;

  const progress: LibraryMigrateProgress = {
    phase: "radarr",
    current: 0,
    total: 0,
    current_title: null,
    radarr: {
      imported: 0,
      already_existed: 0,
      skipped: 0,
      files_scanned: 0,
      errors: 0,
    },
    sonarr: {
      imported_shows: 0,
      imported_episodes: 0,
      imported_files: 0,
      files_scanned: 0,
      errors: 0,
    },
  };

  const result: LibraryMigrateResult = {};

  const push = async () => job.updateProgress(progress as unknown as object);

  // ── Clear existing data for the selected source ────────────────────────────
  if (source === "radarr" || source === "both") {
    await prisma.libraryMedia.deleteMany({ where: { type: "movie" } });
  }
  if (source === "sonarr" || source === "both") {
    await prisma.libraryMedia.deleteMany({ where: { type: "show" } });
  }

  // ── Radarr ─────────────────────────────────────────────────────────────────
  if (source === "radarr" || source === "both") {
    const radarrErrors: string[] = [];
    result.radarr = {
      imported: 0,
      already_existed: 0,
      skipped: 0,
      files_scanned: 0,
      errors: radarrErrors,
    };

    try {
      if (!radarr_url || !radarr_api_key) {
        radarrErrors.push("Radarr URL and API key are required");
      } else {
        const moviesRes = await fetch(`${radarr_url}/api/v3/movie`, {
          headers: { "X-Api-Key": radarr_api_key },
          signal: AbortSignal.timeout(30_000),
        });
        if (!moviesRes.ok)
          throw new Error(`Radarr responded ${moviesRes.status}`);
        const movies = (await moviesRes.json()) as RadarrMovie[];

        progress.total = movies.length;
        await push();

        for (const movie of movies) {
          progress.current++;
          progress.current_title = movie.title;
          await push();

          try {
            if (!movie.tmdbId) {
              progress.radarr.skipped++;
              result.radarr!.skipped++;
              continue;
            }

            const poster =
              movie.images.find((i) => i.coverType === "poster")?.remoteUrl ??
              null;

            const existing = await prisma.libraryMedia.findUnique({
              where: { tmdbId: movie.tmdbId },
              select: { id: true },
            });

            let digitalReleaseDate: Date | null = null;
            if (tmdbConfig) {
              try {
                const rd = await tmdbFetch<{
                  results: Array<{
                    iso_3166_1: string;
                    release_dates: Array<{
                      type: number;
                      release_date: string;
                    }>;
                  }>;
                }>(`movie/${movie.tmdbId}/release_dates`, tmdbConfig.api_key);
                digitalReleaseDate = pickDigitalRelease(rd.results);
              } catch (e) {
                console.warn(
                  `[libraryMigrate] TMDB release_dates movie=${movie.tmdbId}:`,
                  e,
                );
              }
            }

            const mediaRow = await prisma.libraryMedia.upsert({
              where: { tmdbId: movie.tmdbId },
              create: {
                tmdbId: movie.tmdbId,
                type: "movie",
                title: movie.title,
                sortTitle: sortTitleFromName(movie.title),
                year: movie.year || null,
                status: movie.hasFile ? "downloaded" : "wanted",
                posterUrl: poster,
                overview: movie.overview || null,
                digitalReleaseDate,
                ...(movie.added ? { addedAt: new Date(movie.added) } : {}),
                ...(defaultQualityProfileId != null
                  ? { qualityProfileId: defaultQualityProfileId }
                  : {}),
              },
              update: {
                title: movie.title,
                year: movie.year || null,
                posterUrl: poster,
                status: movie.hasFile ? "downloaded" : "wanted",
                digitalReleaseDate,
              },
            });

            if (existing) {
              progress.radarr.already_existed++;
              result.radarr!.already_existed++;
            } else {
              progress.radarr.imported++;
              result.radarr!.imported++;
            }

            if (movie.hasFile && movie.movieFile) {
              const mf = movie.movieFile;
              const filePath = remapPath(mf.path ?? "");
              const fileName = filePath.split("/").pop() ?? "";
              const fnData = parseFilenameMetadata(fileName);

              const existingFile = await prisma.mediaFile.findFirst({
                where: { mediaId: mediaRow.id },
                select: { id: true },
              });

              // Always scan — rescan updates existing records with fresh MediaInfo data
              const mi = filePath ? await scanMediaInfo(filePath) : null;

              if (mi) {
                progress.radarr.files_scanned++;
                result.radarr!.files_scanned++;
                const miData = {
                  filePath,
                  fileName,
                  sizeBytes: mi.sizeBytes,
                  durationSecs: mi.durationSecs,
                  releaseGroup: mf.releaseGroup ?? mi.releaseGroup,
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
                };
                if (existingFile) {
                  await prisma.mediaFile.update({
                    where: { id: existingFile.id },
                    data: miData,
                  });
                } else {
                  await prisma.mediaFile.create({
                    data: { mediaId: mediaRow.id, ...miData },
                  });
                }
              } else {
                // Fall back to Radarr's flat mediaInfo
                const arrMi = mf.mediaInfo ?? {};
                const arrData = {
                  filePath,
                  fileName,
                  sizeBytes: BigInt(mf.size ?? 0),
                  releaseGroup: mf.releaseGroup ?? null,
                  videoCodec: normalizeVideoCodec(arrMi.videoCodec),
                  width: arrMi.width ?? null,
                  height: arrMi.height ?? null,
                  bitDepth: arrMi.videoBitDepth ?? null,
                  hdrFormat:
                    normalizeHdrFormat(arrMi.videoDynamicRangeType) ??
                    fnData.hdrFormat,
                  resolution: fnData.resolution,
                  source: fnData.source,
                  audioTracks: buildAudioTracksFromArr(
                    arrMi,
                    fileName,
                    mf.languages,
                  ),
                  subtitleTracks: buildSubtitleTracksFromArr(arrMi),
                };
                if (existingFile) {
                  await prisma.mediaFile.update({
                    where: { id: existingFile.id },
                    data: arrData,
                  });
                } else {
                  await prisma.mediaFile.create({
                    data: { mediaId: mediaRow.id, ...arrData },
                  });
                }
              }
            }
          } catch (err) {
            progress.radarr.errors++;
            result.radarr!.errors.push(
              `Movie ${movie.title}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    } catch (err) {
      result.radarr!.errors.push(
        `Radarr import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Sonarr ─────────────────────────────────────────────────────────────────
  if (source === "sonarr" || source === "both") {
    const sonarrErrors: string[] = [];
    result.sonarr = {
      imported_shows: 0,
      imported_episodes: 0,
      imported_files: 0,
      files_scanned: 0,
      errors: sonarrErrors,
    };

    try {
      if (!sonarr_url || !sonarr_api_key) {
        sonarrErrors.push("Sonarr URL and API key are required");
      } else {
        const seriesRes = await fetch(`${sonarr_url}/api/v3/series`, {
          headers: { "X-Api-Key": sonarr_api_key },
          signal: AbortSignal.timeout(30_000),
        });
        if (!seriesRes.ok)
          throw new Error(`Sonarr responded ${seriesRes.status}`);
        const allSeries = (await seriesRes.json()) as SonarrSeries[];

        progress.phase = "sonarr";
        progress.current = 0;
        progress.total = allSeries.length;
        await push();

        for (const series of allSeries) {
          progress.current++;
          progress.current_title = series.title;
          await push();

          try {
            if (!series.tvdbId) {
              sonarrErrors.push(`Series ${series.title}: no TVDB ID`);
              continue;
            }

            // Resolve TVDB → TMDB
            let tmdbId: number | null = null;
            if (tmdbConfig) {
              try {
                const findRes = await tmdbFetch<{
                  tv_results: Array<{ id: number }>;
                }>(`find/${series.tvdbId}`, tmdbConfig.api_key, {
                  external_source: "tvdb_id",
                });
                tmdbId = findRes.tv_results[0]?.id ?? null;
              } catch (e) {
                console.warn(
                  `[libraryMigrate] TMDB find tvdb_id=${series.tvdbId}:`,
                  e,
                );
              }
            }
            if (!tmdbId) {
              sonarrErrors.push(
                `Series ${series.title}: could not resolve TMDB ID from TVDB ${series.tvdbId}`,
              );
              continue;
            }

            const poster =
              series.images.find((i) => i.coverType === "poster")?.remoteUrl ??
              null;
            const hasAnyFile = series.seasons.some(
              (s) => (s.statistics?.episodeFileCount ?? 0) > 0,
            );

            const mediaRow = await prisma.libraryMedia.upsert({
              where: { tmdbId },
              create: {
                tmdbId,
                type: "show",
                title: series.title,
                sortTitle: sortTitleFromName(series.title),
                year: series.year || null,
                status: hasAnyFile ? "downloaded" : "wanted",
                posterUrl: poster,
                overview: series.overview || null,
                ...(series.added ? { addedAt: new Date(series.added) } : {}),
                ...(defaultQualityProfileId != null
                  ? { qualityProfileId: defaultQualityProfileId }
                  : {}),
              },
              update: {
                title: series.title,
                year: series.year || null,
                posterUrl: poster,
                status: hasAnyFile ? "downloaded" : "wanted",
              },
            });

            progress.sonarr.imported_shows++;
            result.sonarr!.imported_shows++;

            // Fetch episodes
            const epsRes = await fetch(
              `${sonarr_url!}/api/v3/episode?seriesId=${series.id}`,
              {
                headers: { "X-Api-Key": sonarr_api_key! },
                signal: AbortSignal.timeout(15_000),
              },
            );
            if (!epsRes.ok) throw new Error(`Sonarr episodes ${epsRes.status}`);
            const episodes = (await epsRes.json()) as SonarrEp[];

            // Build sonarrFileId → episodeNumber map for correct file↔episode linking
            const fileIdToEpNum = new Map<number, number>();
            for (const ep of episodes) {
              if (ep.episodeFileId)
                fileIdToEpNum.set(ep.episodeFileId, ep.episodeNumber);
            }

            for (const ep of episodes) {
              if (ep.seasonNumber === 0) continue;
              await prisma.libraryEpisode.upsert({
                where: {
                  mediaId_season_episode: {
                    mediaId: mediaRow.id,
                    season: ep.seasonNumber,
                    episode: ep.episodeNumber,
                  },
                },
                create: {
                  mediaId: mediaRow.id,
                  season: ep.seasonNumber,
                  episode: ep.episodeNumber,
                  title: ep.title || null,
                  airDate: ep.airDate ? new Date(ep.airDate) : null,
                  status: ep.hasFile ? "downloaded" : "wanted",
                },
                update: {
                  title: ep.title || null,
                  airDate: ep.airDate ? new Date(ep.airDate) : null,
                  status: ep.hasFile ? "downloaded" : "wanted",
                },
              });
              progress.sonarr.imported_episodes++;
              result.sonarr!.imported_episodes++;
            }

            // Fetch episode files and scan with MediaInfo
            const filesRes = await fetch(
              `${sonarr_url!}/api/v3/episodefile?seriesId=${series.id}`,
              {
                headers: { "X-Api-Key": sonarr_api_key! },
                signal: AbortSignal.timeout(15_000),
              },
            );
            if (filesRes.ok) {
              const files = (await filesRes.json()) as SonarrFile[];

              for (const file of files) {
                const filePath = remapPath(file.path);
                const fileName = filePath.split("/").pop() ?? "";

                // Parse episode number from filename (e.g. "Show.S04E07.mkv" → 7)
                // More reliable than episodeFileId from Sonarr API
                const epMatch = fileName.match(/[Ss]\d{1,2}[Ee](\d{1,3})/);
                const epNumber = epMatch
                  ? parseInt(epMatch[1], 10)
                  : (fileIdToEpNum.get(file.id) ?? null);

                const epRow = await prisma.libraryEpisode.findFirst({
                  where: {
                    mediaId: mediaRow.id,
                    season: file.seasonNumber,
                    ...(epNumber != null ? { episode: epNumber } : {}),
                  },
                  select: { id: true },
                });

                const fnData = parseFilenameMetadata(fileName);

                const existingFile = await prisma.mediaFile.findFirst({
                  where: { filePath },
                  select: { id: true },
                });

                // Always scan — rescan updates existing records with fresh MediaInfo data
                const mi = filePath ? await scanMediaInfo(filePath) : null;

                if (mi) {
                  progress.sonarr.files_scanned++;
                  result.sonarr!.files_scanned++;
                  const miData = {
                    episodeId: epRow?.id ?? null,
                    mediaId: mediaRow.id,
                    filePath,
                    fileName,
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
                  };
                  if (existingFile) {
                    await prisma.mediaFile.update({
                      where: { id: existingFile.id },
                      data: miData,
                    });
                  } else {
                    await prisma.mediaFile.create({ data: miData });
                  }
                } else {
                  const arrMi = file.mediaInfo ?? {};
                  const arrData = {
                    episodeId: epRow?.id ?? null,
                    mediaId: mediaRow.id,
                    filePath,
                    fileName,
                    sizeBytes: BigInt(file.size ?? 0),
                    releaseGroup: file.releaseGroup ?? null,
                    videoCodec: normalizeVideoCodec(arrMi.videoCodec),
                    width: arrMi.width ?? null,
                    height: arrMi.height ?? null,
                    bitDepth: arrMi.videoBitDepth ?? null,
                    hdrFormat:
                      normalizeHdrFormat(arrMi.videoDynamicRangeType) ??
                      fnData.hdrFormat,
                    resolution: fnData.resolution,
                    source: fnData.source,
                    audioTracks: buildAudioTracksFromArr(
                      arrMi,
                      fileName,
                      file.languages,
                    ),
                    subtitleTracks: buildSubtitleTracksFromArr(arrMi),
                  };
                  if (existingFile) {
                    await prisma.mediaFile.update({
                      where: { id: existingFile.id },
                      data: arrData,
                    });
                  } else {
                    await prisma.mediaFile.create({ data: arrData });
                  }
                }
                progress.sonarr.imported_files++;
                result.sonarr!.imported_files++;
              }
            }
          } catch (err) {
            progress.sonarr.errors++;
            sonarrErrors.push(
              `Series ${series.title}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
    } catch (err) {
      result.sonarr!.errors.push(
        `Sonarr import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  progress.phase = "done";
  progress.current_title = null;
  await push();

  return result;
}
