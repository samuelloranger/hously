import { prisma } from "@hously/api/db";
import {
  addJob,
  QUEUE_NAMES,
  SCHEDULED_JOB_NAMES,
} from "@hously/api/services/queueService";
import {
  addDaysInTz,
  formatDateInTimezone,
  getTimezone,
  midnightOf,
  todayLocal,
} from "@hously/api/utils/date";

export const DONE_STATUS = "done";
export const SKIPPED_STATUS = "skipped";

export const getTodayStatusCounts = (entries: Array<{ status: string }>) => {
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

export const buildHabitStatusResponse = (
  timesPerDay: number,
  doneCount: number,
  skippedCount: number,
) => ({
  completions: doneCount,
  skipped: skippedCount,
  remaining: Math.max(timesPerDay - doneCount - skippedCount, 0),
  accounted: Math.min(doneCount + skippedCount, timesPerDay),
});

export const getScheduleTimes = (body: {
  schedules?: string[];
  schedule_times?: string[];
}) => body.schedules ?? body.schedule_times ?? [];

export const getUserId = (user: { id: string } | null | undefined) => {
  if (!user) {
    throw new Error("Unauthorized");
  }

  return user.id;
};

export const getTodayDateKey = (date: Date) => formatDateInTimezone(date);

export const getScheduleStatuses = (
  schedules: { id: number; time: string }[],
  completions: { completedAt: Date; status: string }[],
  _tz: string,
): { time: string; status: "done" | "skipped" | "pending" }[] => {
  const sorted = [...schedules].sort((a, b) => a.time.localeCompare(b.time));
  if (sorted.length === 0) return [];

  const statuses: { time: string; status: "done" | "skipped" | "pending" }[] =
    sorted.map((s) => ({
      time: s.time,
      status: "pending",
    }));

  const sortedCompletions = [...completions].sort(
    (a, b) => a.completedAt.getTime() - b.completedAt.getTime(),
  );

  for (
    let i = 0;
    i < Math.min(sortedCompletions.length, statuses.length);
    i++
  ) {
    statuses[i] = {
      time: sorted[i].time,
      status: sortedCompletions[i].status === DONE_STATUS ? "done" : "skipped",
    };
  }

  return statuses;
};

export const getDayRange = (date = todayLocal()) => {
  const start = new Date(date.getTime());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

/** Shared POST /complete and POST /skip body: add one done/skipped slot for the day. */
export const recordHabitSlotAction = async (params: {
  habit: { id: number; timesPerDay: number };
  userId: string;
  bodyDate: string | undefined;
  status: typeof DONE_STATUS | typeof SKIPPED_STATUS;
}) => {
  const { habit, userId, bodyDate, status } = params;
  const habitIdNum = habit.id;
  const { start: dayStart, end: dayEnd } = bodyDate
    ? getDayRange(midnightOf(bodyDate))
    : getDayRange();

  const dayCompletions = await prisma.habitCompletion.count({
    where: {
      habitId: habitIdNum,
      status: DONE_STATUS,
      completedAt: { gte: dayStart, lt: dayEnd },
    },
  });

  const daySkipped = await prisma.habitCompletion.count({
    where: {
      habitId: habitIdNum,
      status: SKIPPED_STATUS,
      completedAt: { gte: dayStart, lt: dayEnd },
    },
  });

  if (dayCompletions + daySkipped >= habit.timesPerDay) {
    return buildHabitStatusResponse(
      habit.timesPerDay,
      dayCompletions,
      daySkipped,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.habitCompletion.create({
      data: {
        habitId: habitIdNum,
        date: dayStart,
        completedAt: bodyDate ? dayStart : new Date(),
        status,
      },
    });

    if (!bodyDate && dayCompletions + daySkipped + 1 >= habit.timesPerDay) {
      await tx.habitSchedule.updateMany({
        where: { habitId: habitIdNum },
        data: { lastNotificationSent: null },
      });
    }
  });

  addJob(
    QUEUE_NAMES.SCHEDULED_TASKS,
    SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER,
    { userId },
  ).catch(() => {});

  const doneAfter =
    status === DONE_STATUS ? dayCompletions + 1 : dayCompletions;
  const skippedAfter = status === SKIPPED_STATUS ? daySkipped + 1 : daySkipped;

  return buildHabitStatusResponse(habit.timesPerDay, doneAfter, skippedAfter);
};

/** Shared DELETE /complete and DELETE /skip body: remove the last slot of the given status for the day. */
export const removeHabitSlotAction = async (params: {
  habit: { id: number; timesPerDay: number };
  userId: string;
  queryDate: string | undefined;
  status: typeof DONE_STATUS | typeof SKIPPED_STATUS;
}) => {
  const { habit, userId, queryDate, status } = params;
  const otherStatus = status === DONE_STATUS ? SKIPPED_STATUS : DONE_STATUS;

  const { start: dayStart, end: dayEnd } = queryDate
    ? getDayRange(midnightOf(queryDate))
    : getDayRange();

  const lastEntry = await prisma.habitCompletion.findFirst({
    where: {
      habitId: habit.id,
      status,
      completedAt: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { completedAt: "desc" },
  });

  const otherCount = await prisma.habitCompletion.count({
    where: {
      habitId: habit.id,
      status: otherStatus,
      completedAt: { gte: dayStart, lt: dayEnd },
    },
  });

  if (!lastEntry) {
    const count = await prisma.habitCompletion.count({
      where: {
        habitId: habit.id,
        status,
        completedAt: { gte: dayStart, lt: dayEnd },
      },
    });
    const done = status === DONE_STATUS ? count : otherCount;
    const skipped = status === SKIPPED_STATUS ? count : otherCount;
    return buildHabitStatusResponse(habit.timesPerDay, done, skipped);
  }

  await prisma.habitCompletion.delete({ where: { id: lastEntry.id } });

  const newCount = await prisma.habitCompletion.count({
    where: {
      habitId: habit.id,
      status,
      completedAt: { gte: dayStart, lt: dayEnd },
    },
  });

  addJob(
    QUEUE_NAMES.SCHEDULED_TASKS,
    SCHEDULED_JOB_NAMES.REFRESH_HABITS_STREAK_FOR_USER,
    { userId },
  ).catch(() => {});

  const done = status === DONE_STATUS ? newCount : otherCount;
  const skipped = status === SKIPPED_STATUS ? newCount : otherCount;
  return buildHabitStatusResponse(habit.timesPerDay, done, skipped);
};

export {
  addDaysInTz,
  formatDateInTimezone,
  getTimezone,
  midnightOf,
  todayLocal,
};
