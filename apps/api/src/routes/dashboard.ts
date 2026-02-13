import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { formatIso } from '../utils';

interface JellyfinLatestItem {
  id: string;
  title: string;
  item_type: string | null;
  year: number | null;
  added_at: string | null;
}

interface JellyfinPluginConfig {
  api_key: string;
  website_url: string;
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const toYearOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeJellyfinConfig = (config: unknown): JellyfinPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const apiKey = toStringOrNull(cfg.api_key);
  const websiteUrl = toStringOrNull(cfg.website_url);
  if (!apiKey || !websiteUrl) return null;

  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ''),
  };
};

const mapJellyfinApiItem = (rawItem: unknown): JellyfinLatestItem | null => {
  const item = toRecord(rawItem);
  if (!item) return null;

  const title = toStringOrNull(item.Name) || toStringOrNull(item.SeriesName) || toStringOrNull(item.Album);
  if (!title) return null;

  const id = toStringOrNull(item.Id) || `${title}-${toStringOrNull(item.Type) || 'item'}`;
  const itemType = toStringOrNull(item.Type);
  const year = toYearOrNull(item.ProductionYear) || toYearOrNull(item.Year) || null;
  const addedAt = toStringOrNull(item.DateCreated);

  return { id, title, item_type: itemType, year, added_at: addedAt };
};

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard' })
  .use(auth)
  .get('/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      // Get today's range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 1. Events today (for current user only)
      const eventsTodayCount = await prisma.customEvent.count({
        where: {
          userId: user.id,
          startDatetime: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      // 2. Shopping Items (incomplete, not deleted)
      const shoppingCount = await prisma.shoppingItem.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
          deletedAt: null,
        },
      });

      // 3. Chores (incomplete)
      const choresCount = await prisma.chore.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
        },
      });

      // 4. Monthly total (tasks completed this month)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyTotal = await prisma.taskCompletion.count({
        where: {
          completedAt: { gte: startOfMonth },
        },
      });

      return {
        stats: {
          events_today: eventsTodayCount,
          shopping_count: shoppingCount,
          chores_count: choresCount,
          monthly_total: monthlyTotal,
        },
        activities: [],
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      set.status = 500;
      return { error: 'Failed to get dashboard stats' };
    }
  })
  .get(
    '/activities',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 5;

        // Get recent task completions with user info
        const recentCompletions = await prisma.taskCompletion.findMany({
          orderBy: { completedAt: 'desc' },
          take: limit,
          include: {
            user: {
              select: {
                firstName: true,
                email: true,
              },
            },
          },
        });

        const activities = recentCompletions.map(completion => ({
          id: completion.id,
          user_id: completion.userId,
          task_type: completion.taskType,
          task_id: completion.taskId,
          completed_at: formatIso(completion.completedAt),
          task_name: completion.taskName,
          emotion: completion.emotion,
          username: completion.user?.firstName || completion.user?.email || 'Unknown',
        }));

        return { activities };
      } catch (error) {
        console.error('Error getting dashboard activities:', error);
        set.status = 500;
        return { error: 'Failed to get dashboard activities' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/jellyfin/latest',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const requestedLimit = query.limit ? parseInt(query.limit, 10) : 12;
        const limit = Math.max(1, Math.min(30, Number.isFinite(requestedLimit) ? requestedLimit : 12));

        const jellyfinPlugin = await prisma.plugin.findFirst({
          where: { type: 'jellyfin' },
          select: { enabled: true, config: true },
        });

        if (!jellyfinPlugin?.enabled) {
          return { enabled: false, items: [] };
        }

        const config = normalizeJellyfinConfig(jellyfinPlugin.config);
        if (!config) {
          return { enabled: false, items: [] };
        }

        const jellyfinUrl = new URL('/Items', config.website_url);
        jellyfinUrl.searchParams.set('Recursive', 'true');
        jellyfinUrl.searchParams.set('SortBy', 'DateCreated');
        jellyfinUrl.searchParams.set('SortOrder', 'Descending');
        jellyfinUrl.searchParams.set('IncludeItemTypes', 'Movie,Series,Episode,MusicAlbum,Audio,Video');
        jellyfinUrl.searchParams.set('Fields', 'DateCreated,Overview,ProductionYear');
        jellyfinUrl.searchParams.set('Limit', String(limit));

        const response = await fetch(jellyfinUrl.toString(), {
          headers: {
            'X-Emby-Token': config.api_key,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          set.status = 502;
          return { error: 'Jellyfin request failed' };
        }

        const data = (await response.json()) as Record<string, unknown>;
        const rawItems = Array.isArray(data.Items) ? data.Items : [];
        const items = rawItems.map(mapJellyfinApiItem).filter((item): item is JellyfinLatestItem => !!item);

        return { enabled: true, items };
      } catch (error) {
        console.error('Error getting latest Jellyfin items:', error);
        set.status = 500;
        return { error: 'Failed to get latest Jellyfin items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  );
