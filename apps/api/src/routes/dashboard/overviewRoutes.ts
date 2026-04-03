import { Elysia, t } from "elysia";
import { auth } from "../../auth";
import { requireUser } from "../../middleware/auth";
import { prisma } from "../../db";
import { formatIso, todayLocal } from "../../utils";
import { getJsonCache, setJsonCache } from "../../services/cache";
import {
  fetchAddressWeather,
  normalizeWeatherAddress,
  WEATHER_CACHE_TTL_SECONDS,
} from "../../utils/dashboard/weather";
import { getCachedHabitsStreak } from "../../utils/dashboard/habitsStreak";
import type { DashboardWeatherResponse } from "../../types/dashboardWeather";
import {
  badGateway,
  notFound,
  serverError,
  unauthorized,
} from "../../utils/errors";

interface WeatherPluginConfig {
  address?: string;
  temperature_unit?: "fahrenheit" | "celsius";
}

type ActivityRecord = {
  id: number;
  user_id?: number;
  task_type?: "chore" | "shopping" | "recipe";
  task_id?: number;
  completed_at?: string;
  task_name?: string;
  emotion?: string | null;
  username?: string;
  type?: string;
  service?: string;
  action?: string;
  reason?: string;
  from_version?: string;
  to_version?: string;
  recipe_id?: number;
  recipe_name?: string;
  event_id?: number;
  event_title?: string;
  shopping_item_id?: number;
  item_name?: string;
  count?: number;
  plugin_type?: string;
  job_id?: string;
  job_name?: string;
  success?: boolean;
  duration_ms?: number;
  message?: string;
  trigger?: string;
};

const ACTIVITY_FEED_SOURCE_LIMIT = 500;

const parseString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;
const parseBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;
const parseNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const parseIntNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

function getTaskCompletionType(taskType: string): string {
  switch (taskType) {
    case "chore":
      return "chore_completed";
    case "shopping":
      return "shopping_completed";
    case "recipe":
      return "recipe_completed";
    case "habit":
      return "habit_completed";
    default:
      return "task_completed";
  }
}

function getTaskCompletionService(taskType: string): string {
  switch (taskType) {
    case "chore":
      return "chores";
    case "shopping":
      return "shopping";
    case "recipe":
      return "recipes";
    case "habit":
      return "habits";
    default:
      return "system";
  }
}

function getLogService(
  type: string,
  payload: Record<string, unknown> | null,
): string {
  if (type === "plugin_updated") {
    return parseString(payload?.plugin_type)?.trim().toLowerCase() || "system";
  }

  if (type === "admin_triggered_job") return "admin";
  if (type.startsWith("recipe_")) return "recipes";
  if (type.startsWith("event_")) return "calendar";
  if (type.startsWith("shopping_")) return "shopping";

  return "system";
}

function mapTaskCompletionToActivity(completion: {
  id: number;
  userId: number;
  taskType: string;
  taskId: number;
  completedAt: Date;
  taskName: string;
  emotion: string | null;
  user?: { firstName: string | null; email: string | null } | null;
}): ActivityRecord {
  return {
    id: completion.id,
    user_id: completion.userId,
    task_type: completion.taskType as "chore" | "shopping" | "recipe",
    task_id: completion.taskId,
    completed_at: formatIso(completion.completedAt) ?? undefined,
    task_name: completion.taskName,
    emotion: completion.emotion,
    username: completion.user?.firstName || completion.user?.email || "Unknown",
    type: getTaskCompletionType(completion.taskType),
    service: getTaskCompletionService(completion.taskType),
  };
}

function mapActivityLogToActivity(log: {
  id: number;
  userId: number | null;
  type: string;
  payload: unknown;
  createdAt: Date;
  user?: { firstName: string | null; email: string | null } | null;
}): ActivityRecord {
  const payload =
    log.payload &&
    typeof log.payload === "object" &&
    !Array.isArray(log.payload)
      ? (log.payload as Record<string, unknown>)
      : null;

  return {
    id: log.id,
    user_id: log.userId ?? undefined,
    completed_at: formatIso(log.createdAt) ?? undefined,
    username: log.user?.firstName || log.user?.email || undefined,
    type: log.type,
    service: getLogService(log.type, payload),
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
}

function sortActivitiesDescending(
  activities: ActivityRecord[],
): ActivityRecord[] {
  return [...activities].sort((a, b) => {
    const at =
      typeof a.completed_at === "string"
        ? new Date(a.completed_at).getTime()
        : 0;
    const bt =
      typeof b.completed_at === "string"
        ? new Date(b.completed_at).getTime()
        : 0;
    return bt - at;
  });
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b));
}

function matchesActivityFilters(
  activity: ActivityRecord,
  filters: { service?: string; type?: string },
): boolean {
  if (filters.service && activity.service !== filters.service) return false;
  if (filters.type && activity.type !== filters.type) return false;
  return true;
}

export const dashboardOverviewRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(auth)
  .use(requireUser)
  .get("/stats", async ({ user, set }) => {
    try {
      const today = todayLocal();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      const eventsTodayCount = await prisma.customEvent.count({
        where: {
          userId: user!.id,
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

      const habitsStreak = await getCachedHabitsStreak(user!.id);

      return {
        stats: {
          events_today: eventsTodayCount,
          shopping_count: shoppingCount,
          chores_count: choresCount,
          habits_streak: habitsStreak,
        },
        activities: [],
      };
    } catch (err) {
      console.error("Error getting dashboard stats:", err);
      return serverError(set, "Failed to get dashboard stats");
    }
  })
  .get(
    "/activities",
    async ({ user, query, set }) => {
      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 10;
        const safeLimit =
          Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10;

        const [recentCompletions, recentLogs] = await Promise.all([
          prisma.taskCompletion.findMany({
            orderBy: { completedAt: "desc" },
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
            orderBy: { createdAt: "desc" },
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

        const merged = sortActivitiesDescending([
          ...recentLogs
            .map(mapActivityLogToActivity)
            .filter((entry) => entry.completed_at),
          ...recentCompletions.map(mapTaskCompletionToActivity),
        ]);

        return { activities: merged.slice(0, safeLimit) };
      } catch (err) {
        console.error("Error getting dashboard activities:", err);
        return serverError(set, "Failed to get dashboard activities");
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/activities/feed",
    async ({ query, set }) => {
      try {
        const limit = query.limit ? parseInt(query.limit, 10) : 25;
        const safeLimit =
          Number.isFinite(limit) && limit > 0 ? Math.min(limit, 250) : 25;
        const filters = {
          service: query.service?.trim().toLowerCase() || undefined,
          type: query.type?.trim() || undefined,
        };

        const [recentCompletions, recentLogs] = await Promise.all([
          prisma.taskCompletion.findMany({
            orderBy: { completedAt: "desc" },
            take: ACTIVITY_FEED_SOURCE_LIMIT,
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
            orderBy: { createdAt: "desc" },
            take: ACTIVITY_FEED_SOURCE_LIMIT,
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

        const allActivities = sortActivitiesDescending([
          ...recentLogs
            .map(mapActivityLogToActivity)
            .filter((entry) => entry.completed_at),
          ...recentCompletions.map(mapTaskCompletionToActivity),
        ]);

        const filteredActivities = allActivities.filter((activity) =>
          matchesActivityFilters(activity, filters),
        );

        return {
          activities: filteredActivities.slice(0, safeLimit),
          available_services: uniqueSorted(
            allActivities.map((activity) => activity.service),
          ),
          available_types: uniqueSorted(
            allActivities.map((activity) => activity.type),
          ),
          total: filteredActivities.length,
          limit: safeLimit,
          has_more: filteredActivities.length > safeLimit,
        };
      } catch (err) {
        console.error("Error getting dashboard activity feed:", err);
        return serverError(set, "Failed to get dashboard activity feed");
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        service: t.Optional(t.String()),
        type: t.Optional(t.String()),
      }),
    },
  )
  .get("/weather", async ({ user, set }) => {
    try {
      const weatherPlugin = await prisma.plugin.findFirst({
        where: { type: "weather" },
      });
      const config =
        (weatherPlugin?.config as WeatherPluginConfig | null) || null;
      const address = (config?.address || "").trim();
      const temperatureUnit =
        config?.temperature_unit === "celsius" ? "celsius" : "fahrenheit";

      if (!address) {
        return notFound(set, "Weather plugin is not configured.");
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
      const message =
        err instanceof Error ? err.message : "Failed to get weather";
      return badGateway(set, message);
    }
  });
