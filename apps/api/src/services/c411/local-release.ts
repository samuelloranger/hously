import { mkdir, rm, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db';
import { normalizeRadarrConfig } from '../../utils/plugins/normalizers';
import { uploadToS3 } from '../s3Service';
import { getMediaInfo } from './mediainfo';
import { detectLanguages, applyCanadianLanguageOverride } from './lang-detect';
import { fetchTmdbDetails, buildFallbackTmdbDetails } from './tmdb';
import { generateBBCode, buildReleaseInfo } from './bbcode';
import { loadC411Config } from './session';
import { createTorrentFile } from './mktorrent';
import {
  buildReleaseName,
  calcPieceLength,
  formatReleaseSize,
  resolveCategory,
  resolveGenres,
  resolveLanguage,
} from '@hously/shared';

type RadarrMovie = {
  id: number;
  title?: string | null;
  tmdbId?: number | null;
  imdbId?: string | null;
};

async function loadRadarrMovie(sourceId: number): Promise<RadarrMovie> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'radarr', enabled: true },
    select: { config: true },
  });

  if (!plugin?.config) throw new Error('Radarr plugin is not configured');
  const config = normalizeRadarrConfig(plugin.config);
  if (!config) throw new Error('Radarr plugin is not configured');

  const url = new URL(`/api/v3/movie/${sourceId}`, config.website_url);
  const response = await fetch(url.toString(), {
    headers: {
      'X-Api-Key': config.api_key,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Radarr request failed with status ${response.status}`);
  }

  return response.json() as Promise<RadarrMovie>;
}

async function loadTmdbApiKey(): Promise<string | null> {
  const plugin = await prisma.plugin.findFirst({
    where: { type: { startsWith: 'tmdb' }, enabled: true },
    select: { config: true },
  });

  const apiKey = plugin?.config && typeof plugin.config === 'object' && !Array.isArray(plugin.config)
    ? (plugin.config as Record<string, unknown>).api_key
    : null;

  return typeof apiKey === 'string' && apiKey.trim() ? apiKey : null;
}

export async function createLocalC411ReleaseFromConversion(params: {
  service: 'radarr';
  sourceId: number;
  preset: string;
  inputPath: string;
  outputPath: string;
  conversionJobId: number;
}) {
  const existing = await prisma.c411Release.findFirst({
    where: { originalPath: params.outputPath },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const [movie, media, languageTag, fileStat, tmdbApiKey] = await Promise.all([
    loadRadarrMovie(params.sourceId),
    getMediaInfo(params.outputPath, basename(params.outputPath)),
    detectLanguages(params.outputPath),
    stat(params.outputPath),
    loadTmdbApiKey(),
  ]);

  const tmdb =
    tmdbApiKey && movie.tmdbId
      ? await fetchTmdbDetails(tmdbApiKey, 'movie', movie.tmdbId).catch(() => buildFallbackTmdbDetails(movie.title || basename(params.outputPath)))
      : buildFallbackTmdbDetails(movie.title || basename(params.outputPath));

  const resolvedLanguageTag = applyCanadianLanguageOverride(languageTag, tmdb.productionCountries);
  const releaseStem = basename(params.outputPath, extname(params.outputPath));
  const c411Name = media
    ? buildReleaseName(
        buildReleaseInfo(
          tmdb,
          media,
          releaseStem,
          resolvedLanguageTag !== 'UNKNOWN' ? resolvedLanguageTag : undefined,
        ),
        releaseStem,
      )
    : releaseStem;

  const bbcode = generateBBCode({
    tmdb,
    media,
    releaseName: c411Name,
    fileCount: 1,
    totalSize: formatReleaseSize(fileStat.size),
    languages: resolvedLanguageTag !== 'UNKNOWN' ? resolvedLanguageTag : undefined,
  });

  const { categoryId, subcategoryId } = resolveCategory(undefined, 'movie');
  const options = {
    '1': resolveLanguage(c411Name),
    '5': resolveGenres(bbcode),
  } satisfies Record<string, number[]>;

  const nfoContent = media?.fullOutput
    ? media.fullOutput.replace(/^(Complete name\s*:\s*).*$/m, `$1${basename(params.outputPath)}`)
    : null;

  // Create torrent directly from the converted file (no hardlink needed)
  let torrentS3Key: string | null = null;
  try {
    const c411Config = await loadC411Config();
    if (c411Config.announceUrl) {
      const tmpDir = `/tmp/c411-conversion-${Date.now()}`;
      await mkdir(tmpDir, { recursive: true });
      const torrentPath = join(tmpDir, `${c411Name}.torrent`);
      try {
        await createTorrentFile({
          announceUrl: c411Config.announceUrl,
          pieceLength: calcPieceLength(fileStat.size),
          outputPath: torrentPath,
          contentPath: params.outputPath,
        });
        const torrentBuffer = await Bun.file(torrentPath).arrayBuffer();
        const s3Key = `c411/torrents/${c411Name}.torrent`;
        const uploaded = await uploadToS3(Buffer.from(torrentBuffer), s3Key, 'application/x-bittorrent');
        if (uploaded) torrentS3Key = s3Key;
      } finally {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn(`[c411:conversion] Failed to create torrent for job ${params.conversionJobId}:`, err);
  }

  const tmdbData: Prisma.InputJsonObject = {
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
    cast: tmdb.cast.map((name) => ({ name, character: '' })),
    releaseDate: tmdb.releaseDate,
    countries: tmdb.productionCountries,
    imdbId: tmdb.imdbId,
  };

  const release = await prisma.c411Release.create({
    data: {
      name: c411Name,
      title: tmdb.title || movie.title || releaseStem,
      tmdbId: movie.tmdbId ?? (tmdb.id > 0 ? tmdb.id : null),
      imdbId: movie.imdbId || tmdb.imdbId || null,
      tmdbType: 'movie',
      categoryId,
      subcategoryId,
      categoryName: 'Films',
      subcategoryName: 'Film',
      language: resolvedLanguageTag !== 'UNKNOWN' ? resolvedLanguageTag : null,
      resolution: media?.resolution !== 'N/A' ? media?.resolution ?? null : null,
      source: media?.source !== 'N/A' ? media?.source ?? null : null,
      videoCodec: media?.videoCodec !== 'N/A' ? media?.videoCodec ?? null : null,
      audioCodec: media?.audioStreams[0]?.codec || null,
      size: BigInt(fileStat.size),
      status: 'local',
      nfoContent,
      torrentS3Key,
      originalPath: params.outputPath,
      options,
      tmdbData,
      metadata: {
        createdBy: 'media_conversion',
        conversionJobId: params.conversionJobId,
        conversionPreset: params.preset,
        sourceService: params.service,
        sourceId: params.sourceId,
        inputPath: params.inputPath,
        outputPath: params.outputPath,
        sizeHuman: formatReleaseSize(fileStat.size),
        prepareError: null,
      } satisfies Prisma.InputJsonObject,
    },
    select: { id: true },
  });

  await prisma.c411Presentation.create({
    data: {
      releaseId: release.id,
      bbcode,
    },
  });

  return release.id;
}
