import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { refreshHabitsStreakForUser } from '../utils/dashboard/habitsStreak';
import { addDaysInTz, formatDateInTimezone, getTimezone, todayLocal } from '../utils/date';

const DONE_STATUS = 'done';
const SKIPPED_STATUS = 'skipped';

const getTodayStatusCounts = (entries: Array<{ status: string }>) => {
  let doneCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    if (entry.status === DONE_STATUS) {
      doneCount++;
    } else if (entry.status === SKIPPED_STATUS) {
      skippedCount++;
    }
  }

  return {
    doneCount,
    skippedCount,
    accountedCount: doneCount + skippedCount,
  };
};

const buildHabitStatusResponse = (timesPerDay: number, doneCount: number, skippedCount: number) => ({
  completions: doneCount,
  skipped: skippedCount,
  remaining: Math.max(timesPerDay - doneCount - skippedCount, 0),
  accounted: Math.min(doneCount + skippedCount, timesPerDay),
});

const getScheduleTimes = (body: { schedules?: string[]; schedule_times?: string[] }) =>
  body.schedules ?? body.schedule_times ?? [];

const getUserId = (user: { id: number } | null | undefined) => {
  if (!user) {
    throw new Error('Unauthorized');
  }

  return user.id;
};

const getTodayDateKey = (date: Date) => formatDateInTimezone(date);

const toMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const getScheduleStatuses = (
  schedules: { id: number; time: string }[],
  completions: { completedAt: Date; status: string }[],
  tz: string
): { time: string; status: 'done' | 'skipped' | 'pending' }[] => {
  const sorted = [...schedules].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return [];

  const schedMins = sorted.map(s => toMinutes(s.time));

  // Compute midpoint boundaries between consecutive schedules
  const boundaries: number[] = [0];
  for (let i = 1; i < schedMins.length; i++) {
    boundaries.push(Math.floor((schedMins[i - 1] + schedMins[i]) / 2));
  }

  const statuses = sorted.map(s => ({ time: s.time, status: 'pending' as const }));

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric',
  });

  for (const c of completions) {
    const parts = timeFormatter.formatToParts(c.completedAt);
    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const m = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const cMin = h * 60 + m;

    // Find which time window this completion falls into
    let slotIdx = schedMins.length - 1;
    for (let i = 1; i < boundaries.length; i++) {
      if (cMin < boundaries[i]) {
        slotIdx = i - 1;
        break;
      }
    }

    if (statuses[slotIdx].status === 'pending') {
      statuses[slotIdx] = {
        time: sorted[slotIdx].time,
        status: c.status === DONE_STATUS ? 'done' : 'skipped',
      };
    }
  }

  return statuses;
};

const getDayRange = (date = todayLocal()) => {
  const start = new Date(date.getTime());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

export const habitsRoutes = new Elysia()
  .use(auth)
  .group('/api/habits', (app) =>
    app
      .onBeforeHandle(({ user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
      })
      .post(
        '/live-activity/register',
        async ({ body, user }) => {
          const userId = getUserId(user);

          await prisma.liveActivityToken.upsert({
            where: { token: body.token },
            update: {
              userId,
              platform: body.platform || 'ios',
              updatedAt: new Date(),
            },
            create: {
              userId,
              token: body.token,
              platform: body.platform || 'ios',
            },
          });

          console.log(`[LiveActivity] Registered push-to-start token for user ${userId}`);
          return { success: true };
        },
        {
          body: t.Object({
            token: t.String({ minLength: 1 }),
            platform: t.Optional(t.String()),
          }),
        }
      )
      .get('/', async ({ user }) => {
        const userId = getUserId(user);
        const { start: startOfToday, end: startOfTomorrow } = getDayRange();

        const habits = await prisma.habit.findMany({
          where: {
            userId,
            active: true,
          },
          include: {
            schedules: {
              select: {
                id: true,
                time: true,
              },
            },
            completions: {
              where: {
                completedAt: {
                  gte: startOfToday,
                  lt: startOfTomorrow,
                },
              },
            },
          },
        });

        const habitsWithStats = await Promise.all(
          habits.map(async (habit) => {
            const {
              doneCount: todayCompletions,
              skippedCount: todaySkips,
              accountedCount: todayAccounted,
            } = getTodayStatusCounts(habit.completions);

            const allCompletions = await prisma.habitCompletion.findMany({
              where: {
                habitId: habit.id,
                status: DONE_STATUS,
                completedAt: {
                  lt: startOfTomorrow,
                },
              },
              select: {
                completedAt: true,
              },
              orderBy: {
                completedAt: 'desc',
              },
            });

            const completionsByDay = new Map<string, number>();

            for (const completion of allCompletions) {
              const dateKey = getTodayDateKey(completion.completedAt);
              completionsByDay.set(dateKey, (completionsByDay.get(dateKey) ?? 0) + 1);
            }

            let currentStreak = 0;
            let checkDate = addDaysInTz(startOfToday, -1);

            while ((completionsByDay.get(getTodayDateKey(checkDate)) ?? 0) >= habit.timesPerDay) {
              currentStreak++;
              checkDate = addDaysInTz(checkDate, -1);
            }

            if (todayCompletions >= habit.timesPerDay) {
              currentStreak++;
            }

            return {
              id: habit.id,
              user_id: habit.userId,
              name: habit.name,
              emoji: habit.emoji,
              description: habit.description,
              times_per_day: habit.timesPerDay,
              active: habit.active,
              created_at: habit.createdAt.toISOString(),
              updated_at: habit.updatedAt?.toISOString() || null,
              schedules: habit.schedules,
              today_completions: todayCompletions,
              today_skips: todaySkips,
              today_remaining: Math.max(habit.timesPerDay - todayAccounted, 0),
              current_streak: currentStreak,
              schedule_statuses: getScheduleStatuses(habit.schedules, habit.completions, getTimezone()),
            };
          })
        );

        return { habits: habitsWithStats };
      })
      .post(
        '/',
        async ({ body, user, set }) => {
          const userId = getUserId(user);
          const schedules = getScheduleTimes(body);

          if (schedules.length === 0) {
            set.status = 422;
            return { error: 'At least one schedule is required' };
          }

          const habit = await prisma.$transaction(async (tx) => {
            const newHabit = await tx.habit.create({
              data: {
                userId,
                name: body.name,
                emoji: body.emoji,
                description: body.description,
                timesPerDay: schedules.length,
              },
            });

            if (schedules.length > 0) {
              await tx.habitSchedule.createMany({
                data: schedules.map((time) => ({
                  habitId: newHabit.id,
                  time,
                })),
              });
            }

            return tx.habit.findUnique({
              where: { id: newHabit.id },
              include: { schedules: true },
            });
          });

          return habit;
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 100 }),
            emoji: t.String({ minLength: 1 }),
            description: t.Optional(t.Nullable(t.String())),
            times_per_day: t.Optional(t.Number({ minimum: 1 })),
            schedules: t.Optional(t.Array(t.String())),
            schedule_times: t.Optional(t.Array(t.String())),
          }),
        }
      )
      .put(
        '/:id',
        async ({ params: { id }, body, user, set }) => {
          const userId = getUserId(user);
          const scheduleTimes = getScheduleTimes(body);

          const existingHabit = await prisma.habit.findFirst({
            where: { id: Number(id), userId },
          });

          if (!existingHabit) {
            set.status = 404;
            return { error: 'Habit not found' };
          }

          if ((body.schedules || body.schedule_times) && scheduleTimes.length === 0) {
            set.status = 422;
            return { error: 'At least one schedule is required' };
          }

          const updatedHabit = await prisma.$transaction(async (tx) => {
            if (body.schedules || body.schedule_times) {
              await tx.habitSchedule.deleteMany({
                where: { habitId: Number(id) },
              });
              await tx.habitSchedule.createMany({
                data: scheduleTimes.map((time) => ({
                  habitId: Number(id),
                  time,
                })),
              });
            }

            return tx.habit.update({
              where: { id: Number(id) },
              data: {
                name: body.name,
                emoji: body.emoji,
                description: body.description,
                timesPerDay:
                  body.schedules || body.schedule_times
                    ? scheduleTimes.length
                    : body.times_per_day,
                active: body.active,
                updatedAt: new Date(),
              },
              include: { schedules: true },
            });
          });

          return updatedHabit;
        },
        {
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
            emoji: t.Optional(t.String({ minLength: 1 })),
            description: t.Optional(t.Nullable(t.String())),
            times_per_day: t.Optional(t.Number({ minimum: 1 })),
            active: t.Optional(t.Boolean()),
            schedules: t.Optional(t.Array(t.String())),
            schedule_times: t.Optional(t.Array(t.String())),
          }),
        }
      )
      .delete('/:id', async ({ params: { id }, user, set }) => {
        const userId = getUserId(user);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: Number(id), userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        await prisma.habit.delete({
          where: { id: Number(id) },
        });

        return { success: true };
      })
      .post('/:id/complete', async ({ params: { id }, user, set }) => {
        const userId = getUserId(user);
        const habitIdNum = Number(id);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: habitIdNum, userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        const { start: startOfToday, end: startOfTomorrow } = getDayRange();

        const todayCompletions = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: DONE_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        const todaySkipped = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: SKIPPED_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        if (todayCompletions + todaySkipped >= existingHabit.timesPerDay) {
          return buildHabitStatusResponse(existingHabit.timesPerDay, todayCompletions, todaySkipped);
        }

        await prisma.$transaction(async (tx) => {
          await tx.habitCompletion.create({
            data: {
              habitId: habitIdNum,
              date: startOfToday,
              completedAt: new Date(),
              status: DONE_STATUS,
            },
          });

          if (todayCompletions + todaySkipped + 1 >= existingHabit.timesPerDay) {
            await tx.habitSchedule.updateMany({
              where: { habitId: habitIdNum },
              data: { lastNotificationSent: null },
            });
          }
        });

        refreshHabitsStreakForUser(userId).catch(() => {});
        return buildHabitStatusResponse(existingHabit.timesPerDay, todayCompletions + 1, todaySkipped);
      })
      .delete('/:id/complete', async ({ params: { id }, user, set }) => {
        const userId = getUserId(user);
        const habitIdNum = Number(id);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: habitIdNum, userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        const { start: startOfToday, end: startOfTomorrow } = getDayRange();

        const lastCompletion = await prisma.habitCompletion.findFirst({
          where: {
            habitId: habitIdNum,
            status: DONE_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
        });

        const skippedCount = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: SKIPPED_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        if (!lastCompletion) {
          const count = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: DONE_STATUS,
              completedAt: {
                gte: startOfToday,
                lt: startOfTomorrow,
              },
            },
          });
          return buildHabitStatusResponse(existingHabit.timesPerDay, count, skippedCount);
        }

        await prisma.habitCompletion.delete({
          where: { id: lastCompletion.id },
        });

        const newCount = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: DONE_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        refreshHabitsStreakForUser(userId).catch(() => {});
        return buildHabitStatusResponse(existingHabit.timesPerDay, newCount, skippedCount);
      })
      .post('/:id/skip', async ({ params: { id }, user, set }) => {
        const userId = getUserId(user);
        const habitIdNum = Number(id);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: habitIdNum, userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        const { start: startOfToday, end: startOfTomorrow } = getDayRange();

        const todayCompletions = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: DONE_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        const todaySkipped = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: SKIPPED_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        if (todayCompletions + todaySkipped >= existingHabit.timesPerDay) {
          return buildHabitStatusResponse(existingHabit.timesPerDay, todayCompletions, todaySkipped);
        }

        await prisma.$transaction(async (tx) => {
          await tx.habitCompletion.create({
            data: {
              habitId: habitIdNum,
              date: startOfToday,
              completedAt: new Date(),
              status: SKIPPED_STATUS,
            },
          });

          if (todayCompletions + todaySkipped + 1 >= existingHabit.timesPerDay) {
            await tx.habitSchedule.updateMany({
              where: { habitId: habitIdNum },
              data: { lastNotificationSent: null },
            });
          }
        });

        refreshHabitsStreakForUser(userId).catch(() => {});
        return buildHabitStatusResponse(existingHabit.timesPerDay, todayCompletions, todaySkipped + 1);
      })
      .delete('/:id/skip', async ({ params: { id }, user, set }) => {
        const userId = getUserId(user);
        const habitIdNum = Number(id);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: habitIdNum, userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        const { start: startOfToday, end: startOfTomorrow } = getDayRange();

        const lastSkipped = await prisma.habitCompletion.findFirst({
          where: {
            habitId: habitIdNum,
            status: SKIPPED_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
        });

        const completionCount = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: DONE_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        if (!lastSkipped) {
          const skippedCount = await prisma.habitCompletion.count({
            where: {
              habitId: habitIdNum,
              status: SKIPPED_STATUS,
              completedAt: {
                gte: startOfToday,
                lt: startOfTomorrow,
              },
            },
          });
          return buildHabitStatusResponse(existingHabit.timesPerDay, completionCount, skippedCount);
        }

        await prisma.habitCompletion.delete({
          where: { id: lastSkipped.id },
        });

        const newSkippedCount = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            status: SKIPPED_STATUS,
            completedAt: {
              gte: startOfToday,
              lt: startOfTomorrow,
            },
          },
        });

        refreshHabitsStreakForUser(userId).catch(() => {});
        return buildHabitStatusResponse(existingHabit.timesPerDay, completionCount, newSkippedCount);
      })
      .get(
        '/:id/history',
        async ({ params: { id }, query: { days }, user, set }) => {
          const userId = getUserId(user);
          const habitIdNum = Number(id);
          const historyDays = days ? Number(days) : 30;

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            set.status = 404;
            return { error: 'Habit not found' };
          }

          const { end: startOfTomorrow } = getDayRange();
          const startDate = addDaysInTz(todayLocal(), -(historyDays - 1));

          const completions = await prisma.habitCompletion.findMany({
            where: {
              habitId: habitIdNum,
              completedAt: {
                gte: startDate,
                lt: startOfTomorrow,
              },
            },
            select: {
              status: true,
              completedAt: true,
            },
            orderBy: {
              completedAt: 'desc',
            },
          });

          const historyMap = new Map<string, { completions: number; skipped: number }>();
          for (const c of completions) {
            const dateKey = getTodayDateKey(c.completedAt);
            const current = historyMap.get(dateKey) || { completions: 0, skipped: 0 };

            if (c.status === DONE_STATUS) {
              current.completions += 1;
            } else if (c.status === SKIPPED_STATUS) {
              current.skipped += 1;
            }

            historyMap.set(dateKey, current);
          }

          const history = [];
          const today = todayLocal();
          for (let i = 0; i < historyDays; i++) {
            const date = addDaysInTz(today, -i);
            const dateStr = getTodayDateKey(date);
            const counts = historyMap.get(dateStr) || { completions: 0, skipped: 0 };

            history.push({
              date: dateStr,
              completions: counts.completions,
              skipped: counts.skipped,
              target: existingHabit.timesPerDay,
              accounted: Math.min(counts.completions + counts.skipped, existingHabit.timesPerDay),
              completed: counts.completions >= existingHabit.timesPerDay,
            });
          }

          return { history };
        }
      )
  );
