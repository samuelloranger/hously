/**
 * C411 integration routes — search, slots, drafts, releases, sync.
 */

import { Elysia, t } from 'elysia';
import { auth } from '../../auth';
import { requireUser } from '../../middleware/auth';
import { prisma } from '../../db';
import { badRequest, serverError } from '../../utils/errors';
import { getJsonCache, setJsonCache, deleteCache } from '../../services/cache';
import { getFileFromS3, deleteFromS3 } from '../../services/s3Service';
import {
  withC411Session,
  loadC411Config,
  searchTorrents,
  fetchReleaseStatus,
  fetchDrafts,
  fetchDraft,
  createDraft,
  updateDraft,
  deleteDraft,
  publishDraft,
  publishToC411,
  downloadPublishedTorrent,
  fetchCategories,
  fetchCategoryOptions,
  fetchTmdbDetails,
  generateBBCode,
  buildFallbackTmdbDetails,
} from '../../services/c411';
import { getQbittorrentPluginConfig } from '../../services/qbittorrent/config';
import { addQbittorrentTorrentFile } from '../../services/qbittorrent/torrents';
import { prepareRelease, refreshRelease, fetchReleaseMediaInfoPreview } from '../../services/c411/prepare-release';
import { syncC411Releases } from '../../services/c411/sync';

export const mediasC411Routes = new Elysia({ prefix: '/api/medias/c411' })
  .use(auth)
  .use(requireUser)

  // ─── Search ──────────────────────────────────────────────
  .get('/search', async ({ query, set }) => {
    const q = query.q;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return badRequest(set, 'Query must be at least 2 characters');
    }
    try {
      return await withC411Session((session) => searchTorrents(session, q.trim()));
    } catch (error: any) {
      console.error('[c411:search]', error);
      return serverError(set, error.message || 'C411 search failed');
    }
  })

  // ─── Release Status (Slot Grid) ─────────────────────────
  .get('/release-status', async ({ query, set }) => {
    const tmdbId = parseInt(query.tmdbId as string);
    const title = query.title as string;
    const year = parseInt(query.year as string);
    const imdbId = (query.imdbId as string) || '';
    const tmdbType = query.tmdbType === 'tv' ? 'tv' : 'movie';

    if (!tmdbId || !title) return badRequest(set, 'tmdbId and title are required');

    const cacheKey = `c411:release-status:${tmdbType}:${tmdbId}`;
    try {
      const cached = await getJsonCache(cacheKey);
      if (cached) return cached;

      const result = await withC411Session((session) =>
        fetchReleaseStatus(session, { tmdbId, tmdbType, imdbId, title, year: year || 0 }),
      );
      await setJsonCache(cacheKey, result, 1800); // 30 min cache
      return result;
    } catch (error: any) {
      console.error('[c411:release-status]', error);
      return serverError(set, error.message || 'Failed to fetch release status');
    }
  })

  // ─── Drafts (C411 API) ──────────────────────────────────
  .get('/drafts', async ({ set }) => {
    try {
      return await withC411Session((session) => fetchDrafts(session));
    } catch (error: any) {
      console.error('[c411:drafts]', error);
      return serverError(set, error.message || 'Failed to fetch drafts');
    }
  })

  .get('/drafts/:id', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid draft ID');
    try {
      return await withC411Session((session) => fetchDraft(session, id));
    } catch (error: any) {
      console.error('[c411:draft]', error);
      return serverError(set, error.message || 'Failed to fetch draft');
    }
  })

  .post('/drafts', async ({ body, set }) => {
    try {
      return await withC411Session((session) => createDraft(session, body as any));
    } catch (error: any) {
      console.error('[c411:create-draft]', error);
      return serverError(set, error.message || 'Failed to create draft');
    }
  })

  .patch('/drafts/:id', async ({ params, body, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid draft ID');
    try {
      return await withC411Session((session) => updateDraft(session, id, body as any));
    } catch (error: any) {
      console.error('[c411:update-draft]', error);
      return serverError(set, error.message || 'Failed to update draft');
    }
  })

  .delete('/drafts/:id', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid draft ID');
    try {
      await withC411Session((session) => deleteDraft(session, id));
      return { success: true };
    } catch (error: any) {
      console.error('[c411:delete-draft]', error);
      return serverError(set, error.message || 'Failed to delete draft');
    }
  })

  .post('/drafts/:id/publish', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid draft ID');
    try {
      const draft = await withC411Session((session) => fetchDraft(session, id));
      const result = await withC411Session((session) => publishDraft(session, id));

      if (!result.success) {
        set.status = result.statusCode ?? 400;
        return { success: false, message: result.message };
      }

      // Download the generated .torrent file and add it to qBittorrent
      const infoHash = result.data!.infoHash;
      try {
        const { buffer, filename } = await withC411Session((session) =>
          downloadPublishedTorrent(session, infoHash),
        );

        const { enabled, config } = await getQbittorrentPluginConfig();
        if (enabled && config) {
          const torrentFile = new File([buffer], filename, { type: 'application/x-bittorrent' });
          const qbResult = await addQbittorrentTorrentFile(config, true, {
            torrent: torrentFile,
            category: draft.subcategory?.name?.toLowerCase().includes('série') ? 'tv-sonarr' : 'radarr',
            tags: ['c411'],
          });
          if (!qbResult.success) {
            console.warn(`[c411:publish] Torrent published but failed to add to qBittorrent: ${qbResult.error}`);
          }
        } else {
          console.warn('[c411:publish] Torrent published but qBittorrent is not configured');
        }
      } catch (dlError: any) {
        console.error('[c411:publish] Failed to download/add torrent to qBittorrent:', dlError.message);
      }

      return { success: true, data: result.data, message: result.message };
    } catch (error: any) {
      console.error('[c411:publish-draft]', error);
      return serverError(set, error.message || 'Failed to publish draft');
    }
  })

  // ─── Local Releases (DB) ────────────────────────────────
  .get('/releases', async ({ set }) => {
    try {
      const releases = await prisma.c411Release.findMany({
        orderBy: { createdAt: 'asc' },
        include: { presentation: { select: { id: true } } },
      });
      return {
        releases: releases.map((r) => ({
          id: r.id,
          c411_torrent_id: r.c411TorrentId,
          info_hash: r.infoHash,
          name: r.name,
          title: r.title,
          tmdb_id: r.tmdbId,
          tmdb_type: r.tmdbType,
          category_name: r.categoryName,
          subcategory_name: r.subcategoryName,
          language: r.language,
          resolution: r.resolution,
          source: r.source,
          size: r.size ? Number(r.size) : null,
          status: r.status,
          seeders: r.seeders,
          leechers: r.leechers,
          completions: r.completions,
          metadata: r.metadata,
          has_presentation: !!r.presentation,
          has_torrent: !!r.torrentS3Key,
          synced_at: r.syncedAt?.toISOString() ?? null,
          created_at: r.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      console.error('[c411:releases]', error);
      return serverError(set, error.message || 'Failed to fetch releases');
    }
  })

  .get('/releases/:id', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid release ID');
    try {
      const release = await prisma.c411Release.findUnique({
        where: { id },
        include: { presentation: true },
      });
      if (!release) return badRequest(set, 'Release not found');
      return {
        id: release.id,
        c411_torrent_id: release.c411TorrentId,
        info_hash: release.infoHash,
        name: release.name,
        title: release.title,
        tmdb_id: release.tmdbId,
        imdb_id: release.imdbId,
        tmdb_type: release.tmdbType,
        category_id: release.categoryId,
        subcategory_id: release.subcategoryId,
        category_name: release.categoryName,
        subcategory_name: release.subcategoryName,
        language: release.language,
        resolution: release.resolution,
        source: release.source,
        video_codec: release.videoCodec,
        audio_codec: release.audioCodec,
        size: release.size ? Number(release.size) : null,
        status: release.status,
        seeders: release.seeders,
        leechers: release.leechers,
        completions: release.completions,
        torrent_s3_key: release.torrentS3Key,
        nfo_content: release.nfoContent,
        hardlink_path: release.hardlinkPath,
        original_path: release.originalPath,
        options: release.options,
        tmdb_data: release.tmdbData,
        metadata: release.metadata,
        bbcode: release.presentation?.bbcode ?? null,
        synced_at: release.syncedAt?.toISOString() ?? null,
        created_at: release.createdAt.toISOString(),
        updated_at: release.updatedAt?.toISOString() ?? null,
      };
    } catch (error: any) {
      console.error('[c411:release]', error);
      return serverError(set, error.message || 'Failed to fetch release');
    }
  })

  .patch('/releases/:id', async ({ params, body, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid release ID');
    try {
      const data = body as any;
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.category_id !== undefined) updateData.categoryId = data.category_id;
      if (data.subcategory_id !== undefined) updateData.subcategoryId = data.subcategory_id;
      if (data.options !== undefined) updateData.options = data.options;

      const release = await prisma.c411Release.update({
        where: { id },
        data: updateData,
      });

      // Update presentation if bbcode provided
      if (data.bbcode !== undefined) {
        await prisma.c411Presentation.upsert({
          where: { releaseId: id },
          update: { bbcode: data.bbcode },
          create: { releaseId: id, bbcode: data.bbcode },
        });
      }

      return { id: release.id, status: 'updated' };
    } catch (error: any) {
      console.error('[c411:update-release]', error);
      return serverError(set, error.message || 'Failed to update release');
    }
  })

  .delete('/releases/:id', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid release ID');
    try {
      const release = await prisma.c411Release.findUnique({
        where: { id },
        select: { torrentS3Key: true, hardlinkPath: true },
      });
      if (!release) return badRequest(set, 'Release not found');

      // Delete hardlink file
      if (release.hardlinkPath) {
        try {
          await import('node:fs/promises').then(async (fs) => {
            const current = await fs.stat(release.hardlinkPath!);
            if (current.isDirectory()) {
              await fs.rm(release.hardlinkPath!, { recursive: true, force: true });
              return;
            }
            await fs.unlink(release.hardlinkPath!);
          });
          console.log(`[c411:delete] Removed hardlink: ${release.hardlinkPath}`);
        } catch (err: any) {
          if (err.code !== 'ENOENT') console.warn(`[c411:delete] Failed to remove hardlink: ${err.message}`);
        }
      }

      // Delete .torrent from S3
      if (release.torrentS3Key) {
        await deleteFromS3(release.torrentS3Key);
      }

      // Delete from DB (cascade deletes presentation)
      await prisma.c411Release.delete({ where: { id } });

      return { success: true };
    } catch (error: any) {
      console.error('[c411:delete-release]', error);
      return serverError(set, error.message || 'Failed to delete release');
    }
  })

  .get('/releases/:id/torrent', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid release ID');
    try {
      const release = await prisma.c411Release.findUnique({
        where: { id },
        select: { torrentS3Key: true, name: true },
      });
      if (!release?.torrentS3Key) return badRequest(set, 'No torrent file for this release');

      const buffer = await getFileFromS3(release.torrentS3Key);
      if (!buffer) return serverError(set, 'Failed to retrieve torrent from storage');

      set.headers['content-type'] = 'application/x-bittorrent';
      set.headers['content-disposition'] = `attachment; filename="${release.name}.torrent"`;
      return buffer;
    } catch (error: any) {
      console.error('[c411:torrent-download]', error);
      return serverError(set, error.message || 'Failed to download torrent');
    }
  })

  .post('/releases/:id/publish', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid release ID');
    try {
      const release = await prisma.c411Release.findUnique({
        where: { id },
        include: { presentation: true },
      });
      if (!release) return badRequest(set, 'Release not found');
      if (!release.torrentS3Key) return badRequest(set, 'Release has no .torrent file');
      if (!release.categoryId || !release.subcategoryId) return badRequest(set, 'Release missing category/subcategory');

      // Get torrent file from S3
      const torrentBuffer = await getFileFromS3(release.torrentS3Key);
      if (!torrentBuffer) return serverError(set, 'Failed to retrieve torrent from storage');

      const result = await withC411Session((session) =>
        publishToC411(session, {
          torrentBuffer: Buffer.from(torrentBuffer),
          torrentFileName: `${release.name}.torrent`,
          nfoContent: release.nfoContent ?? undefined,
          nfoFileName: release.nfoContent ? `${release.name}.nfo` : undefined,
          title: release.name,
          categoryId: release.categoryId!,
          subcategoryId: release.subcategoryId!,
          description: release.presentation?.bbcode ?? undefined,
          options: (release.options as Record<string, number | number[]>) ?? undefined,
          tmdbData: release.tmdbData ?? undefined,
        }),
      );

      if (!result.success) {
        set.status = result.statusCode ?? 400;
        return { success: false, message: result.message };
      }

      // Update the local release with C411 data
      await prisma.c411Release.update({
        where: { id },
        data: {
          c411TorrentId: result.data!.id,
          infoHash: result.data!.infoHash,
          status: result.data!.status,
        },
      });
      await deleteCache('c411:library-release-data');

      // Download the C411-generated .torrent and add to qBittorrent
      try {
        const { buffer: dlBuffer, filename } = await withC411Session((session) =>
          downloadPublishedTorrent(session, result.data!.infoHash),
        );

        const { enabled, config } = await getQbittorrentPluginConfig();
        if (enabled && config) {
          const torrentFile = new File([dlBuffer], filename, { type: 'application/x-bittorrent' });
          const qbResult = await addQbittorrentTorrentFile(config, true, {
            torrent: torrentFile,
            category: release.tmdbType === 'tv' ? 'tv-sonarr' : 'radarr',
            tags: ['c411'],
          });
          if (!qbResult.success) {
            console.warn(`[c411:publish-release] Published but failed to add to qBittorrent: ${qbResult.error}`);
          }
        } else {
          console.warn('[c411:publish-release] Published but qBittorrent is not configured');
        }
      } catch (dlError: any) {
        console.error('[c411:publish-release] Failed to download/add torrent to qBittorrent:', dlError.message);
      }

      return { success: true, data: result.data, message: result.message };
    } catch (error: any) {
      console.error('[c411:publish-release]', error);
      return serverError(set, error.message || 'Failed to publish release');
    }
  })

  // ─── Media Info Preview ──────────────────────────────────
  .get('/media-info', async ({ query, set }) => {
    const service = query.service === 'sonarr' ? 'sonarr' : 'radarr';
    const sourceId = parseInt((query.sourceId as string) || (query.radarrSourceId as string));
    const seasonNumber = query.seasonNumber ? parseInt(query.seasonNumber as string) : null;
    if (!sourceId) return badRequest(set, 'sourceId is required');

    try {
      return await fetchReleaseMediaInfoPreview({
        service,
        sourceId,
        seasonNumber,
      });
    } catch (error: any) {
      console.error('[c411:media-info]', error);
      return serverError(set, error.message || 'Failed to get media info');
    }
  })

  // ─── Prepare Release ────────────────────────────────────
  .post('/prepare-release', async ({ body, set }) => {
    const data = body as any;
    const service = data.service === 'sonarr' ? 'sonarr' : 'radarr';
    const sourceId = parseInt(data.sourceId ?? data.radarrSourceId);
    const seasonNumber = data.seasonNumber == null ? null : parseInt(data.seasonNumber);
    if (!sourceId) return badRequest(set, 'sourceId is required');

    try {
      const result = await prepareRelease({ service, sourceId, seasonNumber });
      return { id: result.releaseId };
    } catch (error: any) {
      console.error('[c411:prepare-release]', error);
      return serverError(set, error.message || 'Failed to prepare release');
    }
  })

  // ─── Refresh Release ────────────────────────────────────
  .post('/releases/:id/refresh', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid release ID');

    try {
      await refreshRelease(id);
      return { success: true };
    } catch (error: any) {
      console.error('[c411:refresh-release]', error);
      return serverError(set, error.message || 'Failed to refresh release');
    }
  })

  // ─── Sync ───────────────────────────────────────────────
  .post('/sync', async ({ set }) => {
    try {
      const config = await loadC411Config();
      const result = await withC411Session((session) =>
        syncC411Releases(session, config.username),
      );
      await deleteCache('c411:library-release-data');
      return result;
    } catch (error: any) {
      console.error('[c411:sync]', error);
      return serverError(set, error.message || 'C411 sync failed');
    }
  })

  // ─── French TMDB Title ───────────────────────────────────
  .get('/tmdb-title', async ({ query, set }) => {
    const tmdbId = parseInt(query.tmdbId as string);
    const type = (query.type as string) || 'movie';
    if (!tmdbId) return badRequest(set, 'tmdbId is required');
    try {
      const tmdbPlugin = await prisma.plugin.findFirst({
        where: { type: { startsWith: 'tmdb' }, enabled: true },
      });
      if (!tmdbPlugin?.config) return badRequest(set, 'TMDB plugin not configured');
      const apiKey = (tmdbPlugin.config as any).api_key;
      const tmdb = await fetchTmdbDetails(apiKey, type as 'movie' | 'tv', tmdbId);
      return { title: tmdb.title };
    } catch (error: any) {
      return serverError(set, error.message || 'Failed to fetch TMDB title');
    }
  })

  // ─── Generate BBCode ────────────────────────────────────
  .get('/generate-bbcode', async ({ query, set }) => {
    const tmdbId = parseInt(query.tmdbId as string);
    const type = (query.type as string) || 'movie';
    if (!tmdbId) return badRequest(set, 'tmdbId is required');

    try {
      const tmdbPlugin = await prisma.plugin.findFirst({
        where: { type: { startsWith: 'tmdb' }, enabled: true },
      });
      if (!tmdbPlugin?.config) return badRequest(set, 'TMDB plugin not configured');
      const apiKey = (tmdbPlugin.config as any).api_key;

      let tmdb = await fetchTmdbDetails(apiKey, type as 'movie' | 'tv', tmdbId).catch(() => null);
      if (!tmdb) tmdb = buildFallbackTmdbDetails(String(tmdbId));

      const bbcode = generateBBCode({
        tmdb,
        media: null,
        releaseName: tmdb.title,
        fileCount: 0,
        totalSize: 'N/A',
      });

      return { bbcode };
    } catch (error: any) {
      console.error('[c411:generate-bbcode]', error);
      return serverError(set, error.message || 'Failed to generate BBCode');
    }
  })

  // ─── Categories ─────────────────────────────────────────
  .get('/categories', async ({ set }) => {
    try {
      const cached = await getJsonCache('c411:categories');
      if (cached) return cached;

      const categories = await withC411Session((session) => fetchCategories(session));
      await setJsonCache('c411:categories', categories, 3600);
      return categories;
    } catch (error: any) {
      console.error('[c411:categories]', error);
      return serverError(set, error.message || 'Failed to fetch categories');
    }
  })

  .get('/categories/:id/options', async ({ params, set }) => {
    const id = parseInt(params.id);
    if (!id) return badRequest(set, 'Invalid category ID');
    try {
      const cacheKey = `c411:category-options:${id}`;
      const cached = await getJsonCache(cacheKey);
      if (cached) return cached;

      const options = await withC411Session((session) => fetchCategoryOptions(session, id));
      await setJsonCache(cacheKey, options, 3600);
      return options;
    } catch (error: any) {
      console.error('[c411:category-options]', error);
      return serverError(set, error.message || 'Failed to fetch category options');
    }
  });
