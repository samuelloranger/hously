import { prisma } from "../db";
import { isNightTime, createAndQueueNotification } from "./notificationService";
import { getTimezone, todayLocal } from "../utils";
import { sendLiveActivityStartPush } from "../utils/apnLiveActivity";

const getHabitStatusCounts = (entries: Array<{ status: string }>) => {
  let completions = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (entry.status === "done") {
      completions++;
    } else if (entry.status === "skipped") {
      skipped++;
    }
  }

  return { completions, skipped, accounted: completions + skipped };
};

export const checkHabitReminders = async () => {
  try {
    if (isNightTime()) {
      return;
    }

    const now = new Date();
    const tz = getTimezone();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const currentHours = (
      parts.find((p) => p.type === "hour")?.value || "00"
    ).padStart(2, "0");
    const currentMinutes = (
      parts.find((p) => p.type === "minute")?.value || "00"
    ).padStart(2, "0");
    const currentTimeString = `${currentHours}:${currentMinutes}`;

    const startOfToday = todayLocal();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60000);

    // --- Regular notification push (at schedule time) ---
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
                },
              },
            },
          },
        },
      },
    });

    for (const schedule of schedules) {
      const statusCounts = getHabitStatusCounts(schedule.habit.completions);

      if (statusCounts.accounted >= schedule.habit.timesPerDay) {
        continue;
      }

      const locale = schedule.habit.user.locale || "en";
      const body =
        locale === "fr"
          ? `C'est le temps: ${schedule.habit.name}`
          : `Time to complete: ${schedule.habit.name}`;

      await createAndQueueNotification(
        schedule.habit.userId,
        `${schedule.habit.emoji} ${schedule.habit.name}`,
        body,
        "habit",
        "/habits",
        { habit_id: schedule.habit.id, schedule_id: schedule.id },
      );

      await prisma.habitSchedule.update({
        where: { id: schedule.id },
        data: { lastNotificationSent: now },
      });
    }

    // --- Live Activity push-to-start (15 min before schedule) ---
    await sendLiveActivityPushes(now, tz, startOfToday);
  } catch (error) {
    console.error("Error checking habit reminders:", error);
  }
};

/**
 * Check for habit schedules 15 minutes from now and send Live Activity push-to-start
 * notifications so the activity appears on the lock screen before the reminder.
 */
async function sendLiveActivityPushes(
  now: Date,
  tz: string,
  startOfToday: Date,
) {
  try {
    // Calculate the time 15 minutes from now in the user's timezone
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
    const futureFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const futureParts = futureFormatter.formatToParts(fifteenMinutesFromNow);
    const futureHours = (
      futureParts.find((p) => p.type === "hour")?.value || "00"
    ).padStart(2, "0");
    const futureMinutes = (
      futureParts.find((p) => p.type === "minute")?.value || "00"
    ).padStart(2, "0");
    const futureTimeString = `${futureHours}:${futureMinutes}`;

    // Find schedules that are 15 minutes away
    const upcomingSchedules = await prisma.habitSchedule.findMany({
      where: {
        habit: {
          active: true,
        },
        time: futureTimeString,
      },
      include: {
        habit: {
          include: {
            completions: {
              where: {
                date: { gte: startOfToday },
              },
            },
          },
        },
      },
    });

    for (const schedule of upcomingSchedules) {
      const habit = schedule.habit;
      const statusCounts = getHabitStatusCounts(habit.completions);

      // Skip if already completed today
      if (statusCounts.accounted >= habit.timesPerDay) {
        continue;
      }

      // Get all Live Activity tokens for this user
      const laTokens = await prisma.liveActivityToken.findMany({
        where: { userId: habit.userId },
        select: { id: true, token: true },
      });

      if (laTokens.length === 0) continue;

      // Calculate the scheduled time as Unix timestamp (seconds since 1970)
      const [hours, minutes] = schedule.time.split(":").map(Number);
      const scheduledDate = new Date(startOfToday);
      scheduledDate.setHours(hours, minutes, 0, 0);
      const scheduledTimeUnix = Math.floor(scheduledDate.getTime() / 1000);

      const { successCount, invalidTokens } = await sendLiveActivityStartPush(
        laTokens.map((t) => t.token),
        {
          attributes: {
            habitId: habit.id,
            emoji: habit.emoji,
            name: habit.name,
            timesPerDay: habit.timesPerDay,
          },
          contentState: {
            completions: statusCounts.completions,
            scheduledTime: scheduledTimeUnix,
          },
        },
      );

      if (successCount > 0) {
        console.log(
          `[LiveActivity] Started activity for habit "${habit.name}" (${successCount} devices)`,
        );
      }

      // Clean up invalid tokens
      if (invalidTokens.length > 0) {
        await prisma.liveActivityToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        console.log(
          `[LiveActivity] Removed ${invalidTokens.length} invalid tokens`,
        );
      }
    }
  } catch (error) {
    console.error("[LiveActivity] Error sending push-to-start:", error);
  }
}
