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
  .get('/stats', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
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
  .get('/weather', async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }

    try {
      const weatherPlugin = await prisma.plugin.findFirst({
        where: { type: 'weather' },
      });
      const config = (weatherPlugin?.config as WeatherPluginConfig | null) || null;
      const address = (config?.address || '').trim();
      const temperatureUnit = config?.temperature_unit === 'celsius' ? 'celsius' : 'fahrenheit';

      if (!weatherPlugin?.enabled || !address) {
        set.status = 404;
        return { error: 'Weather plugin is not configured.' };
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get weather';
      set.status = 502;
      return { error: message };
    }
  });
