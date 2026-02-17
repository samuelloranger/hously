import { Elysia, t } from 'elysia';
import { Prisma } from '@prisma/client';
import { auth } from '../auth';
import { prisma } from '../db';
import { nowUtc } from '../utils';
import { normalizeQbittorrentConfig } from '../services/qbittorrentService';
import type { ArrProfile } from '@hously/shared';

interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
}

interface RadarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
}

interface SonarrPluginConfig {
  api_key: string;
  website_url: string;
  root_folder_path: string;
  quality_profile_id: number;
  language_profile_id: number;
}

interface ScrutinyPluginConfig {
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

const normalizeRadarrConfig = (config: unknown): RadarrPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  const rootFolderPath = typeof cfg.root_folder_path === 'string' ? cfg.root_folder_path.trim() : '';
  const qualityProfileId =
    typeof cfg.quality_profile_id === 'number'
      ? Math.trunc(cfg.quality_profile_id)
      : typeof cfg.quality_profile_id === 'string'
        ? parseInt(cfg.quality_profile_id, 10)
        : Number.NaN;

  if (!apiKey || !websiteUrl || !rootFolderPath || !Number.isFinite(qualityProfileId) || qualityProfileId <= 0) {
    return null;
  }

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
  };
};

const normalizeSonarrConfig = (config: unknown): SonarrPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = typeof cfg.api_key === 'string' ? cfg.api_key.trim() : '';
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  const rootFolderPath = typeof cfg.root_folder_path === 'string' ? cfg.root_folder_path.trim() : '';
  const qualityProfileId =
    typeof cfg.quality_profile_id === 'number'
      ? Math.trunc(cfg.quality_profile_id)
      : typeof cfg.quality_profile_id === 'string'
        ? parseInt(cfg.quality_profile_id, 10)
        : Number.NaN;
  const languageProfileId =
    typeof cfg.language_profile_id === 'number'
      ? Math.trunc(cfg.language_profile_id)
      : typeof cfg.language_profile_id === 'string'
        ? parseInt(cfg.language_profile_id, 10)
        : Number.NaN;

  if (
    !apiKey ||
    !websiteUrl ||
    !rootFolderPath ||
    !Number.isFinite(qualityProfileId) ||
    qualityProfileId <= 0 ||
    !Number.isFinite(languageProfileId) ||
    languageProfileId <= 0
  ) {
    return null;
  }

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
    root_folder_path: rootFolderPath,
    quality_profile_id: qualityProfileId,
    language_profile_id: languageProfileId,
  };
};

const normalizeScrutinyConfig = (config: unknown): ScrutinyPluginConfig | null => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const cfg = config as Record<string, unknown>;
  const websiteUrl = typeof cfg.website_url === 'string' ? cfg.website_url.trim() : '';
  if (!websiteUrl) return null;
  return {
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

const toProfiles = (value: unknown): ArrProfile[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const raw = entry as Record<string, unknown>;
      const id =
        typeof raw.id === 'number'
          ? Math.trunc(raw.id)
          : typeof raw.id === 'string'
            ? parseInt(raw.id, 10)
            : Number.NaN;
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!Number.isFinite(id) || id <= 0 || !name) return null;
      return { id, name };
    })
    .filter((entry): entry is ArrProfile => Boolean(entry));
};

const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed =
    typeof value === 'number' ? Math.trunc(value) : typeof value === 'string' ? parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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
  )
  .get('/radarr', async ({ user, set }) => {
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
        where: { type: 'radarr' },
      });

      const config = normalizeRadarrConfig(plugin?.config);
      return {
        plugin: {
          type: 'radarr',
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || '',
          api_key: config?.api_key || '',
          root_folder_path: config?.root_folder_path || '',
          quality_profile_id: config?.quality_profile_id || 1,
        },
      };
    } catch (error) {
      console.error('Error fetching Radarr plugin config:', error);
      set.status = 500;
      return { error: 'Failed to fetch Radarr plugin config' };
    }
  })
  .put(
    '/radarr',
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
      const rootFolderPath = body.root_folder_path.trim();
      const qualityProfileId = Math.trunc(body.quality_profile_id);
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      if (!apiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      if (!rootFolderPath) {
        set.status = 400;
        return { error: 'root_folder_path is required' };
      }

      if (!Number.isFinite(qualityProfileId) || qualityProfileId <= 0) {
        set.status = 400;
        return { error: 'quality_profile_id must be a positive integer' };
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'radarr' },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: apiKey,
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
            },
            updatedAt: now,
          },
          create: {
            type: 'radarr',
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: apiKey,
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
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
            root_folder_path: rootFolderPath,
            quality_profile_id: qualityProfileId,
          },
        };
      } catch (error) {
        console.error('Error saving Radarr plugin config:', error);
        set.status = 500;
        return { error: 'Failed to save Radarr plugin config' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        root_folder_path: t.String(),
        quality_profile_id: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .post(
    '/radarr/profiles',
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

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      if (!apiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      try {
        const qualityUrl = new URL('/api/v3/qualityprofile', websiteUrl);
        const qualityResponse = await fetch(qualityUrl.toString(), {
          headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        });

        if (!qualityResponse.ok) {
          set.status = 502;
          return { error: 'Failed to fetch Radarr quality profiles' };
        }

        const qualityPayload = (await qualityResponse.json()) as unknown;
        return {
          quality_profiles: toProfiles(qualityPayload),
        };
      } catch (error) {
        console.error('Error fetching Radarr profiles:', error);
        set.status = 500;
        return { error: 'Failed to fetch Radarr profiles' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
      }),
    }
  )
  .get('/sonarr', async ({ user, set }) => {
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
        where: { type: 'sonarr' },
      });

      const config = normalizeSonarrConfig(plugin?.config);
      return {
        plugin: {
          type: 'sonarr',
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || '',
          api_key: config?.api_key || '',
          root_folder_path: config?.root_folder_path || '',
          quality_profile_id: config?.quality_profile_id || 1,
          language_profile_id: config?.language_profile_id || 1,
        },
      };
    } catch (error) {
      console.error('Error fetching Sonarr plugin config:', error);
      set.status = 500;
      return { error: 'Failed to fetch Sonarr plugin config' };
    }
  })
  .put(
    '/sonarr',
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
      const rootFolderPath = body.root_folder_path.trim();
      const qualityProfileId = Math.trunc(body.quality_profile_id);
      const languageProfileId = Math.trunc(body.language_profile_id);
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      if (!apiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      if (!rootFolderPath) {
        set.status = 400;
        return { error: 'root_folder_path is required' };
      }

      if (!Number.isFinite(qualityProfileId) || qualityProfileId <= 0) {
        set.status = 400;
        return { error: 'quality_profile_id must be a positive integer' };
      }

      if (!Number.isFinite(languageProfileId) || languageProfileId <= 0) {
        set.status = 400;
        return { error: 'language_profile_id must be a positive integer' };
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'sonarr' },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: apiKey,
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
              language_profile_id: languageProfileId,
            },
            updatedAt: now,
          },
          create: {
            type: 'sonarr',
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: apiKey,
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
              language_profile_id: languageProfileId,
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
            root_folder_path: rootFolderPath,
            quality_profile_id: qualityProfileId,
            language_profile_id: languageProfileId,
          },
        };
      } catch (error) {
        console.error('Error saving Sonarr plugin config:', error);
        set.status = 500;
        return { error: 'Failed to save Sonarr plugin config' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        root_folder_path: t.String(),
        quality_profile_id: t.Numeric(),
        language_profile_id: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .post(
    '/sonarr/profiles',
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

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      if (!apiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      try {
        const qualityUrl = new URL('/api/v3/qualityprofile', websiteUrl);
        const languageUrl = new URL('/api/v3/languageprofile', websiteUrl);

        const [qualityResponse, languageResponse] = await Promise.all([
          fetch(qualityUrl.toString(), {
            headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
          }),
          fetch(languageUrl.toString(), {
            headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
          }),
        ]);

        if (!qualityResponse.ok || !languageResponse.ok) {
          set.status = 502;
          return { error: 'Failed to fetch Sonarr profiles' };
        }

        const [qualityPayload, languagePayload] = (await Promise.all([
          qualityResponse.json(),
          languageResponse.json(),
        ])) as [unknown, unknown];

        return {
          quality_profiles: toProfiles(qualityPayload),
          language_profiles: toProfiles(languagePayload),
        };
      } catch (error) {
        console.error('Error fetching Sonarr profiles:', error);
        set.status = 500;
        return { error: 'Failed to fetch Sonarr profiles' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
      }),
    }
  )
  .get('/scrutiny', async ({ user, set }) => {
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
        where: { type: 'scrutiny' },
      });

      const config = normalizeScrutinyConfig(plugin?.config);
      return {
        plugin: {
          type: 'scrutiny',
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || '',
        },
      };
    } catch (error) {
      console.error('Error fetching Scrutiny plugin config:', error);
      set.status = 500;
      return { error: 'Failed to fetch Scrutiny plugin config' };
    }
  })
  .put(
    '/scrutiny',
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
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: 'scrutiny' },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
            },
            updatedAt: now,
          },
          create: {
            type: 'scrutiny',
            enabled,
            config: {
              website_url: websiteUrl,
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
          },
        };
      } catch (error) {
        console.error('Error saving Scrutiny plugin config:', error);
        set.status = 500;
        return { error: 'Failed to save Scrutiny plugin config' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/qbittorrent', async ({ user, set }) => {
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
      set.status = 500;
      return { error: 'Failed to fetch qBittorrent plugin config' };
    }
  })
  .put(
    '/qbittorrent',
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
      const username = body.username.trim();
      const pollIntervalSeconds = clampInteger(body.poll_interval_seconds, 1, 30, 1);
      const maxItems = clampInteger(body.max_items, 3, 30, 8);

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        set.status = 400;
        return { error: 'Invalid website_url. Must be a valid http(s) URL.' };
      }

      if (!username) {
        set.status = 400;
        return { error: 'username is required' };
      }

      try {
        const existingPlugin = await prisma.plugin.findFirst({
          where: { type: 'qbittorrent' },
        });
        const existingConfig = normalizeQbittorrentConfig(existingPlugin?.config);
        const providedPassword = body.password?.trim() || '';
        const password = providedPassword || existingConfig?.password || '';

        if (!password) {
          set.status = 400;
          return { error: 'password is required' };
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password,
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
        set.status = 500;
        return { error: 'Failed to save qBittorrent plugin config' };
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
  );
