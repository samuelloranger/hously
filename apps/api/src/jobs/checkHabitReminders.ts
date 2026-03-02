import { prisma } from '../db';
import { isNightTime, createAndQueueNotification } from './notificationService';
import { getTimezone, todayLocal } from '../utils';

export const checkHabitReminders = async () => {
  try {
    if (isNightTime()) {
      return;
    }

    const now = new Date();
    const tz = getTimezone();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const currentHours = (parts.find(p => p.type === 'hour')?.value || '00').padStart(2, '0');
    const currentMinutes = (parts.find(p => p.type === 'minute')?.value || '00').padStart(2, '0');
    const currentTimeString = `${currentHours}:${currentMinutes}`;

    const startOfToday = todayLocal();

    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60000);

    const schedules = await prisma.habitSchedule.findMany({
      where: {
        habit: {
          active: true,
        },
        time: currentTimeString,
        OR: [
          { lastNotificationSent: null },
          { lastNotificationSent: { lte: fifteenMinutesAgo } },
        ],
      },
      include: {
        habit: {
          include: {
            user: true,
            completions: {
              where: {
                date: {
                  gte: startOfToday,
                }
              }
            }
          }
        }
      }
    });

    for (const schedule of schedules) {
      if (schedule.habit.completions.length >= schedule.habit.timesPerDay) {
        continue;
      }

      const locale = schedule.habit.user.locale || 'en';
      const body = locale === 'fr' 
        ? `C'est le temps: ${schedule.habit.name}` 
        : `Time to complete: ${schedule.habit.name}`;

      await createAndQueueNotification(
        schedule.habit.userId,
        `${schedule.habit.emoji} ${schedule.habit.name}`,
        body,
        'habit',
        '/habits',
        { habit_id: schedule.habit.id, schedule_id: schedule.id }
      );

      await prisma.habitSchedule.update({
        where: { id: schedule.id },
        data: { lastNotificationSent: now }
      });
    }

  } catch (error) {
    console.error('Error checking habit reminders:', error);
  }
};
