import { Elysia, t } from 'elysia';
import { Prisma } from '@prisma/client';
import { auth } from '../auth';
import { prisma } from '../db';
import { nowUtc } from '../utils';
import { normalizeQbittorrentConfig, invalidateQbittorrentPluginConfigCache } from '../services/qbittorrentService';
import { clampInteger, isValidHttpUrl, toProfiles } from '../utils/plugins/utils';
import {
  normalizeHackernewsConfig,
  normalizeJellyfinConfig,
  normalizeNetdataConfig,
  normalizeRadarrConfig,
  normalizeRedditConfig,
  normalizeScrutinyConfig,
  normalizeSonarrConfig,
  normalizeTmdbConfig,
  normalizeTrackerConfig,
  normalizeWeatherConfig,
} from '../utils/plugins/normalizers';
import { searchSubreddits } from '../utils/dashboard/reddit';
import { fetchTrackerStats } from '../jobs';
import { enqueueTask } from '../services/backgroundQueue';
import { logActivity } from '../utils/activityLogs';
import { encrypt } from '../services/crypto';
import { deleteCache } from '../services/cache';
import type { TrackerType } from '../utils/plugins/types';

type AdminUser = { id: number; is_admin: boolean };

const trackerLabel = (type: TrackerType): string => type.toUpperCase();

async function getTrackerPluginHandler(
  type: TrackerType,
  user: AdminUser | null,
  set: { status?: number | string }
): Promise<{ plugin?: Record<string, unknown>; error?: string }> {
  if (!user) {
    set.status = 401;
    return { error: 'Unauthorized' };
  }

  if (!user.is_admin) {
    set.status = 403;
    return { error: 'Admin privileges required' };
  }

  try {
    const plugin = await prisma.plugin.findFirst({ where: { type } });
    const config = normalizeTrackerConfig(type, plugin?.config);

    return {
      plugin: {
        type,
        enabled: plugin?.enabled || false,
        flaresolverr_url: config?.flaresolverr_url || '',
        tracker_url: config?.tracker_url || '',
        username: config?.username || '',
        password_set: Boolean(config?.password),
      },
    };
  } catch (error) {
    console.error(`Error fetching ${trackerLabel(type)} plugin config:`, error);
    set.status = 500;
    return { error: `Failed to fetch ${trackerLabel(type)} plugin config` };
  }
}

async function updateTrackerPluginHandler(
  type: TrackerType,
  user: AdminUser | null,
  body: {
    flaresolverr_url: string;
    tracker_url?: string;
    username: string;
    password?: string;
    enabled?: boolean;
  },
  set: { status?: number | string }
): Promise<{ success?: boolean; plugin?: Record<string, unknown>; error?: string }> {
  if (!user) {
    set.status = 401;
    return { error: 'Unauthorized' };
  }

  if (!user.is_admin) {
    set.status = 403;
    return { error: 'Admin privileges required' };
  }

  const flaresolverrUrl = body.flaresolverr_url.trim().replace(/\/+$/, '');
  const trackerUrl = body.tracker_url?.trim().replace(/\/+$/, '') || '';
  const username = body.username.trim();

  if (flaresolverrUrl && !isValidHttpUrl(flaresolverrUrl)) {
    set.status = 400;
    return { error: 'Invalid flaresolverr_url. Must be a valid http(s) URL.' };
  }

  if (!trackerUrl || !isValidHttpUrl(trackerUrl)) {
    set.status = 400;
    return {
      error: 'Invalid tracker_url. Must be a valid http(s) URL.',
    };
  }

  if (!username) {
    set.status = 400;
    return { error: 'username is required' };
  }

  try {
    const existingPlugin = await prisma.plugin.findFirst({
      where: { type },
    });
    const existingConfig = normalizeTrackerConfig(type, existingPlugin?.config);
    const providedPassword = body.password?.trim() || '';
    const password = providedPassword || existingConfig?.password || '';

    if (!password) {
      set.status = 400;
      return { error: 'password is required' };
    }

    const now = nowUtc();
    const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
    const config: Prisma.InputJsonValue = {
      flaresolverr_url: flaresolverrUrl || undefined,
      tracker_url: trackerUrl,
      username,
      password: encrypt(password),
    };

    const plugin = await prisma.plugin.upsert({
      where: { type },
      update: {
        enabled,
        config,
        updatedAt: now,
      },
      create: {
        type,
        enabled,
        config,
        createdAt: now,
        updatedAt: now,
      },
    });

    enqueueTask(`${type}:fetchStats`, async () => {
      await fetchTrackerStats(type, { trigger: 'plugin' });
    });

    enqueueTask(`activity:plugin_updated:${type}`, async () => {
      await logActivity({
        type: 'plugin_updated',
        userId: user.id,
        payload: { plugin_type: type },
      });
    });

    return {
      success: true,
      plugin: {
        type: plugin.type,
        enabled: plugin.enabled,
        flaresolverr_url: flaresolverrUrl,
        tracker_url: trackerUrl,
        username,
        password_set: true,
      },
    };
  } catch (error) {
    console.error(`Error saving ${trackerLabel(type)} plugin config:`, error);
    set.status = 500;
    return { error: `Failed to save ${trackerLabel(type)} plugin config` };
  }
}

export const pluginsRoutes = new Elysia({ prefix: '/api/plugins' })
  .use(auth)
  .get('/c411', ({ user, set }) => getTrackerPluginHandler('c411', user, set))
  .put('/c411', ({ user, body, set }) => updateTrackerPluginHandler('c411', user, body, set), {
    body: t.Object({
      flaresolverr_url: t.String(),
      tracker_url: t.String(),
      username: t.String(),
      password: t.Optional(t.String()),
      enabled: t.Optional(t.Boolean()),
    }),
  })
  .get('/torr9', ({ user, set }) => getTrackerPluginHandler('torr9', user, set))
  .put('/torr9', ({ user, body, set }) => updateTrackerPluginHandler('torr9', user, body, set), {
    body: t.Object({
      flaresolverr_url: t.String(),
      tracker_url: t.String(),
      username: t.String(),
      password: t.Optional(t.String()),
      enabled: t.Optional(t.Boolean()),
    }),
  })
  .get('/la-cale', ({ user, set }) => getTrackerPluginHandler('la-cale', user, set))
  .put('/la-cale', ({ user, body, set }) => updateTrackerPluginHandler('la-cale', user, body, set), {
    body: t.Object({
      flaresolverr_url: t.String(),
      tracker_url: t.String(),
      username: t.String(),
      password: t.Optional(t.String()),
      enabled: t.Optional(t.Boolean()),
    }),
  })
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
          api_key: '',
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
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'jellyfin' },
      });
      const existingConfig = normalizeJellyfinConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || '';
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
              api_key: encrypt(apiKey),
            },
            updatedAt: now,
          },
          create: {
            type: 'jellyfin',
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        enqueueTask('activity:plugin_updated:jellyfin', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'jellyfin' },
          });
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: '',
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
          api_key: '',
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
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'radarr' },
      });
      const existingConfig = normalizeRadarrConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || '';
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
              api_key: encrypt(apiKey),
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
              api_key: encrypt(apiKey),
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        enqueueTask('activity:plugin_updated:radarr', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'radarr' },
          });
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: '',
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

      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'radarr' },
      });
      const existingConfig = normalizeRadarrConfig(existingPlugin?.config);
      const resolvedApiKey = apiKey || existingConfig?.api_key || '';

      if (!resolvedApiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      try {
        const qualityUrl = new URL('/api/v3/qualityprofile', websiteUrl);
        const qualityResponse = await fetch(qualityUrl.toString(), {
          headers: { 'X-Api-Key': resolvedApiKey, Accept: 'application/json' },
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
          api_key: '',
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
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'sonarr' },
      });
      const existingConfig = normalizeSonarrConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || '';
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
              api_key: encrypt(apiKey),
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
              api_key: encrypt(apiKey),
              root_folder_path: rootFolderPath,
              quality_profile_id: qualityProfileId,
              language_profile_id: languageProfileId,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        enqueueTask('activity:plugin_updated:sonarr', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'sonarr' },
          });
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: '',
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

      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'sonarr' },
      });
      const existingConfig = normalizeSonarrConfig(existingPlugin?.config);
      const resolvedApiKey = apiKey || existingConfig?.api_key || '';

      if (!resolvedApiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
      }

      try {
        const qualityUrl = new URL('/api/v3/qualityprofile', websiteUrl);
        const languageUrl = new URL('/api/v3/languageprofile', websiteUrl);

        const [qualityResponse, languageResponse] = await Promise.all([
          fetch(qualityUrl.toString(), {
            headers: { 'X-Api-Key': resolvedApiKey, Accept: 'application/json' },
          }),
          fetch(languageUrl.toString(), {
            headers: { 'X-Api-Key': resolvedApiKey, Accept: 'application/json' },
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

        enqueueTask('activity:plugin_updated:scrutiny', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'scrutiny' },
          });
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
  .get('/netdata', async ({ user, set }) => {
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
        where: { type: 'netdata' },
      });

      const config = normalizeNetdataConfig(plugin?.config);
      return {
        plugin: {
          type: 'netdata',
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || '',
        },
      };
    } catch (error) {
      console.error('Error fetching Netdata plugin config:', error);
      set.status = 500;
      return { error: 'Failed to fetch Netdata plugin config' };
    }
  })
  .put(
    '/netdata',
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
          where: { type: 'netdata' },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
            },
            updatedAt: now,
          },
          create: {
            type: 'netdata',
            enabled,
            config: {
              website_url: websiteUrl,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        enqueueTask('activity:plugin_updated:netdata', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'netdata' },
          });
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
        console.error('Error saving Netdata plugin config:', error);
        set.status = 500;
        return { error: 'Failed to save Netdata plugin config' };
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
  .get('/weather', async ({ user, set }) => {
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
      set.status = 500;
      return { error: 'Failed to fetch Weather plugin config' };
    }
  })
  .put(
    '/weather',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: 'Admin privileges required' };
      }

      const address = body.address.trim();
      const temperatureUnit = body.temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit';
      const enabled = body.enabled ?? true;

      if (!address) {
        set.status = 400;
        return { error: 'address is required' };
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

        enqueueTask('activity:plugin_updated:weather', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'weather' },
          });
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
        set.status = 500;
        return { error: 'Failed to save Weather plugin config' };
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
      set.status = 500;
      return { error: 'Failed to fetch TMDB plugin config' };
    }
  })
  .put(
    '/tmdb',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: 'Admin privileges required' };
      }

      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: 'tmdb' },
      });
      const existingConfig = normalizeTmdbConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || '';
      const enabled = body.enabled ?? true;
      const popularityThreshold = Math.max(0, Math.min(100, Math.round(body.popularity_threshold ?? 15)));

      if (!apiKey) {
        set.status = 400;
        return { error: 'api_key is required' };
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

        enqueueTask('activity:plugin_updated:tmdb', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'tmdb' },
          });
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
        set.status = 500;
        return { error: 'Failed to save TMDB plugin config' };
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

        enqueueTask('activity:plugin_updated:qbittorrent', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'qbittorrent' },
          });
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
  )
  .get('/hackernews', async ({ user, set }) => {
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
      set.status = 500;
      return { error: 'Failed to fetch Hacker News plugin config' };
    }
  })
  .put(
    '/hackernews',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: 'Admin privileges required' };
      }

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

        enqueueTask('activity:plugin_updated:hackernews', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'hackernews' },
          });
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
        set.status = 500;
        return { error: 'Failed to save Hacker News plugin config' };
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
      set.status = 500;
      return { error: 'Failed to fetch Reddit plugin config' };
    }
  })
  .put(
    '/reddit',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: 'Admin privileges required' };
      }

      const rawSubreddits = body.subreddits ?? [];
      const subreddits = rawSubreddits
        .map((s: string) => s.replace(/^r\//, '').trim())
        .filter((s: string) => /^[a-zA-Z0-9_]+$/.test(s));

      if (subreddits.length === 0) {
        set.status = 400;
        return { error: 'At least one valid subreddit is required' };
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

        enqueueTask('activity:plugin_updated:reddit', async () => {
          await logActivity({
            type: 'plugin_updated',
            userId: user.id,
            payload: { plugin_type: 'reddit' },
          });
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
        set.status = 500;
        return { error: 'Failed to save Reddit plugin config' };
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
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    if (!user.is_admin) {
      set.status = 403;
      return { error: 'Admin privileges required' };
    }

    const q = (query as Record<string, string | undefined>).q?.trim() || '';
    if (q.length < 2) {
      return { results: [] };
    }

    try {
      const results = await searchSubreddits(q);
      return { results };
    } catch (error) {
      console.error('Error searching subreddits:', error);
      set.status = 502;
      return { error: 'Failed to search subreddits' };
    }
  });
