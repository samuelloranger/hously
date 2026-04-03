import { prisma } from "../../db";
import { getJsonCache, setJsonCache } from "../../services/cache";

const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

const cacheKey = (userId: number) => `dashboard:habits-streak:user:${userId}`;

const calculateHabitsStreak = async (userId: number): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeHabits = await prisma.habit.findMany({
    where: { userId, active: true },
    select: { id: true, timesPerDay: true },
  });

  if (activeHabits.length === 0) return 0;

  const habitIds = activeHabits.map((h) => h.id);
  const timesPerDayMap = new Map(
    activeHabits.map((h) => [h.id, h.timesPerDay]),
  );

  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const completions = await prisma.habitCompletion.groupBy({
    by: ["habitId", "date"],
    where: {
      habitId: { in: habitIds },
      status: "done",
      date: { gte: oneYearAgo },
    },
    _count: { id: true },
  });

  // Build map: dateIso -> Set of habitIds that met their timesPerDay
  const dateHabitMap = new Map<string, Set<number>>();
  for (const row of completions) {
    const dateKey = row.date.toISOString().substring(0, 10);
    const required = timesPerDayMap.get(row.habitId) ?? 1;
    if (row._count.id >= required) {
      let set = dateHabitMap.get(dateKey);
      if (!set) {
        set = new Set();
        dateHabitMap.set(dateKey, set);
      }
      set.add(row.habitId);
    }
  }

  const habitCount = activeHabits.length;
  let streak = 0;

  // Walk backward from yesterday
  const checkDate = new Date(today);
  checkDate.setDate(checkDate.getDate() - 1);
  while (true) {
    const key = checkDate.toISOString().substring(0, 10);
    const doneSet = dateHabitMap.get(key);
    if (doneSet && doneSet.size >= habitCount) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Check if today is also complete
  const todayKey = today.toISOString().substring(0, 10);
  const todayDone = dateHabitMap.get(todayKey);
  if (todayDone && todayDone.size >= habitCount) {
    streak++;
  }

  return streak;
};

export const getCachedHabitsStreak = async (
  userId: number,
): Promise<number> => {
  const cached = await getJsonCache<{ streak: number }>(cacheKey(userId));
  return cached?.streak ?? 0;
};

export const refreshHabitsStreakForUser = async (
  userId: number,
): Promise<number> => {
  const streak = await calculateHabitsStreak(userId);
  await setJsonCache(cacheKey(userId), { streak }, CACHE_TTL_SECONDS);
  return streak;
};

export const refreshAllHabitsStreaks = async (): Promise<number> => {
  // Get distinct user IDs that have active habits
  const users = await prisma.habit.findMany({
    where: { active: true },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of users) {
    await refreshHabitsStreakForUser(userId);
  }

  return users.length;
};
