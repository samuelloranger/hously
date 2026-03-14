/**
 * Full release preparation pipeline for C411.
 */

import { link, stat, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { prisma } from '../../db';
import { uploadToS3 } from '../s3Service';
import { loadC411Config } from './session';
import { getMediaInfo } from './mediainfo';
import { findMediaFile } from './lang-detect';
import { detectLanguages } from './lang-detect';
import { fetchTmdbDetails, buildFallbackTmdbDetails } from './tmdb';
import { buildC411ReleaseName } from './release-name';
import { generateBBCode, buildReleaseInfo } from './bbcode';
import { createTorrent } from './mktorrent';
import { calcPieceLength, formatSize } from './utils';
import { resolveCategory, resolveLanguage, resolveGenres } from './resolvers';
import type { LanguageTag } from './types';

const HARDLINK_BASE = '/mnt/storage/Downloads/movies';

interface PrepareReleaseOptions {
  /** Radarr movie source_id (the Radarr internal movie ID) */
  radarrMovieId: number;
}

interface PrepareReleaseResult {
  releaseId: number;
}

/**
 * Load Radarr plugin config from DB.
 */
async function loadRadarrConfig() {
  const plugin = await prisma.plugin.findFirst({
    where: { type: { startsWith: 'radarr' }, enabled: true },
  });
  if (!plugin?.config) throw new Error('Radarr plugin not configured');
  const config = plugin.config as Record<string, any>;
  return { apiKey: config.api_key as string, baseUrl: (config.website_url as string).replace(/\/$/, '') };
}

/**
 * Load TMDB API key from plugin config.
 */
async function loadTmdbApiKey(): Promise<string> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: { startsWith: 'tmdb' }, enabled: true },
  });
  if (!plugin?.config) throw new Error('TMDB plugin not configured');
  return (plugin.config as Record<string, any>).api_key as string;
}

/**
 * Fetch movie details from Radarr API.
 */
async function fetchRadarrMovie(baseUrl: string, apiKey: string, movieId: number) {
  const res = await fetch(`${baseUrl}/api/v3/movie/${movieId}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!res.ok) throw new Error(`Radarr API error: ${res.status}`);
  return res.json() as Promise<any>;
}

/**
 * Prepare a full C411 release from a Radarr movie.
 */
export async function prepareRelease(options: PrepareReleaseOptions): Promise<PrepareReleaseResult> {
  const { radarrMovieId } = options;

  // Load configs
  const [radarrConfig, c411Config, tmdbApiKey] = await Promise.all([
    loadRadarrConfig(),
    loadC411Config(),
    loadTmdbApiKey(),
  ]);

  if (!c411Config.announceUrl) throw new Error('C411 announce_url not configured');

  // 1. Get movie info from Radarr
  const movie = await fetchRadarrMovie(radarrConfig.baseUrl, radarrConfig.apiKey, radarrMovieId);
  if (!movie.hasFile || !movie.movieFile) throw new Error('Movie has no file in Radarr');

  // Radarr returns container paths (/data/...), remap to host mount (/mnt/storage/...)
  const radarrPath = movie.movieFile.path as string;
  const originalPath = radarrPath.replace(/^\/data\//, '/mnt/storage/');
  const originalName = movie.movieFile.sceneName || movie.movieFile.relativePath || '';
  const releaseGroup = movie.movieFile.releaseGroup || '';
  const tmdbId = movie.tmdbId as number;
  const imdbId = (movie.imdbId || '') as string;

  // 2. Run mediainfo
  console.log(`[c411:prepare] Running mediainfo on ${originalPath}`);
  const media = await getMediaInfo(originalPath, originalName);
  if (!media) throw new Error(`MediaInfo failed for ${originalPath}`);

  // 3. Detect languages via ffprobe, with fallback heuristics
  console.log('[c411:prepare] Detecting languages...');
  let langTag: LanguageTag = await detectLanguages(originalPath);

  // If ffprobe found nothing, infer from subtitle tracks and release name
  if (langTag === 'UNKNOWN') {
    const hasFrSub = media.subtitles.some((s) => /^(fre|fra|fr)$/.test(s.language.toLowerCase()));
    const hasEnSub = media.subtitles.some((s) => /^(eng|en)$/.test(s.language.toLowerCase()));
    const hasVfqSub = media.subtitles.some((s) => /canad|québ|quebec|vfq/i.test(s.title));
    const name = originalName.toUpperCase();

    if (name.includes('MULTI') && name.includes('VF2')) langTag = 'MULTI.VF2';
    else if (name.includes('MULTI') && name.includes('VFQ')) langTag = 'MULTI';
    else if (name.includes('MULTI')) langTag = 'MULTI';
    else if (name.includes('VFQ')) langTag = 'VFQ';
    else if (name.includes('VFF') || name.includes('TRUEFRENCH')) langTag = 'VFF';
    else if (name.includes('FRENCH')) langTag = 'FRENCH';
    else if (hasFrSub && hasEnSub && hasVfqSub) langTag = 'MULTI.VF2';
    else if (hasFrSub && hasEnSub) langTag = 'MULTI';
    else if (hasFrSub) langTag = 'FRENCH';
    else if (hasEnSub) langTag = 'EN';
  }
  console.log(`[c411:prepare] Language: ${langTag}`);

  // 4. Fetch TMDB details
  console.log(`[c411:prepare] Fetching TMDB details for ${tmdbId}...`);
  let tmdb = await fetchTmdbDetails(tmdbApiKey, 'movie', tmdbId).catch(() => null);
  if (!tmdb) tmdb = buildFallbackTmdbDetails(originalName);

  // 5. Build C411 release name
  // Use releaseGroup from Radarr if the original name has no tag
  const nameForTag = releaseGroup && !originalName.includes(`-${releaseGroup}`)
    ? `${originalName.replace(/\.[^.]+$/, '')}-${releaseGroup}`
    : originalName;
  const releaseInfo = buildReleaseInfo(tmdb, media, nameForTag, langTag !== 'UNKNOWN' ? langTag : undefined);
  const c411Name = buildC411ReleaseName(releaseInfo, nameForTag);
  console.log(`[c411:prepare] Release name: ${c411Name}`);

  // 6. Create hardlink
  const ext = extname(originalPath);
  const hardlinkPath = join(HARDLINK_BASE, `${c411Name}${ext}`);
  try {
    await stat(hardlinkPath);
    console.log(`[c411:prepare] Hardlink already exists: ${hardlinkPath}`);
  } catch {
    await mkdir(HARDLINK_BASE, { recursive: true });
    await link(originalPath, hardlinkPath);
    console.log(`[c411:prepare] Created hardlink: ${hardlinkPath}`);
  }

  // 7. Create .torrent file
  const tmpDir = `/tmp/c411-${Date.now()}`;
  await mkdir(tmpDir, { recursive: true });
  const torrentPath = join(tmpDir, `${c411Name}.torrent`);
  const fileStat = await stat(originalPath);
  const pieceLength = calcPieceLength(Number(fileStat.size));

  console.log('[c411:prepare] Creating torrent...');
  await createTorrent({
    announceUrl: c411Config.announceUrl,
    pieceLength,
    outputPath: torrentPath,
    contentPath: hardlinkPath,
  });

  // 8. Upload .torrent to S3
  const torrentBuffer = await Bun.file(torrentPath).arrayBuffer();
  const s3Key = `c411/torrents/${c411Name}.torrent`;
  const uploaded = await uploadToS3(Buffer.from(torrentBuffer), s3Key, 'application/x-bittorrent');
  if (!uploaded) throw new Error('Failed to upload .torrent to S3');
  console.log(`[c411:prepare] Uploaded torrent to S3: ${s3Key}`);

  // 9. Generate NFO + BBCode
  const nfoContent = media.fullOutput;
  const bbcode = generateBBCode({
    tmdb,
    media,
    releaseName: originalName,
    fileCount: 1,
    totalSize: formatSize(Number(fileStat.size)),
    languages: langTag !== 'UNKNOWN' ? langTag : undefined,
  });

  // 10. Resolve C411 options
  const { categoryId, subcategoryId } = resolveCategory(undefined, tmdb.type);
  const languageOptionIds = resolveLanguage(c411Name);
  const genreOptionIds = resolveGenres(bbcode);

  // 11. Save to DB
  const release = await prisma.c411Release.create({
    data: {
      name: c411Name,
      title: tmdb.title,
      tmdbId,
      imdbId: imdbId || null,
      tmdbType: tmdb.type,
      categoryId,
      subcategoryId,
      categoryName: tmdb.type === 'movie' ? 'Films' : 'Séries',
      language: langTag !== 'UNKNOWN' ? langTag : null,
      resolution: media.resolution !== 'N/A' ? media.resolution : null,
      source: media.source !== 'N/A' ? media.source : null,
      videoCodec: media.videoCodec !== 'N/A' ? media.videoCodec : null,
      audioCodec: media.audioStreams[0]?.codec || null,
      size: BigInt(fileStat.size),
      status: 'local',
      torrentS3Key: s3Key,
      nfoContent,
      hardlinkPath,
      originalPath,
      options: { '1': languageOptionIds, '5': genreOptionIds },
      tmdbData: {
        id: tmdb.id,
        type: tmdb.type,
        title: tmdb.title,
        originalTitle: tmdb.originalTitle,
        year: parseInt(tmdb.year) || 0,
        overview: tmdb.overview,
        posterUrl: tmdb.posterUrl,
        genres: tmdb.genres,
        rating: parseFloat(tmdb.rating) || 0,
        directors: [tmdb.director],
        cast: tmdb.cast.map(name => ({ name, character: '' })),
        releaseDate: tmdb.releaseDate,
        countries: tmdb.productionCountries,
        imdbId: tmdb.imdbId,
      },
      metadata: {
        sizeHuman: formatSize(Number(fileStat.size)),
        platform: tmdb.network || null,
        originalName,
      },
      presentation: {
        create: { bbcode },
      },
    },
    include: { presentation: true },
  });

  // Cleanup tmp
  await Bun.file(torrentPath).exists() && await import('node:fs/promises').then(fs => fs.rm(tmpDir, { recursive: true }).catch(() => {}));

  console.log(`[c411:prepare] Release saved: id=${release.id} name=${c411Name}`);
  return { releaseId: release.id };
}
