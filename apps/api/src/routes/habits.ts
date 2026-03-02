import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import type { User } from '@prisma/client';

export const habitsRoutes = new Elysia()
  .use(auth)
  .group('/api/habits', (app) =>
    app
      .post(
        '/live-activity/register',
        async ({ body, user }) => {
          const userId = (user as User).id;

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
        const userId = (user as User).id;
        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

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
                date: {
                  gte: startOfToday,
                },
              },
            },
          },
        });

        const habitsWithStats = await Promise.all(
          habits.map(async (habit) => {
            const todayCompletions = habit.completions.length;

            const allCompletions = await prisma.habitCompletion.groupBy({
              by: ['date'],
              where: {
                habitId: habit.id,
                date: {
                  lt: startOfToday,
                },
              },
              _count: {
                id: true,
              },
              orderBy: {
                date: 'desc',
              },
            });

            let currentStreak = 0;
            let checkDate = new Date(startOfToday);
            checkDate.setUTCDate(checkDate.getUTCDate() - 1);

            for (const completion of allCompletions) {
              const completionDate = new Date(completion.date);
              if (completionDate.getTime() === checkDate.getTime()) {
                if (completion._count.id >= habit.timesPerDay) {
                  currentStreak++;
                  checkDate.setUTCDate(checkDate.getUTCDate() - 1);
                } else {
                  break;
                }
              } else if (completionDate.getTime() < checkDate.getTime()) {
                break;
              }
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
              current_streak: currentStreak,
            };
          })
        );

        return { habits: habitsWithStats };
      })
      .post(
        '/',
        async ({ body, user }) => {
          const userId = (user as User).id;

          const habit = await prisma.$transaction(async (tx) => {
            const newHabit = await tx.habit.create({
              data: {
                userId,
                name: body.name,
                emoji: body.emoji,
                description: body.description,
                timesPerDay: body.times_per_day,
              },
            });

            if (body.schedules.length > 0) {
              await tx.habitSchedule.createMany({
                data: body.schedules.map((time) => ({
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
            description: t.Optional(t.String()),
            times_per_day: t.Number({ minimum: 1 }),
            schedules: t.Array(t.String()),
          }),
        }
      )
      .put(
        '/:id',
        async ({ params: { id }, body, user, set }) => {
          const userId = (user as User).id;

          const existingHabit = await prisma.habit.findFirst({
            where: { id: Number(id), userId },
          });

          if (!existingHabit) {
            set.status = 404;
            return { error: 'Habit not found' };
          }

          const updatedHabit = await prisma.$transaction(async (tx) => {
            if (body.schedules) {
              await tx.habitSchedule.deleteMany({
                where: { habitId: Number(id) },
              });
              await tx.habitSchedule.createMany({
                data: body.schedules.map((time) => ({
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
                timesPerDay: body.times_per_day,
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
            description: t.Optional(t.String()),
            times_per_day: t.Optional(t.Number({ minimum: 1 })),
            active: t.Optional(t.Boolean()),
            schedules: t.Optional(t.Array(t.String())),
          }),
        }
      )
      .delete('/:id', async ({ params: { id }, user, set }) => {
        const userId = (user as User).id;

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
        const userId = (user as User).id;
        const habitIdNum = Number(id);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: habitIdNum, userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        const todayCompletions = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            date: {
              gte: startOfToday,
            },
          },
        });

        if (todayCompletions >= existingHabit.timesPerDay) {
          return { completions: todayCompletions };
        }

        await prisma.$transaction(async (tx) => {
          await tx.habitCompletion.create({
            data: {
              habitId: habitIdNum,
              date: startOfToday,
              completedAt: new Date(),
            },
          });

          if (todayCompletions + 1 >= existingHabit.timesPerDay) {
            await tx.habitSchedule.updateMany({
              where: { habitId: habitIdNum },
              data: { lastNotificationSent: null },
            });
          }
        });

        return { completions: todayCompletions + 1 };
      })
      .delete('/:id/complete', async ({ params: { id }, user, set }) => {
        const userId = (user as User).id;
        const habitIdNum = Number(id);

        const existingHabit = await prisma.habit.findFirst({
          where: { id: habitIdNum, userId },
        });

        if (!existingHabit) {
          set.status = 404;
          return { error: 'Habit not found' };
        }

        const startOfToday = new Date();
        startOfToday.setUTCHours(0, 0, 0, 0);

        const lastCompletion = await prisma.habitCompletion.findFirst({
          where: {
            habitId: habitIdNum,
            date: {
              gte: startOfToday,
            },
          },
          orderBy: {
            completedAt: 'desc',
          },
        });

        if (!lastCompletion) {
          const count = await prisma.habitCompletion.count({
             where: { habitId: habitIdNum, date: { gte: startOfToday } }
          });
          return { completions: count };
        }

        await prisma.habitCompletion.delete({
          where: { id: lastCompletion.id },
        });

        const newCount = await prisma.habitCompletion.count({
          where: {
            habitId: habitIdNum,
            date: {
              gte: startOfToday,
            },
          },
        });

        return { completions: newCount };
      })
      .get(
        '/:id/history',
        async ({ params: { id }, query: { days }, user, set }) => {
          const userId = (user as User).id;
          const habitIdNum = Number(id);
          const historyDays = days ? Number(days) : 30;

          const existingHabit = await prisma.habit.findFirst({
            where: { id: habitIdNum, userId },
          });

          if (!existingHabit) {
            set.status = 404;
            return { error: 'Habit not found' };
          }

          const startDate = new Date();
          startDate.setUTCHours(0, 0, 0, 0);
          startDate.setUTCDate(startDate.getUTCDate() - historyDays + 1);

          const completions = await prisma.habitCompletion.groupBy({
            by: ['date'],
            where: {
              habitId: habitIdNum,
              date: {
                gte: startDate,
              },
            },
            _count: {
              id: true,
            },
            orderBy: {
              date: 'desc',
            },
          });

          const historyMap = new Map<string, number>();
          for (const c of completions) {
            historyMap.set(c.date.toISOString().split('T')[0], c._count.id);
          }

          const history = [];
          for (let i = 0; i < historyDays; i++) {
            const date = new Date();
            date.setUTCHours(0, 0, 0, 0);
            date.setUTCDate(date.getUTCDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = historyMap.get(dateStr) || 0;

            history.push({
              date: dateStr,
              completions: count,
              target: existingHabit.timesPerDay,
              completed: count >= existingHabit.timesPerDay,
            });
          }

          return { history };
        }
      )
  );