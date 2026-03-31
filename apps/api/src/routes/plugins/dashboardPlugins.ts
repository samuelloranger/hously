import { Elysia, t } from 'elysia';
import { Prisma } from '@prisma/client';
import { auth } from '../../auth';
import { prisma } from '../../db';
import { nowUtc } from '../../utils';
import { normalizeQbittorrentConfig, invalidateQbittorrentPluginConfigCache } from '../../services/qbittorrent/config';
import { clampInteger, isValidHttpUrl } from '../../utils/plugins/utils';
import {
  normalizeClockifyConfig,
  normalizeHackernewsConfig,
  normalizeRedditConfig,
  normalizeTmdbConfig,
  normalizeOllamaConfig,
  normalizeWeatherConfig,
} from '../../utils/plugins/normalizers';
import { searchSubreddits } from '../../utils/dashboard/reddit';
import { logActivity } from '../../utils/activityLogs';
import { encrypt } from '../../services/crypto';
import { deleteCache } from '../../services/cache';
import { requireAdmin } from '../../middleware/auth';
import { badGateway, badRequest, serverError } from '../../utils/errors';

export const dashboardPluginsRoutes = new Elysia({ prefix: '/api/plugins' })
  .use(auth)
  .use(requireAdmin)
  .get('/weather', async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'weather' },
      });
      const config = normalizeWeatherConfig(plugin?.config);

      return {
        plugin: {
          type: 'weather',
          enabled: plugin?.enabled || false,
          address: config?.address || '',
          temperature_unit: config?.temperature_unit || 'fahrenheit',
        },
      };
    } catch (error) {
      console.error('Error fetching Weather plugin config:', error);
      return serverError(set, 'Failed to fetch Weather plugin config');
    }
  })
  .put(
    '/weather',
    async ({ user, body, set }) => {
      const address = body.address.trim();
      const temperatureUnit = body.temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit';
      const enabled = body.enabled ?? true;

      if (!address) {
        return badRequest(set, 'address is required');
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'weather' },
          update: {
            enabled,
            config: {
              address,
              temperature_unit: temperatureUnit,
            },
            updatedAt: now,
          },
          create: {
            type: 'weather',
            enabled,
            config: {
              address,
              temperature_unit: temperatureUnit,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'weather' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            address,
            temperature_unit: temperatureUnit,
          },
        };
      } catch (error) {
        console.error('Error saving Weather plugin config:', error);
        return serverError(set, 'Failed to save Weather plugin config');
      }
    },
    {
      body: t.Object({
        address: t.String(),
        temperature_unit: t.Union([t.Literal('fahrenheit'), t.Literal('celsius')]),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/tmdb', async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'tmdb' },
      });
      const config = normalizeTmdbConfig(plugin?.config);

      return {
        plugin: {
          type: 'tmdb',
          enabled: plugin?.enabled || false,
          api_key: '',
          popularity_threshold: config?.popularity_threshold ?? 15,
        },
      };
    } catch (error) {
      console.error('Error fetching TMDB plugin config:', error);
      return serverError(set, 'Failed to fetch TMDB plugin config');
    }
  })
  .put(
    '/tmdb',
    async ({ user, body, set }) => {
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'tmdb' },
      });
      const existingConfig = normalizeTmdbConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || '';
      const enabled = body.enabled ?? true;
      const popularityThreshold = Math.max(0, Math.min(100, Math.round(body.popularity_threshold ?? 15)));

      if (!apiKey) {
        return badRequest(set, 'api_key is required');
      }

      try {
        const now = nowUtc();
        const configPayload = {
          api_key: encrypt(apiKey),
          popularity_threshold: popularityThreshold,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: 'tmdb' },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: 'tmdb',
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'tmdb' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            api_key: '',
            popularity_threshold: popularityThreshold,
          },
        };
      } catch (error) {
        console.error('Error saving TMDB plugin config:', error);
        return serverError(set, 'Failed to save TMDB plugin config');
      }
    },
    {
      body: t.Object({
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
        popularity_threshold: t.Optional(t.Number()),
      }),
    }
  )
  .get('/ollama', async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'ollama' },
      });
      const config = normalizeOllamaConfig(plugin?.config);

      return {
        plugin: {
          type: 'ollama' as const,
          enabled: plugin?.enabled || false,
          base_url: config?.base_url || '',
          model: config?.model || 'llama3.2',
        },
      };
    } catch (error) {
      console.error('Error fetching Ollama plugin config:', error);
      return serverError(set, 'Failed to fetch Ollama plugin config');
    }
  })
  .put(
    '/ollama',
    async ({ user, body, set }) => {
      const baseUrl = body.base_url.trim().replace(/\/+$/, '');
      const model = (body.model ?? '').trim() || 'llama3.2';
      const enabled = body.enabled ?? true;

      if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return badRequest(set, 'Invalid base_url. Must be a valid http(s) URL (e.g. http://127.0.0.1:11434).');
      }

      try {
        const now = nowUtc();
        const configPayload = {
          base_url: baseUrl,
          model,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: 'ollama' },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: 'ollama',
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'ollama' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            base_url: baseUrl,
            model,
          },
        };
      } catch (error) {
        console.error('Error saving Ollama plugin config:', error);
        return serverError(set, 'Failed to save Ollama plugin config');
      }
    },
    {
      body: t.Object({
        base_url: t.String(),
        model: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/clockify', async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'clockify' },
      });
      const config = normalizeClockifyConfig(plugin?.config);

      return {
        plugin: {
          type: 'clockify',
          enabled: plugin?.enabled || false,
          api_key: '',
          workspace_id: config.workspace_id,
          user_id: config.user_id,
        },
      };
    } catch (error) {
      console.error('Error fetching Clockify plugin config:', error);
      return serverError(set, 'Failed to fetch Clockify plugin config');
    }
  })
  .put(
    '/clockify',
    async ({ user, body, set }) => {
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'clockify' },
      });
      const existingConfig = normalizeClockifyConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const providedWorkspaceId = body.workspace_id?.trim();
      const providedUserId = body.user_id?.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || '';
      const workspaceId = providedWorkspaceId || existingConfig?.workspace_id || '';
      const userId = providedUserId || existingConfig?.user_id || '';
      const enabled = body.enabled ?? true;

      if (!apiKey) {
        return badRequest(set, 'api_key is required');
      }

      try {
        const now = nowUtc();
        const configPayload = {
          api_key: encrypt(apiKey),
          workspace_id: workspaceId,
          user_id: userId,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: 'clockify' },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: 'clockify',
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'clockify' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            api_key: '',
            workspace_id: workspaceId,
            user_id: userId,
          },
        };
      } catch (error) {
        console.error('Error saving Clockify plugin config:', error);
        return serverError(set, 'Failed to save Clockify plugin config');
      }
    },
    {
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        api_key: t.String(),
        workspace_id: t.Optional(t.String()),
        user_id: t.Optional(t.String()),
      }),
    }
  )
  .get('/qbittorrent', async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'qbittorrent' },
      });

      const config = normalizeQbittorrentConfig(plugin?.config);
      return {
        plugin: {
          type: 'qbittorrent',
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || '',
          username: config?.username || '',
          password_set: Boolean(config?.password),
          poll_interval_seconds: config?.poll_interval_seconds || 1,
          max_items: config?.max_items || 8,
        },
      };
    } catch (error) {
      console.error('Error fetching qBittorrent plugin config:', error);
      return serverError(set, 'Failed to fetch qBittorrent plugin config');
    }
  })
  .put(
    '/qbittorrent',
    async ({ user, body, set }) => {
      const websiteUrl = body.website_url.trim().replace(/\/+$/, '');
      const username = body.username.trim();
      const pollIntervalSeconds = clampInteger(body.poll_interval_seconds, 1, 30, 1);
      const maxItems = clampInteger(body.max_items, 3, 30, 8);

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(set, 'Invalid website_url. Must be a valid http(s) URL.');
      }

      if (!username) {
        return badRequest(set, 'username is required');
      }

      try {
        const existingPlugin = await prisma.plugin.findFirst({
          where: { type: 'qbittorrent' },
        });
        const existingConfig = normalizeQbittorrentConfig(existingPlugin?.config);
        const providedPassword = body.password?.trim() || '';
        const password = providedPassword || existingConfig?.password || '';

        if (!password) {
          return badRequest(set, 'password is required');
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password: encrypt(password),
          poll_interval_seconds: pollIntervalSeconds,
          max_items: maxItems,
        };

        const plugin = await prisma.plugin.upsert({
          where: { type: 'qbittorrent' },
          update: {
            enabled,
            config,
            updatedAt: now,
          },
          create: {
            type: 'qbittorrent',
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });

        await invalidateQbittorrentPluginConfigCache();

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'qbittorrent' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            username,
            password_set: true,
            poll_interval_seconds: pollIntervalSeconds,
            max_items: maxItems,
          },
        };
      } catch (error) {
        console.error('Error saving qBittorrent plugin config:', error);
        return serverError(set, 'Failed to save qBittorrent plugin config');
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        username: t.String(),
        password: t.Optional(t.String()),
        poll_interval_seconds: t.Optional(t.Numeric()),
        max_items: t.Optional(t.Numeric()),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/hackernews', async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'hackernews' },
      });
      const config = normalizeHackernewsConfig(plugin?.config);

      return {
        plugin: {
          type: 'hackernews',
          enabled: plugin?.enabled || false,
          feed_type: config?.feed_type || 'top',
          story_count: config?.story_count || 10,
        },
      };
    } catch (error) {
      console.error('Error fetching Hacker News plugin config:', error);
      return serverError(set, 'Failed to fetch Hacker News plugin config');
    }
  })
  .put(
    '/hackernews',
    async ({ user, body, set }) => {
      const validFeedTypes = ['top', 'best', 'new', 'ask', 'show', 'job'] as const;
      const feedType = validFeedTypes.includes(body.feed_type as (typeof validFeedTypes)[number])
        ? body.feed_type
        : 'top';
      const storyCount = Math.max(1, Math.min(Math.trunc(Number(body.story_count) || 10), 50));
      const enabled = body.enabled ?? true;

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'hackernews' },
          update: {
            enabled,
            config: {
              feed_type: feedType,
              story_count: storyCount,
            },
            updatedAt: now,
          },
          create: {
            type: 'hackernews',
            enabled,
            config: {
              feed_type: feedType,
              story_count: storyCount,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await deleteCache('dashboard:hackernews');

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'hackernews' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            feed_type: feedType,
            story_count: storyCount,
          },
        };
      } catch (error) {
        console.error('Error saving Hacker News plugin config:', error);
        return serverError(set, 'Failed to save Hacker News plugin config');
      }
    },
    {
      body: t.Object({
        feed_type: t.String(),
        story_count: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/reddit', async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'reddit' },
      });
      const config = normalizeRedditConfig(plugin?.config);

      return {
        plugin: {
          type: 'reddit',
          enabled: plugin?.enabled || false,
          subreddits: config.subreddits,
        },
      };
    } catch (error) {
      console.error('Error fetching Reddit plugin config:', error);
      return serverError(set, 'Failed to fetch Reddit plugin config');
    }
  })
  .put(
    '/reddit',
    async ({ user, body, set }) => {
      const rawSubreddits = body.subreddits ?? [];
      const subreddits = rawSubreddits
        .map((s: string) => s.replace(/^r\//, '').trim())
        .filter((s: string) => /^[a-zA-Z0-9_]+$/.test(s));

      if (subreddits.length === 0) {
        return badRequest(set, 'At least one valid subreddit is required');
      }

      const enabled = body.enabled ?? true;

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'reddit' },
          update: {
            enabled,
            config: { subreddits },
            updatedAt: now,
          },
          create: {
            type: 'reddit',
            enabled,
            config: { subreddits },
            createdAt: now,
            updatedAt: now,
          },
        });

        await deleteCache('dashboard:reddit');

        await logActivity({
          type: 'plugin_updated',
          userId: user!.id,
          payload: { plugin_type: 'reddit' },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            subreddits,
          },
        };
      } catch (error) {
        console.error('Error saving Reddit plugin config:', error);
        return serverError(set, 'Failed to save Reddit plugin config');
      }
    },
    {
      body: t.Object({
        subreddits: t.Array(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/reddit/search', async ({ user, set, query }) => {
    const q = (query as Record<string, string | undefined>).q?.trim() || '';
    if (q.length < 2) {
      return { results: [] };
    }

    try {
      const results = await searchSubreddits(q);
      return { results };
    } catch (error) {
      console.error('Error searching subreddits:', error);
      return badGateway(set, 'Failed to search subreddits');
    }
  });
