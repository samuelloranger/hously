import { Elysia, t } from 'elysia';
import { Prisma } from '@prisma/client';
import { auth } from '../../auth';
import { prisma } from '../../db';
import { nowUtc } from '../../utils';
import { isValidHttpUrl } from '../../utils/plugins/utils';
import { normalizeTrackerConfig } from '../../utils/plugins/normalizers';
import { fetchTrackerStats } from '../../jobs';
import { enqueueTask } from '../../services/backgroundQueue';
import { logActivity } from '../../utils/activityLogs';
import { encrypt } from '../../services/crypto';
import type { TrackerType } from '../../utils/plugins/types';
import { requireAdmin } from '../../middleware/auth';
import { badRequest, serverError } from '../../utils/errors';

type AdminUser = { id: number; is_admin: boolean };

const trackerLabel = (type: TrackerType): string => type.toUpperCase();

async function getTrackerPluginHandler(
  type: TrackerType,
  user: AdminUser | null,
  set: { status?: number | string }
): Promise<{ plugin?: Record<string, unknown>; error?: string }> {
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
    return serverError(set, `Failed to fetch ${trackerLabel(type)} plugin config`);
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
  const flaresolverrUrl = body.flaresolverr_url.trim().replace(/\/+$/, '');
  const trackerUrl = body.tracker_url?.trim().replace(/\/+$/, '') || '';
  const username = body.username.trim();

  if (flaresolverrUrl && !isValidHttpUrl(flaresolverrUrl)) {
    return badRequest(set, 'Invalid flaresolverr_url. Must be a valid http(s) URL.');
  }

  if (!trackerUrl || !isValidHttpUrl(trackerUrl)) {
    return badRequest(set, 'Invalid tracker_url. Must be a valid http(s) URL.');
  }

  if (!username) {
    return badRequest(set, 'username is required');
  }

  try {
    const existingPlugin = await prisma.plugin.findFirst({
      where: { type },
    });
    const existingConfig = normalizeTrackerConfig(type, existingPlugin?.config);
    const providedPassword = body.password?.trim() || '';
    const password = providedPassword || existingConfig?.password || '';

    if (!password) {
      return badRequest(set, 'password is required');
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
        userId: user!.id,
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
    return serverError(set, `Failed to save ${trackerLabel(type)} plugin config`);
  }
}

const trackerBody = t.Object({
  flaresolverr_url: t.String(),
  tracker_url: t.String(),
  username: t.String(),
  password: t.Optional(t.String()),
  enabled: t.Optional(t.Boolean()),
});

export const trackerPluginsRoutes = new Elysia({ prefix: '/api/plugins' })
  .use(auth)
  .use(requireAdmin)
  .get('/c411', ({ user, set }) => getTrackerPluginHandler('c411', user, set))
  .put('/c411', ({ user, body, set }) => updateTrackerPluginHandler('c411', user, body, set), {
    body: trackerBody,
  })
  .get('/torr9', ({ user, set }) => getTrackerPluginHandler('torr9', user, set))
  .put('/torr9', ({ user, body, set }) => updateTrackerPluginHandler('torr9', user, body, set), {
    body: trackerBody,
  })
  .get('/la-cale', ({ user, set }) => getTrackerPluginHandler('la-cale', user, set))
  .put('/la-cale', ({ user, body, set }) => updateTrackerPluginHandler('la-cale', user, body, set), {
    body: trackerBody,
  });
