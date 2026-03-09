import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { requireUser } from '../middleware/auth';
import { todayLocal, addDaysInTz, formatDateInTimezone, utcToTimezone, calculatePeriodDates } from '../utils';
import { badRequest, serverError, unauthorized } from '../utils/errors';

// Day names in different locales
const dayNames: Record<string, Record<string, string>> = {
  en: {
    Monday: 'Monday',
    Tuesday: 'Tuesday',
    Wednesday: 'Wednesday',
    Thursday: 'Thursday',
    Friday: 'Friday',
    Saturday: 'Saturday',
    Sunday: 'Sunday',
  },
  fr: {
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
    Saturday: 'Samedi',
    Sunday: 'Dimanche',
  },
};

export const analyticsRoutes = new Elysia({ prefix: '/api/analytics' })
  .use(auth)
  .use(requireUser)
  // GET /api/analytics/weekly-summary - Get weekly task completion summary
  .get(
    '/weekly-summary',
    async ({ user, query, set }) => {
      try {
        const locale = query.locale || 'en';
        const todayTz = todayLocal();

        // Calculate start of week (Monday) using timezone-safe day navigation
        const dateStr = formatDateInTimezone(todayTz);
        const [y, m, d] = dateStr.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
        const mondayOffset = dow === 0 ? -6 : 1 - dow;
        const startOfWeekTz = addDaysInTz(todayTz, mondayOffset);

        // Get weekly completions
        const weeklyCompletions = await prisma.taskCompletion.findMany({
          where: {
            userId: user!.id,
            completedAt: { gte: startOfWeekTz.toISOString() },
          },
        });

        // Group by day and emotion
        const dailyStats: Record<string, number> = {};
        const emotionCounts: Record<string, number> = {
          '🥵': 0,
          '😢': 0,
          '😐': 0,
          '😄': 0,
          '🔥': 0,
        };

        for (const completion of weeklyCompletions) {
          const day = formatDateInTimezone(completion.completedAt);

          if (!dailyStats[day]) {
            dailyStats[day] = 0;
          }
          dailyStats[day]++;

          if (completion.emotion && completion.taskType === 'chore') {
            emotionCounts[completion.emotion] = (emotionCounts[completion.emotion] || 0) + 1;
          }
        }

        const totalTasks = weeklyCompletions.length;
        const daysPassed = Math.floor((todayTz.getTime() - startOfWeekTz.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const avgPerDay = daysPassed > 0 ? Math.round((totalTasks / daysPassed) * 10) / 10 : 0;

        // Pre-calculate percentages for emotion breakdown
        const choreCompletionsCount = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
        const emotionBreakdown: Record<string, { count: number; percentage: number; bar_width: number }> = {};

        for (const [emotion, count] of Object.entries(emotionCounts)) {
          const percentage = choreCompletionsCount > 0 ? Math.round((count / choreCompletionsCount) * 1000) / 10 : 0;
          emotionBreakdown[emotion] = {
            count,
            percentage,
            bar_width: Math.min(percentage, 100),
          };
        }

        // Sort emotion breakdown by count
        const sortedEmotionBreakdown = Object.fromEntries(
          Object.entries(emotionBreakdown).sort(([, a], [, b]) => b.count - a.count)
        );

        // Pre-calculate display values for daily breakdown
        const maxDailyTasks = Math.max(...Object.values(dailyStats), 0);
        const dailyBreakdown: Record<string, { count: number; bar_width: number; day_name: string }> = {};

        for (const [date, count] of Object.entries(dailyStats)) {
          const barWidth = maxDailyTasks > 0 ? (count / maxDailyTasks) * 100 : 0;
          const dateObj = new Date(date);
          const englishDayName = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
          });
          const dayName = dayNames[locale]?.[englishDayName] || englishDayName;

          dailyBreakdown[date] = {
            count,
            bar_width: Math.min(barWidth, 100),
            day_name: dayName,
          };
        }

        // Sort daily breakdown by date
        const sortedDailyBreakdown = Object.fromEntries(
          Object.entries(dailyBreakdown).sort(([a], [b]) => a.localeCompare(b))
        );

        // Find most common emotion
        const mostCommonEmotion =
          Object.entries(emotionCounts)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

        // Calculate previous week comparison
        const startOfPreviousWeekTz = addDaysInTz(startOfWeekTz, -7);
        const endOfPreviousWeekTz = new Date(startOfWeekTz.getTime() - 1);

        const previousWeekCompletions = await prisma.taskCompletion.findMany({
          where: {
            userId: user!.id,
            completedAt: {
              gte: startOfPreviousWeekTz.toISOString(),
              lte: endOfPreviousWeekTz.toISOString(),
            },
          },
        });

        const previousWeekTotal = previousWeekCompletions.length;
        const previousAvgPerDay = Math.round((previousWeekTotal / 7) * 10) / 10;

        let changePercentage = 0;
        let trend = 'stable';
        if (previousWeekTotal > 0) {
          changePercentage = Math.round(((totalTasks - previousWeekTotal) / previousWeekTotal) * 1000) / 10;
        } else if (totalTasks > 0) {
          changePercentage = 100.0;
        }

        if (changePercentage > 0) {
          trend = 'up';
        } else if (changePercentage < 0) {
          trend = 'down';
        }

        return {
          total_tasks_this_week: totalTasks,
          average_per_day: avgPerDay,
          daily_breakdown: sortedDailyBreakdown,
          emotion_breakdown: sortedEmotionBreakdown,
          week_start: startOfWeekTz.toISOString(),
          most_common_emotion: mostCommonEmotion,
          comparison: {
            previous_week_total: previousWeekTotal,
            previous_week_avg_per_day: previousAvgPerDay,
            change_percentage: changePercentage,
            trend,
          },
        };
      } catch (error) {
        console.error('Error getting weekly summary:', error);
        return serverError(set, 'Failed to get weekly summary');
      }
    },
    {
      query: t.Object({
        locale: t.Optional(t.String()),
      }),
    }
  )

  // GET /api/analytics/summary - Get analytics summary for a given period
  .get(
    '/summary',
    async ({ user, query, set }) => {
      try {
        const locale = query.locale || 'en';
        const period = query.period || 'week';

        if (!['week', 'month', 'quarter', 'year'].includes(period)) {
          return badRequest(set, 'Invalid period. Must be: week, month, quarter, or year');
        }

        const { start: startOfPeriod, end: endOfPeriod } = calculatePeriodDates(period, query.start_date);

        // Get completions for the period
        const completions = await prisma.taskCompletion.findMany({
          where: {
            userId: user!.id,
            completedAt: {
              gte: startOfPeriod.toISOString(),
              lte: endOfPeriod.toISOString(),
            },
          },
        });

        // Group by day and emotion
        const dailyStats: Record<string, number> = {};
        const emotionCounts: Record<string, number> = {
          '🥵': 0,
          '😢': 0,
          '😐': 0,
          '😄': 0,
          '🔥': 0,
        };

        for (const completion of completions) {
          const day = formatDateInTimezone(completion.completedAt);

          if (!dailyStats[day]) {
            dailyStats[day] = 0;
          }
          dailyStats[day]++;

          if (completion.emotion && completion.taskType === 'chore') {
            emotionCounts[completion.emotion] = (emotionCounts[completion.emotion] || 0) + 1;
          }
        }

        const totalTasks = completions.length;
        const daysInPeriod = Math.floor((endOfPeriod.getTime() - startOfPeriod.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const avgPerDay = daysInPeriod > 0 ? Math.round((totalTasks / daysInPeriod) * 10) / 10 : 0;

        // Pre-calculate percentages for emotion breakdown
        const choreCompletionsCount = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
        const emotionBreakdown: Record<string, { count: number; percentage: number; bar_width: number }> = {};

        for (const [emotion, count] of Object.entries(emotionCounts)) {
          const percentage = choreCompletionsCount > 0 ? Math.round((count / choreCompletionsCount) * 1000) / 10 : 0;
          emotionBreakdown[emotion] = {
            count,
            percentage,
            bar_width: Math.min(percentage, 100),
          };
        }

        const sortedEmotionBreakdown = Object.fromEntries(
          Object.entries(emotionBreakdown).sort(([, a], [, b]) => b.count - a.count)
        );

        // Daily breakdown
        const maxDailyTasks = Math.max(...Object.values(dailyStats), 0);
        const dailyBreakdown: Record<string, { count: number; bar_width: number; day_name: string }> = {};

        for (const [date, count] of Object.entries(dailyStats)) {
          const barWidth = maxDailyTasks > 0 ? (count / maxDailyTasks) * 100 : 0;
          const dateObj = new Date(date);
          const englishDayName = dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
          });
          const dayName = dayNames[locale]?.[englishDayName] || englishDayName;

          dailyBreakdown[date] = {
            count,
            bar_width: Math.min(barWidth, 100),
            day_name: dayName,
          };
        }

        const sortedDailyBreakdown = Object.fromEntries(
          Object.entries(dailyBreakdown).sort(([a], [b]) => a.localeCompare(b))
        );

        const mostCommonEmotion =
          Object.entries(emotionCounts)
            .filter(([, count]) => count > 0)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

        return {
          period,
          start_date: startOfPeriod.toISOString(),
          end_date: endOfPeriod.toISOString(),
          total_tasks: totalTasks,
          average_per_day: avgPerDay,
          daily_breakdown: sortedDailyBreakdown,
          emotion_breakdown: sortedEmotionBreakdown,
          most_common_emotion: mostCommonEmotion,
        };
      } catch (error) {
        console.error('Error getting summary:', error);
        return serverError(set, 'Failed to get summary');
      }
    },
    {
      query: t.Object({
        locale: t.Optional(t.String()),
        period: t.Optional(t.String()),
        start_date: t.Optional(t.String()),
      }),
    }
  )

  // GET /api/analytics/personal-insights - Get personal insights
  .get('/personal-insights', async ({ user, set }) => {
    try {
      const dayNamesArr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Get all completions for this user
      const allCompletions = await prisma.taskCompletion.findMany({
        where: { userId: user!.id },
      });

      // Group by day of week
      const dayStats: Record<number, number> = {};
      for (const completion of allCompletions) {
        if (completion.completedAt) {
          const tzDate = utcToTimezone(completion.completedAt);
          if (tzDate) {
            const dayOfWeek = tzDate.getDay();
            dayStats[dayOfWeek] = (dayStats[dayOfWeek] || 0) + 1;
          }
        }
      }

      // Find most productive day
      let mostProductiveDay: string | null = null;
      let maxTasks = 0;
      for (const [day, count] of Object.entries(dayStats)) {
        if (count > maxTasks) {
          maxTasks = count;
          mostProductiveDay = dayNamesArr[parseInt(day)];
        }
      }

      // Find most common emotion (only for chores)
      const emotionStats: Record<string, number> = {};
      for (const completion of allCompletions) {
        if (completion.taskType === 'chore' && completion.emotion) {
          emotionStats[completion.emotion] = (emotionStats[completion.emotion] || 0) + 1;
        }
      }

      let mostCommonEmotion: string | null = null;
      let maxEmotions = 0;
      for (const [emotion, count] of Object.entries(emotionStats)) {
        if (count > maxEmotions) {
          maxEmotions = count;
          mostCommonEmotion = emotion;
        }
      }

      return {
        most_productive_day: mostProductiveDay,
        most_common_emotion: mostCommonEmotion,
        total_tasks_all_time: allCompletions.length,
      };
    } catch (error) {
      console.error('Error getting personal insights:', error);
      return serverError(set, 'Failed to get personal insights');
    }
  })

  // GET /api/analytics/shopping - Get shopping analytics
  .get('/shopping', async ({ user, set }) => {
    try {
      // Get all shopping items for the user
      const allItems = await prisma.shoppingItem.findMany({
        where: { addedBy: user!.id },
      });

      const totalItems = allItems.length;

      // Count completed items
      const completedItems = allItems.filter(item => item.completed && item.completedAt);
      const completedCount = completedItems.length;

      // Calculate completion rate
      const completionRate = totalItems > 0 ? Math.round((completedCount / totalItems) * 1000) / 10 : 0;

      // Calculate average time to completion (in hours)
      const completionTimes: number[] = [];
      for (const item of completedItems) {
        if (item.createdAt && item.completedAt) {
          const created = new Date(item.createdAt);
          const completed = new Date(item.completedAt);
          const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
          completionTimes.push(hours);
        }
      }

      const avgCompletionTime =
        completionTimes.length > 0
          ? Math.round((completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length) * 10) / 10
          : null;

      // Items completed this week
      const todayTz = todayLocal();
      const shoppingDateStr = formatDateInTimezone(todayTz);
      const [sy, sm, sd] = shoppingDateStr.split('-').map(Number);
      const shoppingDow = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0)).getUTCDay();
      const shoppingMondayOffset = shoppingDow === 0 ? -6 : 1 - shoppingDow;
      const startOfWeekTz = addDaysInTz(todayTz, shoppingMondayOffset);

      const weeklyCompleted = completedItems.filter(item => {
        if (!item.completedAt) return false;
        return new Date(item.completedAt) >= startOfWeekTz;
      }).length;

      return {
        total_items: totalItems,
        completed_count: completedCount,
        completion_rate: completionRate,
        avg_completion_time_hours: avgCompletionTime,
        weekly_completed: weeklyCompleted,
      };
    } catch (error) {
      console.error('Error getting shopping analytics:', error);
      return serverError(set, 'Failed to get shopping analytics');
    }
  })

  // GET /api/analytics/productivity - Get productivity metrics
  .get('/productivity', async ({ user, set }) => {
    try {
      // Get all completions for this user
      const allCompletions = await prisma.taskCompletion.findMany({
        where: { userId: user!.id },
      });

      if (allCompletions.length === 0) {
        return {
          current_streak: 0,
          best_streak: 0,
          completion_rate_by_type: {},
          most_productive_hour: null,
        };
      }

      // Get unique dates with completions
      const completionDates = new Set<string>();
      for (const completion of allCompletions) {
        if (completion.completedAt) {
          const tzDate = utcToTimezone(completion.completedAt);
          if (tzDate) {
            completionDates.add(formatDateInTimezone(tzDate));
          }
        }
      }

      // Calculate current streak
      const todayTz = todayLocal();
      let currentStreak = 0;
      let checkDate = new Date(todayTz);

      while (completionDates.has(formatDateInTimezone(checkDate))) {
        currentStreak++;
        checkDate = addDaysInTz(checkDate, -1);
      }

      // Calculate best streak
      const sortedDates = Array.from(completionDates).sort();
      let bestStreak = 1;
      let currentRun = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentRun++;
          bestStreak = Math.max(bestStreak, currentRun);
        } else {
          currentRun = 1;
        }
      }

      // Calculate completion rate by task type
      const typeCounts: Record<string, number> = {};
      for (const completion of allCompletions) {
        typeCounts[completion.taskType] = (typeCounts[completion.taskType] || 0) + 1;
      }

      const totalCompletions = allCompletions.length;
      const completionRateByType: Record<string, number> = {};
      for (const [taskType, count] of Object.entries(typeCounts)) {
        completionRateByType[taskType] = Math.round((count / totalCompletions) * 1000) / 10;
      }

      // Find most productive hour
      const hourCounts: Record<number, number> = {};
      for (const completion of allCompletions) {
        if (completion.completedAt) {
          const tzDate = utcToTimezone(completion.completedAt);
          if (tzDate) {
            const hour = tzDate.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }
        }
      }

      let mostProductiveHour: number | null = null;
      let maxHourCount = 0;
      for (const [hour, count] of Object.entries(hourCounts)) {
        if (count > maxHourCount) {
          maxHourCount = count;
          mostProductiveHour = parseInt(hour);
        }
      }

      return {
        current_streak: currentStreak,
        best_streak: bestStreak,
        completion_rate_by_type: completionRateByType,
        most_productive_hour: mostProductiveHour,
      };
    } catch (error) {
      console.error('Error getting productivity metrics:', error);
      return serverError(set, 'Failed to get productivity metrics');
    }
  });
