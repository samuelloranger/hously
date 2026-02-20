import { Elysia, t } from 'elysia';
import { auth } from '../../auth';
import { prisma } from '../../db';
import { formatIso } from '../../utils';
import { getJsonCache, setJsonCache } from '../../services/cache';
import { fetchAddressWeather, normalizeWeatherAddress, WEATHER_CACHE_TTL_SECONDS } from '../../utils/dashboard/weather';
import type { DashboardWeatherResponse } from '../../types/dashboardWeather';

interface WeatherPluginConfig {
  address?: string;
  temperature_unit?: 'fahrenheit' | 'celsius';
}

export const dashboardOverviewRoutes = new Elysia()
  .use(auth)
  .get('/stats', async ({ user, error }) => {
    if (!user) {
      return error(401, 'Unauthorized');
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const eventsTodayCount = await prisma.customEvent.count({
        where: {
          userId: user.id,
          startDatetime: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      const shoppingCount = await prisma.shoppingItem.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
          deletedAt: null,
        },
      });

      const choresCount = await prisma.chore.count({
        where: {
          OR: [{ completed: false }, { completed: null }],
        },
      });

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
    } catch (err) {
      console.error('Error getting dashboard stats:', err);
      return error(500, 'Failed to get dashboard stats');
    }
  })
  .get(
    '/activities',
    async ({ user, query, error }) => {
      if (!user) {
        return error(401, 'Unauthorized');
      }

      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 5;
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 5;

        const [recentCompletions, recentLogs] = await Promise.all([
          prisma.taskCompletion.findMany({
            orderBy: { completedAt: 'desc' },
            take: safeLimit,
            include: {
              user: {
                select: {
                  firstName: true,
                  email: true,
                },
              },
            },
          }),
          prisma.activityLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: safeLimit,
            include: {
              user: {
                select: {
                  firstName: true,
                  email: true,
                },
              },
            },
          }),
        ]);

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

        const logActivities = recentLogs
          .map(log => {
            const payload =
              log.payload && typeof log.payload === 'object' && !Array.isArray(log.payload)
                ? (log.payload as Record<string, unknown>)
                : null;

            const parseString = (value: unknown): string | undefined =>
              typeof value === 'string' && value.trim() ? value : undefined;
            const parseBoolean = (value: unknown): boolean | undefined =>
              typeof value === 'boolean' ? value : undefined;
            const parseNumber = (value: unknown): number | undefined =>
              typeof value === 'number' && Number.isFinite(value) ? value : undefined;
            const parseIntNumber = (value: unknown): number | undefined => {
              if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
              if (typeof value === 'string' && value.trim()) {
                const parsed = parseInt(value, 10);
                return Number.isFinite(parsed) ? parsed : undefined;
              }
              return undefined;
            };

            return {
              id: log.id,
              user_id: log.userId ?? undefined,
              completed_at: formatIso(log.createdAt),
              username: log.user?.firstName || log.user?.email || undefined,
              type: log.type,
              action: parseString(payload?.action),
              reason: parseString(payload?.reason),
              from_version: parseString(payload?.from_version),
              to_version: parseString(payload?.to_version),
              recipe_id: parseIntNumber(payload?.recipe_id),
              recipe_name: parseString(payload?.recipe_name),
              event_id: parseIntNumber(payload?.event_id),
              event_title: parseString(payload?.event_title),
              shopping_item_id: parseIntNumber(payload?.shopping_item_id),
              item_name: parseString(payload?.item_name),
              count: parseNumber(payload?.count),
              plugin_type: parseString(payload?.plugin_type),
              job_id: parseString(payload?.job_id),
              job_name: parseString(payload?.job_name),
              success: parseBoolean(payload?.success),
              duration_ms: parseNumber(payload?.duration_ms),
              message: parseString(payload?.message),
              trigger: parseString(payload?.trigger),
            };
          })
          .filter(entry => entry.completed_at);

        const merged = [...logActivities, ...activities].sort((a, b) => {
          const at = typeof a.completed_at === 'string' ? new Date(a.completed_at).getTime() : 0;
          const bt = typeof b.completed_at === 'string' ? new Date(b.completed_at).getTime() : 0;
          return bt - at;
        });

        return { activities: merged.slice(0, safeLimit) };
      } catch (err) {
        console.error('Error getting dashboard activities:', err);
        return error(500, 'Failed to get dashboard activities');
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  )
  .get('/weather', async ({ user, error }) => {
    if (!user) {
      return error(401, 'Unauthorized');
    }

    try {
      const weatherPlugin = await prisma.plugin.findFirst({
        where: { type: 'weather' },
      });
      const config = (weatherPlugin?.config as WeatherPluginConfig | null) || null;
      const address = (config?.address || '').trim();
      const temperatureUnit = config?.temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit';

      if (!weatherPlugin?.enabled || !address) {
        return error(404, 'Weather plugin is not configured.');
      }

      const normalizedAddress = normalizeWeatherAddress(address);
      const cacheKey = `dashboard:weather:v3:${normalizedAddress}:${temperatureUnit}`;
      const cached = await getJsonCache<DashboardWeatherResponse>(cacheKey);
      if (cached) {
        return cached;
      }

      const weather = await fetchAddressWeather(address, temperatureUnit);
      await setJsonCache(cacheKey, weather, WEATHER_CACHE_TTL_SECONDS);
      return weather;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get weather';
      return error(502, message);
    }
  });
