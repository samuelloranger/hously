import { Elysia, t } from 'elysia';
import { buildQbittorrentDisabledSnapshot, getQbittorrentSnapshot, prisma } from './shared';
import { createJsonSseResponse } from './shared/sse';
import {
  addQbittorrentMagnet,
  addQbittorrentTorrentFile,
  deleteQbittorrentTorrent,
  fetchQbittorrentCategories,
  fetchQbittorrentTorrent,
  fetchQbittorrentTorrentFiles,
  fetchQbittorrentTorrentPeers,
  fetchQbittorrentTorrentProperties,
  fetchQbittorrentTorrentTrackers,
  fetchQbittorrentTorrents,
  fetchQbittorrentTags,
  normalizeQbittorrentConfig,
  pauseQbittorrentTorrent,
  renameQbittorrentTorrent,
  renameQbittorrentTorrentFile,
  resumeQbittorrentTorrent,
  setQbittorrentTorrentCategory,
  setQbittorrentTorrentTags,
} from '../../services/qbittorrentService';

export const dashboardQbittorrentRoutes = new Elysia()
  .get('/qbittorrent/status', async (ctx: any) => {
    const { user, set } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      return await getQbittorrentSnapshot();
    } catch (error) {
      console.error('Error fetching qBittorrent status:', error);
      set.status = 500;
      return { error: 'Failed to get qBittorrent status' };
    }
  })
  .get(
    '/qbittorrent/torrents',
    async (ctx: any) => {
      const { user, set, query } = ctx;
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
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

      if (!result.connected) {
        set.status = 502;
      }
      return result;
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
  .get('/qbittorrent/torrents/:hash/properties', async (ctx: any) => {
    const { user, set, params } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await fetchQbittorrentTorrentProperties(config, true, params.hash);
    if (!result.connected) {
      set.status = 502;
    }
    return result;
  })
  .get('/qbittorrent/torrents/:hash/trackers', async (ctx: any) => {
    const { user, set, params } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await fetchQbittorrentTorrentTrackers(config, true, params.hash);
    if (!result.connected) {
      set.status = 502;
    }
    return result;
  })
  .get('/qbittorrent/categories', async (ctx: any) => {
    const { user, set } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await fetchQbittorrentCategories(config, true);
    if (!result.connected) {
      set.status = 502;
    }
    return result;
  })
  .get('/qbittorrent/tags', async (ctx: any) => {
    const { user, set } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await fetchQbittorrentTags(config, true);
    if (!result.connected) {
      set.status = 502;
    }
    return result;
  })
  .get('/qbittorrent/torrents/:hash/files', async (ctx: any) => {
    const { user, set, params } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await fetchQbittorrentTorrentFiles(config, true, params.hash);
    if (!result.connected) {
      set.status = 502;
    }
    return result;
  })
  .get(
    '/qbittorrent/torrents/:hash/peers',
    async (ctx: any) => {
      const { user, set, params, query } = ctx;
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const rid = query?.rid ? parseInt(query.rid, 10) : undefined;
      const result = await fetchQbittorrentTorrentPeers(config, true, params.hash, rid);
      if (!result.connected) {
        set.status = 502;
      }
      return result;
    },
    {
      query: t.Object({
        rid: t.Optional(t.String()),
      }),
    }
  )
  .get('/qbittorrent/torrents/:hash/peers/stream', async (ctx: any) => {
    const { user, set, params, request } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
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
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    return createJsonSseResponse({
      request,
      poll: () => fetchQbittorrentTorrent(config, true, params.hash),
      intervalMs: () => Math.max(1000, config.poll_interval_seconds * 1000),
      retryMs: 3000,
      onError: error => ({
        enabled: true,
        connected: false,
        torrent: null,
        error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
      }),
      logLabel: 'qBittorrent torrent stream',
    });
  })
  .post(
    '/qbittorrent/torrents/:hash/rename',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const result = await renameQbittorrentTorrent(config, true, { hash: params.hash, name: body.name });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
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
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const result = await renameQbittorrentTorrentFile(config, true, {
        hash: params.hash,
        old_path: body.old_path,
        new_path: body.new_path,
      });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
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
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const category = typeof body.category === 'string' ? body.category : null;
      const result = await setQbittorrentTorrentCategory(config, true, { hash: params.hash, category });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
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
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const tags = Array.isArray(body.tags) ? body.tags : [];
      const previousTags = Array.isArray(body.previous_tags) ? body.previous_tags : null;
      const result = await setQbittorrentTorrentTags(config, true, {
        hash: params.hash,
        tags,
        previous_tags: previousTags,
      });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
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
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await pauseQbittorrentTorrent(config, true, { hash: params.hash });
    if (!result.connected || !result.success) {
      set.status = 502;
    }
    return result;
  })
  .post('/qbittorrent/torrents/:hash/resume', async (ctx: any) => {
    const { user, set, params } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    const plugin = await prisma.plugin.findFirst({
      where: { type: 'qbittorrent' },
      select: { enabled: true, config: true },
    });

    if (!plugin?.enabled) {
      set.status = 400;
      return { error: 'qBittorrent plugin is disabled' };
    }

    const config = normalizeQbittorrentConfig(plugin.config);
    if (!config) {
      set.status = 400;
      return { error: 'qBittorrent plugin is enabled but not configured' };
    }

    const result = await resumeQbittorrentTorrent(config, true, { hash: params.hash });
    if (!result.connected || !result.success) {
      set.status = 502;
    }
    return result;
  })
  .post(
    '/qbittorrent/torrents/:hash/delete',
    async (ctx: any) => {
      const { user, set, params, body } = ctx;
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const deleteFiles = Boolean(body.delete_files);
      const result = await deleteQbittorrentTorrent(config, true, { hash: params.hash, delete_files: deleteFiles });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
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
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const result = await addQbittorrentMagnet(config, true, { magnet: body.magnet });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
    },
    {
      body: t.Object({
        magnet: t.String(),
      }),
    }
  )
  .post(
    '/qbittorrent/torrents/add-file',
    async (ctx: any) => {
      const { user, set, body } = ctx;
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
        select: { enabled: true, config: true },
      });

      if (!plugin?.enabled) {
        set.status = 400;
        return { error: 'qBittorrent plugin is disabled' };
      }

      const config = normalizeQbittorrentConfig(plugin.config);
      if (!config) {
        set.status = 400;
        return { error: 'qBittorrent plugin is enabled but not configured' };
      }

      const torrent = body.torrent;
      const isWebFile = torrent instanceof File;
      if (!isWebFile) {
        set.status = 400;
        return { error: 'Invalid torrent file' };
      }
      if (torrent.size > 5 * 1024 * 1024) {
        set.status = 413;
        return { error: 'Torrent file is too large' };
      }

      const result = await addQbittorrentTorrentFile(config, true, { torrent });
      if (!result.connected || !result.success) {
        set.status = 502;
      }
      return result;
    },
    {
      body: t.Object({
        torrent: t.Any(),
      }),
    }
  )
  .get('/qbittorrent/stream', async (ctx: any) => {
    const { user, set, request } = ctx;
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    return createJsonSseResponse({
      request,
      poll: getQbittorrentSnapshot,
      intervalMs: snapshot => Math.max(1000, snapshot.poll_interval_seconds * 1000),
      retryMs: 5000,
      onError: () => ({
        ...buildQbittorrentDisabledSnapshot('Failed to refresh qBittorrent status'),
        enabled: true,
        connected: false,
      }),
      logLabel: 'qBittorrent stream',
    });
  });
