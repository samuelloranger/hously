/**
 * Full release preparation pipeline for C411.
 */

import { dirname, extname, join, relative } from 'node:path';
import { link, mkdir, rm, stat } from 'node:fs/promises';
import { Prisma } from '@prisma/client';
import { buildC411ReleaseNotificationUrl } from '@hously/shared';
import { prisma } from '../../db';
import { createAndQueueNotification } from '../../jobs/notificationService';
import { normalizeRadarrConfig, normalizeSonarrConfig } from '../../utils/plugins/normalizers';
import { addJob, QUEUE_NAMES } from '../queueService';
import { uploadToS3, deleteFromS3 } from '../s3Service';
import { loadC411Config } from './session';
import { getMediaInfo, type MediaInfoData } from './mediainfo';
import { detectLanguages } from './lang-detect';
import { fetchTmdbDetails, buildFallbackTmdbDetails, type TmdbDetails } from './tmdb';
import {
  buildReleaseName,
  formatReleaseSize,
  calcPieceLength,
  resolveCategory,
  resolveLanguage,
  resolveGenres,
} from '@hously/shared';
import { generateBBCode, buildReleaseInfo } from './bbcode';
import { createTorrent } from './mktorrent';
import type { LanguageTag } from './types';

const MOVIE_HARDLINK_BASE = '/mnt/storage/Downloads/movies';
const TV_HARDLINK_BASE = '/mnt/storage/Downloads/tv_shows';

type MediaService = 'radarr' | 'sonarr';

type ArrConfig = {
  apiKey: string;
  baseUrl: string;
  rootFolderPath: string;
};

type ReleaseSourceFile = {
  path: string;
  size: number;
  relativePath: string;
  sceneName: string;
  releaseGroup: string;
};

export type ResolvedReleaseSource = {
  service: MediaService;
  sourceId: number;
  seasonNumber: number | null;
  sourceTitle: string;
  originalPath: string;
  originalName: string;
  primaryFilePath: string;
  primaryFileRelativePath: string;
  releaseGroup: string;
  tmdbId: number;
  imdbId: string;
  tmdbType: 'movie' | 'tv';
  hardlinkBase: string;
  qbittorrentCategory: 'radarr' | 'tv-sonarr';
  files: ReleaseSourceFile[];
  totalSize: number;
};

type PreparedReleaseArtifacts = {
  c411Name: string;
  hardlinkPath: string;
  torrentS3Key: string;
  nfoContent: string;
  bbcode: string;
  media: MediaInfoData;
  tmdb: TmdbDetails;
  languageTag: LanguageTag;
  totalSize: number;
  options: Record<string, number[]>;
  metadata: Prisma.InputJsonObject;
};

export interface PrepareReleaseOptions {
  service?: MediaService;
  sourceId?: number;
  seasonNumber?: number | null;
  radarrMovieId?: number;
  radarrSourceId?: number;
  requestedByUserId?: number;
}

interface PrepareReleaseResult {
  releaseId: number;
  queued: boolean;
}

type RadarrMovie = {
  id: number;
  title?: string | null;
  tmdbId: number;
  imdbId?: string | null;
  hasFile: boolean;
  movieFile?: {
    path: string;
    size?: number;
    sceneName?: string | null;
    relativePath?: string | null;
    releaseGroup?: string | null;
  } | null;
};

type SonarrSeries = {
  id: number;
  title?: string | null;
  path?: string | null;
  tmdbId: number;
  imdbId?: string | null;
};

type SonarrEpisode = {
  seasonNumber?: number | null;
  episodeFileId?: number | null;
  episodeFile?: {
    path?: string | null;
    size?: number | null;
    relativePath?: string | null;
    sceneName?: string | null;
    releaseGroup?: string | null;
  } | null;
};

function normalizePrepareOptions(options: PrepareReleaseOptions): {
  service: MediaService;
  sourceId: number;
  seasonNumber: number | null;
} {
  const service = options.service ?? 'radarr';
  const sourceId = options.sourceId ?? options.radarrSourceId ?? options.radarrMovieId ?? null;
  const seasonNumber = options.seasonNumber == null ? null : Math.trunc(options.seasonNumber);

  if (service !== 'radarr' && service !== 'sonarr') {
    throw new Error('Unsupported release source');
  }
  if (!sourceId || !Number.isFinite(sourceId) || sourceId <= 0) {
    throw new Error('Invalid source ID');
  }
  if (service === 'sonarr' && (!Number.isFinite(seasonNumber ?? Number.NaN) || (seasonNumber ?? 0) <= 0)) {
    throw new Error('seasonNumber is required for Sonarr releases');
  }

  return { service, sourceId, seasonNumber };
}

async function loadArrConfig(service: MediaService): Promise<ArrConfig> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: service, enabled: true },
    select: { config: true },
  });

  if (!plugin?.config) {
    throw new Error(`${service === 'radarr' ? 'Radarr' : 'Sonarr'} plugin not configured`);
  }

  const normalized =
    service === 'radarr'
      ? normalizeRadarrConfig(plugin.config)
      : normalizeSonarrConfig(plugin.config);

  if (!normalized) {
    throw new Error(`${service === 'radarr' ? 'Radarr' : 'Sonarr'} plugin not configured`);
  }

  return {
    apiKey: normalized.api_key,
    baseUrl: normalized.website_url.replace(/\/$/, ''),
    rootFolderPath: normalized.root_folder_path,
  };
}

async function loadTmdbApiKey(): Promise<string> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: { startsWith: 'tmdb' }, enabled: true },
    select: { config: true },
  });
  if (!plugin?.config) throw new Error('TMDB plugin not configured');
  return (plugin.config as Record<string, unknown>).api_key as string;
}

async function fetchArrJson<T>(config: ArrConfig, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, config.baseUrl);
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': config.apiKey, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Arr API error (${res.status}) for ${url.pathname}`);
  }

  return res.json() as Promise<T>;
}

async function fetchRadarrMovie(config: ArrConfig, movieId: number): Promise<RadarrMovie> {
  return fetchArrJson<RadarrMovie>(config, `/api/v3/movie/${movieId}`);
}

async function fetchReleaseGroupFromHistory(config: ArrConfig, movieId: number): Promise<string> {
  try {
    const history = await fetchArrJson<any[]>(config, '/api/v3/history/movie', {
      movieId: String(movieId),
    });
    const grabbed = history.find((entry) => entry?.eventType === 'grabbed' && entry?.data?.releaseGroup);
    return grabbed?.data?.releaseGroup || '';
  } catch {
    return '';
  }
}

async function fetchSonarrSeries(config: ArrConfig, seriesId: number): Promise<SonarrSeries> {
  return fetchArrJson<SonarrSeries>(config, `/api/v3/series/${seriesId}`);
}

async function fetchSonarrSeasonEpisodes(
  config: ArrConfig,
  seriesId: number,
  seasonNumber: number,
): Promise<SonarrEpisode[]> {
  return fetchArrJson<SonarrEpisode[]>(config, '/api/v3/episode', {
    seriesId: String(seriesId),
    seasonNumber: String(seasonNumber),
    includeEpisodeFile: 'true',
  });
}

function remapArrPath(contentPath: string): string {
  return contentPath.replace(/^\/data\//, '/mnt/storage/');
}

function commonParentDirectory(paths: string[]): string {
  if (paths.length === 0) throw new Error('No paths to normalize');
  if (paths.length === 1) return dirname(paths[0]);

  const split = paths.map((candidate) => dirname(candidate).split('/').filter(Boolean));
  const common: string[] = [];

  for (let index = 0; index < split[0].length; index++) {
    const value = split[0][index];
    if (split.every((parts) => parts[index] === value)) {
      common.push(value);
    } else {
      break;
    }
  }

  return common.length > 0 ? `/${common.join('/')}` : '/';
}

function sanitizeRelativePath(filePath: string, sourceRoot: string): string {
  const rel = relative(sourceRoot, filePath);
  if (!rel || rel.startsWith('..')) return filePath.split('/').pop() ?? filePath;
  return rel;
}

async function resolveMovieSource(sourceId: number): Promise<ResolvedReleaseSource> {
  const radarrConfig = await loadArrConfig('radarr');
  const movie = await fetchRadarrMovie(radarrConfig, sourceId);
  if (!movie.hasFile || !movie.movieFile?.path) {
    throw new Error('Movie has no file in Radarr');
  }

  const originalPath = remapArrPath(movie.movieFile.path);
  const originalName = movie.movieFile.sceneName || movie.movieFile.relativePath || '';
  let releaseGroup = movie.movieFile.releaseGroup || '';

  if (!releaseGroup) {
    releaseGroup = await fetchReleaseGroupFromHistory(radarrConfig, sourceId);
    if (releaseGroup) {
      console.log(`[c411:prepare] Found release group from history: ${releaseGroup}`);
    }
  }

  const fileSize = movie.movieFile.size != null ? Number(movie.movieFile.size) : Number((await stat(originalPath)).size);
  const primaryRelativePath = originalPath.split('/').pop() ?? originalPath;

  return {
    service: 'radarr',
    sourceId,
    seasonNumber: null,
    sourceTitle: movie.title || originalName || 'Movie',
    originalPath,
    originalName,
    primaryFilePath: originalPath,
    primaryFileRelativePath: primaryRelativePath,
    releaseGroup,
    tmdbId: movie.tmdbId,
    imdbId: movie.imdbId || '',
    tmdbType: 'movie',
    hardlinkBase: MOVIE_HARDLINK_BASE,
    qbittorrentCategory: 'radarr',
    files: [{
      path: originalPath,
      size: fileSize,
      relativePath: primaryRelativePath,
      sceneName: originalName,
      releaseGroup,
    }],
    totalSize: fileSize,
  };
}

async function resolveSeasonSource(sourceId: number, seasonNumber: number): Promise<ResolvedReleaseSource> {
  const sonarrConfig = await loadArrConfig('sonarr');
  const [series, episodes] = await Promise.all([
    fetchSonarrSeries(sonarrConfig, sourceId),
    fetchSonarrSeasonEpisodes(sonarrConfig, sourceId, seasonNumber),
  ]);

  const fileMap = new Map<string, ReleaseSourceFile>();
  for (const episode of episodes) {
    const episodeFile = episode.episodeFile;
    if (!episodeFile?.path) continue;

    const mappedPath = remapArrPath(episodeFile.path);
    if (fileMap.has(mappedPath)) continue;

    fileMap.set(mappedPath, {
      path: mappedPath,
      size: Number(episodeFile.size ?? 0),
      relativePath: episodeFile.relativePath || mappedPath.split('/').pop() || mappedPath,
      sceneName: episodeFile.sceneName || episodeFile.relativePath || mappedPath.split('/').pop() || '',
      releaseGroup: episodeFile.releaseGroup || '',
    });
  }

  const files = Array.from(fileMap.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (files.length === 0) {
    throw new Error(`No downloaded files found in Sonarr for season ${seasonNumber}`);
  }

  const originalPath = commonParentDirectory(files.map((file) => file.path));
  const primaryFile = [...files].sort((left, right) => right.size - left.size)[0];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const releaseGroup = files.find((file) => file.releaseGroup)?.releaseGroup || '';
  const fallbackName = `${series.title || 'Series'}.S${String(seasonNumber).padStart(2, '0')}`;

  return {
    service: 'sonarr',
    sourceId,
    seasonNumber,
    sourceTitle: series.title || fallbackName,
    originalPath,
    originalName: primaryFile.sceneName || fallbackName,
    primaryFilePath: primaryFile.path,
    primaryFileRelativePath: sanitizeRelativePath(primaryFile.path, originalPath),
    releaseGroup,
    tmdbId: series.tmdbId,
    imdbId: series.imdbId || '',
    tmdbType: 'tv',
    hardlinkBase: TV_HARDLINK_BASE,
    qbittorrentCategory: 'tv-sonarr',
    files: files.map((file) => ({
      ...file,
      relativePath: sanitizeRelativePath(file.path, originalPath),
    })),
    totalSize,
  };
}

async function resolveReleaseSource(options: PrepareReleaseOptions): Promise<ResolvedReleaseSource> {
  const normalized = normalizePrepareOptions(options);
  return normalized.service === 'radarr'
    ? resolveMovieSource(normalized.sourceId)
    : resolveSeasonSource(normalized.sourceId, normalized.seasonNumber!);
}

function inferLanguageTag(originalName: string, media: MediaInfoData, languageTag: LanguageTag): LanguageTag {
  const name = originalName.toUpperCase();

  // If raw detection (ffprobe) gave us a specific variant, use it.
  // If it gave us a generic VFF, check if mediainfo (already patched) found a better variant in the titles.
  let resolvedTag = languageTag;
  if (resolvedTag === 'VFF') {
    const refined = media.audioStreams.find((s) => s.language === 'VFQ' || s.language === 'VFF' || s.language === 'VFI');
    if (refined) resolvedTag = refined.language as LanguageTag;
  }

  if (resolvedTag === 'VFF' || resolvedTag === 'VFQ' || resolvedTag === 'VFI') return resolvedTag;

  // If detected MULTI variant, use it
  if (resolvedTag.startsWith('MULTI.')) return resolvedTag;

  // Fallback to name-based detection for MULTI
  if (name.includes('MULTI') && name.includes('VF2')) return 'MULTI.VF2';
  if (name.includes('MULTI') && name.includes('VFQ')) return 'MULTI.VFQ';
  if (name.includes('MULTI') && name.includes('VFI')) return 'MULTI.VFI';
  if (name.includes('MULTI')) return 'MULTI.VFF';

  // Specific tag detection in name
  if (name.includes('VFQ')) return 'VFQ';
  if (name.includes('VFF') || name.includes('TRUEFRENCH')) return 'VFF';
  if (name.includes('FRENCH')) return 'VFF';

  // Use the general detection if it found something (like 'EN')
  if (languageTag !== 'UNKNOWN') return languageTag;

  // Last resort fallbacks
  if (media.audioStreams.length <= 1) return 'EN';
  return 'UNKNOWN';
}

async function ensureHardlink(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await stat(targetPath);
    return;
  } catch {
    await mkdir(dirname(targetPath), { recursive: true });
    await link(sourcePath, targetPath);
  }
}

async function ensureHardlinkContent(source: ResolvedReleaseSource, releaseName: string): Promise<string> {
  if (source.files.length === 1 && source.service === 'radarr') {
    const hardlinkPath = join(source.hardlinkBase, `${releaseName}${extname(source.primaryFilePath)}`);
    await mkdir(source.hardlinkBase, { recursive: true });
    await ensureHardlink(source.primaryFilePath, hardlinkPath);
    return hardlinkPath;
  }

  const hardlinkPath = join(source.hardlinkBase, releaseName);
  await mkdir(hardlinkPath, { recursive: true });

  for (const file of source.files) {
    const relativePath = file.relativePath || sanitizeRelativePath(file.path, source.originalPath);
    const targetPath = join(hardlinkPath, relativePath);
    await ensureHardlink(file.path, targetPath);
  }

  return hardlinkPath;
}

function buildNfoCompleteName(source: ResolvedReleaseSource, releaseName: string): string {
  if (source.files.length === 1 && source.service === 'radarr') {
    return `${releaseName}${extname(source.primaryFilePath)}`;
  }

  return join(releaseName, source.primaryFileRelativePath).replace(/\\/g, '/');
}

async function createTorrentArtifact(
  announceUrl: string,
  source: ResolvedReleaseSource,
  releaseName: string,
  hardlinkPath: string,
): Promise<{ torrentPath: string; cleanup: () => Promise<void> }> {
  const tmpDir = `/tmp/c411-${Date.now()}`;
  await mkdir(tmpDir, { recursive: true });

  const torrentPath = join(tmpDir, `${releaseName}.torrent`);
  const pieceLength = calcPieceLength(source.totalSize);

  console.log('[c411:prepare] Creating torrent...');
  await createTorrent({
    announceUrl,
    pieceLength,
    outputPath: torrentPath,
    contentPath: hardlinkPath,
  });

  return {
    torrentPath,
    cleanup: async () => {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

async function buildPreparedArtifacts(source: ResolvedReleaseSource): Promise<PreparedReleaseArtifacts> {
  const [c411Config, tmdbApiKey] = await Promise.all([
    loadC411Config(),
    loadTmdbApiKey(),
  ]);

  if (!c411Config.announceUrl) {
    throw new Error('C411 announce_url not configured');
  }

  console.log(`[c411:prepare] Running mediainfo on ${source.originalPath}`);
  const media = await getMediaInfo(source.originalPath, source.originalName);
  if (!media) {
    throw new Error(`MediaInfo failed for ${source.originalPath}`);
  }

  console.log('[c411:prepare] Detecting languages...');
  const rawLanguageTag = await detectLanguages(source.originalPath);
  const languageTag = inferLanguageTag(source.originalName, media, rawLanguageTag);
  console.log(`[c411:prepare] Language: ${languageTag}`);

  console.log(`[c411:prepare] Fetching TMDB details for ${source.tmdbId}...`);
  let tmdb = await fetchTmdbDetails(tmdbApiKey, source.tmdbType, source.tmdbId).catch(() => null);
  if (!tmdb) {
    tmdb = buildFallbackTmdbDetails(source.originalName);
  }

  const releaseInfo = buildReleaseInfo(
    tmdb,
    media,
    source.originalName,
    languageTag !== 'UNKNOWN' ? languageTag : undefined,
  );
  const c411Name = buildReleaseName(
    releaseInfo,
    source.originalName,
    source.releaseGroup || undefined,
  );
  console.log(`[c411:prepare] Release name: ${c411Name}`);

  const hardlinkPath = await ensureHardlinkContent(source, c411Name);
  const { torrentPath, cleanup } = await createTorrentArtifact(
    c411Config.announceUrl,
    source,
    c411Name,
    hardlinkPath,
  );

  try {
    const torrentBuffer = await Bun.file(torrentPath).arrayBuffer();
    const torrentS3Key = `c411/torrents/${c411Name}.torrent`;
    const uploaded = await uploadToS3(Buffer.from(torrentBuffer), torrentS3Key, 'application/x-bittorrent');
    if (!uploaded) {
      throw new Error('Failed to upload .torrent to S3');
    }

    const nfoContent = media.fullOutput.replace(
      /^(Complete name\s*:\s*).*$/m,
      `$1${buildNfoCompleteName(source, c411Name)}`,
    );
    const bbcode = generateBBCode({
      tmdb,
      media,
      releaseName: c411Name,
      fileCount: source.files.length,
      totalSize: formatReleaseSize(source.totalSize),
      languages: languageTag !== 'UNKNOWN' ? languageTag : undefined,
      teamOverride: source.releaseGroup || undefined,
    });

    const { categoryId, subcategoryId } = resolveCategory(undefined, tmdb.type);
    const languageOptionIds = resolveLanguage(c411Name);
    const genreOptionIds = resolveGenres(bbcode);

    return {
      c411Name,
      hardlinkPath,
      torrentS3Key,
      nfoContent,
      bbcode,
      media,
      tmdb,
      languageTag,
      totalSize: source.totalSize,
      options: { '1': languageOptionIds, '5': genreOptionIds },
      metadata: {
        sizeHuman: formatReleaseSize(source.totalSize),
        platform: tmdb.network || null,
        originalName: source.originalName,
        releaseGroup: source.releaseGroup || null,
        service: source.service,
        sourceId: source.sourceId,
        seasonNumber: source.seasonNumber,
        fileCount: source.files.length,
        qbittorrentCategory: source.qbittorrentCategory,
      } satisfies Prisma.InputJsonObject,
    };
  } finally {
    await cleanup();
  }
}

function mapReleaseRecord(
  source: ResolvedReleaseSource,
  artifacts: PreparedReleaseArtifacts,
) {
  return {
    name: artifacts.c411Name,
    title: artifacts.tmdb.title,
    tmdbId: source.tmdbId,
    imdbId: source.imdbId || null,
    tmdbType: artifacts.tmdb.type,
    categoryId: resolveCategory(undefined, artifacts.tmdb.type).categoryId,
    subcategoryId: resolveCategory(undefined, artifacts.tmdb.type).subcategoryId,
    categoryName: artifacts.tmdb.type === 'movie' ? 'Films' : 'Séries',
    language: artifacts.languageTag !== 'UNKNOWN' ? artifacts.languageTag : null,
    resolution: artifacts.media.resolution !== 'N/A' ? artifacts.media.resolution : null,
    source: artifacts.media.source !== 'N/A' ? artifacts.media.source : null,
    videoCodec: artifacts.media.videoCodec !== 'N/A' ? artifacts.media.videoCodec : null,
    audioCodec: artifacts.media.audioStreams[0]?.codec || null,
    size: BigInt(artifacts.totalSize),
    status: 'local',
    torrentS3Key: artifacts.torrentS3Key,
    nfoContent: artifacts.nfoContent,
    hardlinkPath: artifacts.hardlinkPath,
    originalPath: source.originalPath,
    options: artifacts.options,
    tmdbData: {
      id: artifacts.tmdb.id,
      type: artifacts.tmdb.type,
      title: artifacts.tmdb.title,
      originalTitle: artifacts.tmdb.originalTitle,
      year: parseInt(artifacts.tmdb.year) || 0,
      overview: artifacts.tmdb.overview,
      posterUrl: artifacts.tmdb.posterUrl,
      genres: artifacts.tmdb.genres,
      rating: parseFloat(artifacts.tmdb.rating) || 0,
      directors: [artifacts.tmdb.director],
      cast: artifacts.tmdb.cast.map((name) => ({ name, character: '' })),
      releaseDate: artifacts.tmdb.releaseDate,
      countries: artifacts.tmdb.productionCountries,
      imdbId: artifacts.tmdb.imdbId,
    },
    metadata: artifacts.metadata,
  };
}

function buildPlaceholderName(source: ResolvedReleaseSource): string {
  if (source.service === 'sonarr' && source.seasonNumber !== null) {
    return `${source.sourceTitle} S${String(source.seasonNumber).padStart(2, '0')} (preparing...)`;
  }
  return `${source.sourceTitle} (preparing...)`;
}

function buildBaseMetadata(source: ResolvedReleaseSource): Prisma.InputJsonObject {
  return {
    service: source.service,
    sourceId: source.sourceId,
    seasonNumber: source.seasonNumber,
    fileCount: source.files.length,
    qbittorrentCategory: source.qbittorrentCategory,
    prepareError: null,
  } satisfies Prisma.InputJsonObject;
}

async function createPlaceholderRelease(source: ResolvedReleaseSource): Promise<number> {
  const { categoryId, subcategoryId } = resolveCategory(undefined, source.tmdbType);
  const release = await prisma.c411Release.create({
    data: {
      name: buildPlaceholderName(source),
      title: source.sourceTitle,
      tmdbId: source.tmdbId,
      imdbId: source.imdbId || null,
      tmdbType: source.tmdbType,
      categoryId,
      subcategoryId,
      categoryName: source.tmdbType === 'movie' ? 'Films' : 'Séries',
      size: BigInt(source.totalSize),
      status: 'preparing',
      originalPath: source.originalPath,
      metadata: buildBaseMetadata(source),
    },
    select: { id: true },
  });

  return release.id;
}

async function sendPrepareNotification(params: {
  userId: number | undefined;
  title: string;
  body: string;
  releaseId: number;
  tmdbId: number;
  success: boolean;
  seasonNumber: number | null;
}): Promise<void> {
  if (!params.userId) return;

  const url = buildC411ReleaseNotificationUrl(params.tmdbId, params.releaseId);

  await createAndQueueNotification(
    params.userId,
    params.title,
    params.body,
    'c411_release_prepare',
    url,
    {
      release_id: params.releaseId,
      tmdb_id: params.tmdbId,
      season_number: params.seasonNumber,
      success: params.success,
    },
  );
}

// Exported for the worker
export async function processQueuedPrepareRelease(
  releaseId: number,
  source: ResolvedReleaseSource,
  requestedByUserId?: number,
): Promise<void> {
  try {
    const artifacts = await buildPreparedArtifacts(source);
    await prisma.c411Release.update({
      where: { id: releaseId },
      data: mapReleaseRecord(source, artifacts),
    });

    await prisma.c411Presentation.upsert({
      where: { releaseId },
      update: { bbcode: artifacts.bbcode },
      create: { releaseId, bbcode: artifacts.bbcode },
    });

    console.log(`[c411:prepare] Release saved: id=${releaseId} name=${artifacts.c411Name}`);

    await sendPrepareNotification({
      userId: requestedByUserId,
      title: 'C411 release ready',
      body: `${artifacts.c411Name} is ready to review and publish.`,
      releaseId,
      tmdbId: source.tmdbId,
      success: true,
      seasonNumber: source.seasonNumber,
    });
  } catch (error: any) {
    const existing = await prisma.c411Release.findUnique({
      where: { id: releaseId },
      select: { metadata: true, hardlinkPath: true, torrentS3Key: true, title: true },
    });
    const existingMetadata =
      existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
        ? existing.metadata as Record<string, unknown>
        : {};
    const message = error?.message || 'Unknown prepare failure';

    await prisma.c411Release.update({
      where: { id: releaseId },
      data: {
        status: 'prepare_failed',
        metadata: {
          ...existingMetadata,
          prepareError: message,
        } satisfies Prisma.InputJsonObject,
      },
    });

    if (existing?.torrentS3Key) {
      await deleteFromS3(existing.torrentS3Key).catch(() => {});
    }
    if (existing?.hardlinkPath) {
      await removeHardlinkPath(existing.hardlinkPath).catch(() => {});
    }

    console.error(`[c411:prepare] Background prepare failed for release ${releaseId}:`, error);
    await sendPrepareNotification({
      userId: requestedByUserId,
      title: 'C411 release failed',
      body: `${existing?.title || source.sourceTitle}: ${message}`,
      releaseId,
      tmdbId: source.tmdbId,
      success: false,
      seasonNumber: source.seasonNumber,
    });
  }
}

function getStoredPrepareOptions(existing: {
  originalPath: string | null;
  metadata: unknown;
}) {
  const metadata =
    existing.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata)
      ? existing.metadata as Record<string, unknown>
      : null;

  const service = metadata?.service;
  const sourceId = metadata?.sourceId;
  const seasonNumber = metadata?.seasonNumber;

  if ((service === 'radarr' || service === 'sonarr') && typeof sourceId === 'number') {
    return {
      service,
      sourceId,
      seasonNumber: typeof seasonNumber === 'number' ? seasonNumber : null,
    } satisfies PrepareReleaseOptions;
  }

  return null;
}

async function removeHardlinkPath(hardlinkPath: string | null): Promise<void> {
  if (!hardlinkPath) return;

  try {
    const current = await stat(hardlinkPath);
    if (current.isDirectory()) {
      await rm(hardlinkPath, { recursive: true, force: true });
    } else {
      await rm(hardlinkPath, { force: true });
    }
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[c411] Failed to remove hardlink path ${hardlinkPath}: ${error.message}`);
    }
  }
}

/**
 * Prepare a full C411 release from a Radarr movie or a Sonarr season.
 */
export async function prepareRelease(options: PrepareReleaseOptions): Promise<PrepareReleaseResult> {
  const source = await resolveReleaseSource(options);
  const releaseId = await createPlaceholderRelease(source);

  // Enqueue to BullMQ
  await addJob(
    QUEUE_NAMES.C411_PREPARE,
    `prepare:${releaseId}`,
    {
      releaseId,
      source,
      requestedByUserId: options.requestedByUserId,
    }
  );

  console.log(`[c411:prepare] Release queued: id=${releaseId} source=${source.service}:${source.sourceId}`);
  return { releaseId, queued: true };
}

export async function fetchReleaseMediaInfoPreview(options: PrepareReleaseOptions) {
  const source = await resolveReleaseSource(options);
  const media = await getMediaInfo(source.originalPath, source.originalName);
  const languageTag = media ? inferLanguageTag(source.originalName, media, await detectLanguages(source.originalPath)) : 'UNKNOWN';

  return {
    file_path: source.originalPath,
    file_size: source.totalSize,
    file_count: source.files.length,
    scene_name: source.originalName,
    release_group: source.releaseGroup,
    language_tag: languageTag,
    media_info: media ? {
      container: media.container,
      resolution: media.resolution,
      video_codec: media.videoCodec,
      video_bitrate: media.videoBitrate,
      video_bit_depth: media.videoBitDepth,
      framerate: media.framerate,
      source: media.source,
      duration: media.duration,
      audio_streams: media.audioStreams.map((audio) => ({
        codec: audio.codec,
        channels: audio.channels,
        bitrate: audio.bitrate,
        language: audio.language,
        title: audio.title,
      })),
      subtitles: media.subtitles.map((subtitle) => ({
        language: subtitle.language,
        title: subtitle.title,
        format: subtitle.format,
        forced: subtitle.forced,
      })),
    } : null,
  };
}

/**
 * Refresh an existing C411 release in-place.
 */
export async function refreshRelease(releaseId: number): Promise<void> {
  const existing = await prisma.c411Release.findUnique({
    where: { id: releaseId },
    include: { presentation: true },
  });

  if (!existing) throw new Error('Release not found');

  const storedOptions = getStoredPrepareOptions(existing);
  if (!storedOptions) {
    throw new Error('Release cannot be refreshed because its source metadata is missing');
  }

  const source = await resolveReleaseSource(storedOptions);
  const artifacts = await buildPreparedArtifacts(source);
  const previousTorrentS3Key = existing.torrentS3Key;
  const previousHardlinkPath = existing.hardlinkPath;

  await prisma.c411Release.update({
    where: { id: releaseId },
    data: mapReleaseRecord(source, artifacts),
  });

  if (existing.presentation) {
    await prisma.c411Presentation.update({
      where: { id: existing.presentation.id },
      data: { bbcode: artifacts.bbcode },
    });
  } else {
    await prisma.c411Presentation.create({
      data: { releaseId, bbcode: artifacts.bbcode },
    });
  }

  if (previousTorrentS3Key && previousTorrentS3Key !== artifacts.torrentS3Key) {
    await deleteFromS3(previousTorrentS3Key);
  }
  if (previousHardlinkPath && previousHardlinkPath !== artifacts.hardlinkPath) {
    await removeHardlinkPath(previousHardlinkPath);
  }

  console.log(`[c411:refresh] Release refreshed: id=${releaseId} name=${artifacts.c411Name}`);
}
