import { Elysia, t } from 'elysia';
import { createJsonSseResponse } from '../../utils/sse';
import { getQbittorrentSnapshot } from '../../utils/dashboard/qbittorrent';
import { createPollerSseResponse } from '../../services/qbittorrentPoller';
import {
  addQbittorrentMagnet,
  addQbittorrentTorrentFile,
  deleteQbittorrentTorrent,
  fetchQbittorrentCategories,
  fetchQbittorrentTorrentFiles,
  fetchQbittorrentTorrentPeers,
  fetchQbittorrentTorrentProperties,
  fetchQbittorrentTorrents,
  fetchQbittorrentTags,
  pauseQbittorrentTorrent,
  renameQbittorrentTorrent,
  renameQbittorrentTorrentFile,
  resumeQbittorrentTorrent,
  reannounceQbittorrentTorrent,
  setQbittorrentTorrentCategory,
  setQbittorrentTorrentTags,
} from '../../services/qbittorrent/torrents';
import { fetchQbittorrentTorrentTrackers } from '../../services/qbittorrent/trackers';
import { serverError } from '../../utils/errors';
import {
  applyQbittorrentFetchStatus,
  applyQbittorrentMutationStatus,
  getQbittorrentConfigErrorResponse,
  getQbittorrentConfigOrError,
  getQbittorrentRid,
  validateQbittorrentUploadRequest,
} from './shared/qbittorrent';

export const dashboardQbittorrentRoutes = new Elysia()
  .get('/qbittorrent/status', async (ctx: any) => {
    const { user, set } = ctx;
    try {
      const snapshot = await getQbittorrentSnapshot();
      return { ...snapshot, updated_at: new Date().toISOString() };
    } catch (error) {
      console.error('Error fetching qBittorrent status:', error);
      return serverError(set, 'Failed to get qBittorrent status');
    }
  })
  .get(
    '/qbittorrent/torrents',
    async (ctx: any) => {
      const { user, set, query } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return { enabled: false, connected: false, torrents: [] };
      }

      const result = await fetchQbittorrentTorrents(config, true, {
        filter: query.filter,
        category: query.category,
        tag: query.tag,
        sort: query.sort,
        reverse: query.reverse ? query.reverse === 'true' : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });

      return applyQbittorrentFetchStatus(set, result);
    },
    {
      query: t.Object({
        filter: t.Optional(t.String()),
        category: t.Optional(t.String()),
        tag: t.Optional(t.String()),
        sort: t.Optional(t.String()),
        reverse: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    }
  )
  .get('/qbittorrent/torrents/stream', async (ctx: any) => {
    const { user, set, request } = ctx;
    return createPollerSseResponse(request, 'torrents');
  })
  .get('/qbittorrent/torrents/:hash/properties', async (ctx: any) => {
    const { user, set, params } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTorrentProperties(config, true, params.hash);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get('/qbittorrent/torrents/:hash/trackers', async (ctx: any) => {
    const { user, set, params } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTorrentTrackers(config, true, params.hash);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get('/qbittorrent/categories', async (ctx: any) => {
    const { user, set } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentCategories(config, true);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get('/qbittorrent/options', async (ctx: any) => {
    const { user, set } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const [categoriesResult, tagsResult] = await Promise.all([
      fetchQbittorrentCategories(config, true),
      fetchQbittorrentTags(config, true),
    ]);

    const connected = categoriesResult.connected && tagsResult.connected;
    if (!connected) {
      set.status = 502;
    }

    return {
      enabled: true,
      connected,
      categories: categoriesResult.categories,
      tags: tagsResult.tags,
      error: categoriesResult.error ?? tagsResult.error,
    };
  })
  .get('/qbittorrent/tags', async (ctx: any) => {
    const { user, set } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTags(config, true);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get('/qbittorrent/torrents/:hash/files', async (ctx: any) => {
    const { user, set, params } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await fetchQbittorrentTorrentFiles(config, true, params.hash);
    return applyQbittorrentFetchStatus(set, result);
  })
  .get(
    '/qbittorrent/torrents/:hash/peers',
    async (ctx: any) => {
      const { user, set, params, query } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const rid = getQbittorrentRid(query?.rid);
      const result = await fetchQbittorrentTorrentPeers(config, true, params.hash, rid);
      return applyQbittorrentFetchStatus(set, result);
    },
    {
      query: t.Object({
        rid: t.Optional(t.String()),
      }),
    }
  )
  .get('/qbittorrent/torrents/:hash/peers/stream', async (ctx: any) => {
    const { user, set, params, request } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    let rid = 0;
    return createJsonSseResponse({
      request,
      poll: async () => {
        const snapshot = await fetchQbittorrentTorrentPeers(config, true, params.hash, rid);
        if (snapshot.connected) {
          rid = snapshot.rid;
        }
        return snapshot;
      },
      intervalMs: 1000,
      retryMs: 3000,
      onError: error => ({
        enabled: true,
        connected: false,
        rid,
        full_update: true,
        peers: [],
        error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
      }),
      logLabel: 'qBittorrent peers stream',
    });
  })
  .get('/qbittorrent/torrents/:hash/stream', async (ctx: any) => {
    const { user, set, params, request } = ctx;
    return createPollerSseResponse(request, `torrent:${params.hash}`);
  })
  .post(
    '/qbittorrent/torrents/:hash/rename',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const result = await renameQbittorrentTorrent(config, true, { hash: params.hash, name: body.name });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        name: t.String(),
      }),
    }
  )
  .post(
    '/qbittorrent/torrents/:hash/rename-file',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const result = await renameQbittorrentTorrentFile(config, true, {
        hash: params.hash,
        old_path: body.old_path,
        new_path: body.new_path,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        old_path: t.String(),
        new_path: t.String(),
      }),
    }
  )
  .post(
    '/qbittorrent/torrents/:hash/set-category',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const category = typeof body.category === 'string' ? body.category : null;
      const result = await setQbittorrentTorrentCategory(config, true, { hash: params.hash, category });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        category: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/qbittorrent/torrents/:hash/set-tags',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const tags = Array.isArray(body.tags) ? body.tags : [];
      const previousTags = Array.isArray(body.previous_tags) ? body.previous_tags : null;
      const result = await setQbittorrentTorrentTags(config, true, {
        hash: params.hash,
        tags,
        previous_tags: previousTags,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        tags: t.Array(t.String()),
        previous_tags: t.Optional(t.Array(t.String())),
      }),
    }
  )
  .post('/qbittorrent/torrents/:hash/pause', async (ctx: any) => {
    const { user, set, params } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await pauseQbittorrentTorrent(config, true, { hash: params.hash });
    return applyQbittorrentMutationStatus(set, result);
  })
  .post('/qbittorrent/torrents/:hash/resume', async (ctx: any) => {
    const { user, set, params } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await resumeQbittorrentTorrent(config, true, { hash: params.hash });
    return applyQbittorrentMutationStatus(set, result);
  })
  .post('/qbittorrent/torrents/:hash/reannounce', async (ctx: any) => {
    const { user, set, params } = ctx;
    const config = await getQbittorrentConfigOrError(set);
    if (!config) {
      return getQbittorrentConfigErrorResponse();
    }

    const result = await reannounceQbittorrentTorrent(config, true, { hash: params.hash });
    return applyQbittorrentMutationStatus(set, result);
  })
  .post(
    '/qbittorrent/torrents/:hash/delete',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const deleteFiles = Boolean(body.delete_files);
      const result = await deleteQbittorrentTorrent(config, true, { hash: params.hash, delete_files: deleteFiles });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        delete_files: t.Optional(t.Boolean()),
      }),
    }
  )
  .post(
    '/qbittorrent/torrents/add-magnet',
    async (ctx: any) => {
      const { user, set, body } = ctx;
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        return getQbittorrentConfigErrorResponse();
      }

      const result = await addQbittorrentMagnet(config, true, {
        magnet: body.magnet,
        category: body.category ?? null,
        tags: body.tags ?? null,
      });
      return applyQbittorrentMutationStatus(set, result);
    },
    {
      body: t.Object({
        magnet: t.String(),
        category: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
      }),
    }
  )
  .post(
    '/qbittorrent/torrents/add-file',
    async (ctx: any) => {
      const { user, set, body } = ctx;
      const logPrefix = '[qbittorrent:add-file]';
      const config = await getQbittorrentConfigOrError(set);
      if (!config) {
        console.warn(`${logPrefix} plugin disabled or misconfigured for user id=${user.id}`);
        return getQbittorrentConfigErrorResponse();
      }

      console.log(
        `${logPrefix} user id=${user.id} body keys=${Object.keys(body || {}).join(',') || 'none'} category=${body.category ?? 'none'} tags=${body.tags ?? 'none'}`
      );
      const validationResult = validateQbittorrentUploadRequest(set, body, logPrefix);
      if ('error' in validationResult) return validationResult;

      const { torrents, tags } = validationResult;

      // We add them one by one for now to reuse the service function
      const results = [];
      for (const torrent of torrents) {
        results.push(
          await addQbittorrentTorrentFile(config, true, {
            torrent,
            category: body.category ?? null,
            tags,
          })
        );
      }

      const allSuccess = results.every(r => r.success);
      const someSuccess = results.some(r => r.success);
      console.log(
        `${logPrefix} completed all_success=${allSuccess} some_success=${someSuccess} results=${JSON.stringify(results)}`
      );

      if (!someSuccess) {
        set.status = 502;
        return { enabled: true, connected: true, success: false, error: results[0].error };
      }

      return { enabled: true, connected: true, success: true, partial: !allSuccess };
    },
    {
      body: t.Object({
        torrents: t.Union([t.Any(), t.Array(t.Any())]),
        category: t.Optional(t.String()),
        tags: t.Optional(t.String()),
      }),
      type: 'multipart/form-data',
    }
  )
  .get('/qbittorrent/stream', async (ctx: any) => {
    const { user, set, request } = ctx;
    return createPollerSseResponse(request, 'dashboard');
  });
