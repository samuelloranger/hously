import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { prisma } from '../db';
import { nowUtc } from '../utils';

interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
}

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeJellyfinConfig = (config: unknown): JellyfinPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

export const pluginsRoutes = new Elysia({ prefix: '/api/plugins' })
  .use(auth)
  .get('/jellyfin', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: 'Admin privileges required' };
    }

    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: 'jellyfin' },
      });

      const config = normalizeJellyfinConfig(plugin?.config);
      return {
        plugin: {
          type: 'jellyfin',
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || '',
          api_key: config?.api_key || '',
        },
      };
    } catch (error) {
      console.error('Error fetching Jellyfin plugin config:', error);
      set.status = 500;
      return { error: 'Failed to fetch Jellyfin plugin config' };
    }
  })
  .put(
    '/jellyfin',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: 'Admin privileges required' };
      }

      const websiteUrl = body.website_url.trim().replace(/\/+$/, '');
      const apiKey = body.api_key.trim();
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      if (!apiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'jellyfin' },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: apiKey,
            },
            updatedAt: now,
          },
          create: {
            type: 'jellyfin',
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: apiKey,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: apiKey,
          },
        };
      } catch (error) {
        console.error('Error saving Jellyfin plugin config:', error);
        set.status = 500;
        return { error: 'Failed to save Jellyfin plugin config' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  );
