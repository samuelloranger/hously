import { Elysia, t } from 'elysia';
import { Prisma } from '@prisma/client';
import { auth } from '../auth';
import { prisma } from '../db';
import { nowUtc } from '../utils';
import { normalizeQbittorrentConfig } from '../services/qbittorrentService';
import { clampInteger, isValidHttpUrl, toProfiles } from '../utils/plugins/utils';
import {
  normalizeJellyfinConfig,
  normalizeNetdataConfig,
  normalizeRadarrConfig,
  normalizeScrutinyConfig,
  normalizeSonarrConfig,
  normalizeWeatherConfig,
  normalizeYggConfig,
} from '../utils/plugins/normalizers';
import { fetchYggTopPanelStats } from '../jobs';
import { enqueueTask } from '../services/backgroundQueue';

export const pluginsRoutes = new Elysia({ prefix: '/api/plugins' })
  .use(auth)
  .get('/ygg', async ({ user, set }) => {
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
        where: { type: 'ygg' },
      });

      const config = normalizeYggConfig(plugin?.config);
      return {
        plugin: {
          type: 'ygg',
          enabled: plugin?.enabled || false,
          flaresolverr_url: config?.flaresolverr_url || '',
          ygg_url: config?.ygg_url || '',
          username: config?.username || '',
          password_set: Boolean(config?.password),
        },
      };
    } catch (error) {
      console.error('Error fetching YGG plugin config:', error);
      set.status = 500;
      return { error: 'Failed to fetch YGG plugin config' };
    }
  })
  .put(
    '/ygg',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      if (!user.is_admin) {
        set.status = 403;
        return { error: 'Admin privileges required' };
      }

      const flaresolverrUrl = body.flaresolverr_url.trim().replace(/\/+$/, '');
      const yggUrl = body.ygg_url.trim().replace(/\/+$/, '');
      const username = body.username.trim();

      if (flaresolverrUrl && !isValidHttpUrl(flaresolverrUrl)) {
        set.status = 400;
        return { error: 'Invalid flaresolverr_url. Must be a valid http(s) URL.' };
      }

      if (!yggUrl || !isValidHttpUrl(yggUrl)) {
        set.status = 400;
        return { error: 'Invalid ygg_url. Must be a valid http(s) URL.' };
      }

      if (!username) {
        set.status = 400;
        return { error: 'username is required' };
      }

      try {
        const existingPlugin = await prisma.plugin.findFirst({
          where: { type: 'ygg' },
        });
        const existingConfig = normalizeYggConfig(existingPlugin?.config);
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
          ygg_url: yggUrl,
          username,
          password,
        };

        const plugin = await prisma.plugin.upsert({
          where: { type: 'ygg' },
          update: {
            enabled,
            config,
            updatedAt: now,
          },
          create: {
            type: 'ygg',
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });

        enqueueTask('ygg:fetchTopPanelStats', async () => {
          await fetchYggTopPanelStats();
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            flaresolverr_url: flaresolverrUrl,
            ygg_url: yggUrl,
            username,
            password_set: true,
          },
        };
      } catch (error) {
        console.error('Error saving YGG plugin config:', error);
        set.status = 500;
        return { error: 'Failed to save YGG plugin config' };
      }
    },
    {
      body: t.Object({
        flaresolverr_url: t.String(),
        ygg_url: t.String(),
        username: t.String(),
        password: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    }
  )
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
