import { todayLocal, toLocalDate } from "@hously/api/utils";

// Calculate recurring chore dates within a date range
export interface ChoreData {
  id: number;
  choreName: string;
  description: string | null;
  recurrenceType: string | null;
  recurrenceIntervalDays: number | null;
  recurrenceWeekday: number | null;
  recurrenceOriginalCreatedAt: string | null;
  completed: boolean | null;
  completedAt: string | null;
  createdAt: string | null;
  assignedTo: number | null;
}

export const calculateRecurringChoreDates = (
  chore: ChoreData,
  startDate: Date,
  endDate: Date,
): Date[] => {
  const dates: Date[] = [];

  if (!chore.recurrenceType) {
    return dates;
  }

  const today = todayLocal();

  // Get the original creation date
  const originalDateStr = chore.recurrenceOriginalCreatedAt || chore.createdAt;
  const originalDate = toLocalDate(originalDateStr);
  if (!originalDate) return dates;

  if (chore.recurrenceType === "daily_interval") {
    if (!chore.recurrenceIntervalDays || chore.recurrenceIntervalDays <= 0) {
      return dates;
    }

    let currentDate = new Date(originalDate);

    // If the chore is completed, find the next occurrence after completion
    if (chore.completed && chore.completedAt) {
      const completedAtLocal = toLocalDate(chore.completedAt);
      if (completedAtLocal) {
        const daysSinceOriginal = Math.floor(
          (completedAtLocal.getTime() - originalDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const intervalsPassed = Math.floor(
          daysSinceOriginal / chore.recurrenceIntervalDays,
        );
        const nextInterval = intervalsPassed + 1;

        currentDate = new Date(originalDate);
        currentDate.setDate(
          currentDate.getDate() + nextInterval * chore.recurrenceIntervalDays,
        );
      }
    } else {
      // For incomplete chores, start from today if original date is in the past
      if (currentDate < today) {
        const daysSinceOriginal = Math.floor(
          (today.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const intervalsPassed = Math.floor(
          daysSinceOriginal / chore.recurrenceIntervalDays,
        );
        const nextInterval = intervalsPassed + 1;

        currentDate = new Date(originalDate);
        currentDate.setDate(
          currentDate.getDate() + nextInterval * chore.recurrenceIntervalDays,
        );
      }
    }

    // Generate dates until endDate
    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + chore.recurrenceIntervalDays);
    }
  } else if (chore.recurrenceType === "weekly") {
    if (
      chore.recurrenceWeekday === null ||
      chore.recurrenceWeekday === undefined ||
      chore.recurrenceWeekday < 0 ||
      chore.recurrenceWeekday > 6
    ) {
      return dates;
    }

    // Start from the original date or today, whichever is later
    const currentDate = new Date(
      Math.max(originalDate.getTime(), today.getTime()),
    );

    // Find the next occurrence of the target weekday
    const currentWeekday = currentDate.getDay();
    // Convert Python weekday (Monday=0) to JS weekday (Sunday=0)
    const targetWeekday = (chore.recurrenceWeekday + 1) % 7;
    let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

    if (daysUntilTarget === 0 && currentDate.getTime() === today.getTime()) {
      // If today is the target day, schedule for next week
      daysUntilTarget = 7;
    }

    currentDate.setDate(currentDate.getDate() + daysUntilTarget);

    // Generate dates until endDate
    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  return dates;
};

// Calculate recurring custom event dates within a date range
export interface CustomEventData {
  id: number;
  title: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean | null;
  color: string;
  recurrenceType: string | null;
  recurrenceIntervalDays: number | null;
  recurrenceOriginalCreatedAt: string | null;
}

export interface EventOccurrence {
  date: Date;
  startDatetime: Date;
  endDatetime: Date;
}

export const calculateRecurringCustomEventDates = (
  event: CustomEventData,
  startDate: Date,
  endDate: Date,
): EventOccurrence[] => {
  const dates: EventOccurrence[] = [];

  if (!event.recurrenceType) {
    return dates;
  }

  // Get the original start/end datetime in local timezone
  const originalStartLocal = toLocalDate(event.startDatetime);
  const originalEndLocal = toLocalDate(event.endDatetime);

  if (!originalStartLocal || !originalEndLocal) return dates;

  // Calculate duration in days
  const durationMs = originalEndLocal.getTime() - originalStartLocal.getTime();
  const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

  // Parse original times
  const originalStartDate = new Date(event.startDatetime);
  const originalEndDate = new Date(event.endDatetime);

  if (event.recurrenceType === "daily_interval") {
    if (!event.recurrenceIntervalDays || event.recurrenceIntervalDays <= 0) {
      return dates;
    }

    const currentDate = new Date(originalStartLocal);

    // Generate dates until endDate
    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        const occurrenceStart = new Date(currentDate);
        occurrenceStart.setHours(
          originalStartDate.getUTCHours(),
          originalStartDate.getUTCMinutes(),
          0,
          0,
        );

        const occurrenceEnd = new Date(currentDate);
        occurrenceEnd.setDate(occurrenceEnd.getDate() + durationDays);
        occurrenceEnd.setHours(
          originalEndDate.getUTCHours(),
          originalEndDate.getUTCMinutes(),
          0,
          0,
        );

        dates.push({
          date: new Date(currentDate),
          startDatetime: occurrenceStart,
          endDatetime: occurrenceEnd,
        });
      }

      currentDate.setDate(currentDate.getDate() + event.recurrenceIntervalDays);
    }
  } else if (event.recurrenceType === "weekly") {
    // Include the original date if it's within range
    if (originalStartLocal >= startDate && originalStartLocal <= endDate) {
      dates.push({
        date: new Date(originalStartLocal),
        startDatetime: new Date(event.startDatetime),
        endDatetime: new Date(event.endDatetime),
      });
    }

    const currentDate = new Date(
      Math.max(originalStartLocal.getTime(), startDate.getTime()),
    );

    // Find the next occurrence of the same weekday
    const targetWeekday = originalStartLocal.getDay();
    const currentWeekday = currentDate.getDay();
    let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

    if (daysUntilTarget === 0) {
      if (currentDate.getTime() === originalStartLocal.getTime()) {
        daysUntilTarget = 7;
      }
    }

    currentDate.setDate(currentDate.getDate() + daysUntilTarget);

    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        const occurrenceStart = new Date(currentDate);
        occurrenceStart.setHours(
          originalStartDate.getUTCHours(),
          originalStartDate.getUTCMinutes(),
          0,
          0,
        );

        const occurrenceEnd = new Date(currentDate);
        occurrenceEnd.setDate(occurrenceEnd.getDate() + durationDays);
        occurrenceEnd.setHours(
          originalEndDate.getUTCHours(),
          originalEndDate.getUTCMinutes(),
          0,
          0,
        );

        dates.push({
          date: new Date(currentDate),
          startDatetime: occurrenceStart,
          endDatetime: occurrenceEnd,
        });
      }

      currentDate.setDate(currentDate.getDate() + 7);
    }
  } else if (event.recurrenceType === "biweekly") {
    if (originalStartLocal >= startDate && originalStartLocal <= endDate) {
      dates.push({
        date: new Date(originalStartLocal),
        startDatetime: new Date(event.startDatetime),
        endDatetime: new Date(event.endDatetime),
      });
    }

    const currentDate = new Date(
      Math.max(originalStartLocal.getTime(), startDate.getTime()),
    );

    const targetWeekday = originalStartLocal.getDay();
    const currentWeekday = currentDate.getDay();
    let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

    if (daysUntilTarget === 0) {
      if (currentDate.getTime() === originalStartLocal.getTime()) {
        daysUntilTarget = 14;
      } else {
        const weeksSinceOriginal = Math.floor(
          (currentDate.getTime() - originalStartLocal.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );
        if (weeksSinceOriginal % 2 !== 0) {
          daysUntilTarget = 7;
        }
      }
    } else {
      const nextWeekdayDate = new Date(currentDate);
      nextWeekdayDate.setDate(nextWeekdayDate.getDate() + daysUntilTarget);
      const weeksSinceOriginal = Math.floor(
        (nextWeekdayDate.getTime() - originalStartLocal.getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
      if (weeksSinceOriginal % 2 !== 0) {
        daysUntilTarget += 7;
      }
    }

    currentDate.setDate(currentDate.getDate() + daysUntilTarget);

    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        const occurrenceStart = new Date(currentDate);
        occurrenceStart.setHours(
          originalStartDate.getUTCHours(),
          originalStartDate.getUTCMinutes(),
          0,
          0,
        );

        const occurrenceEnd = new Date(currentDate);
        occurrenceEnd.setDate(occurrenceEnd.getDate() + durationDays);
        occurrenceEnd.setHours(
          originalEndDate.getUTCHours(),
          originalEndDate.getUTCMinutes(),
          0,
          0,
        );

        dates.push({
          date: new Date(currentDate),
          startDatetime: occurrenceStart,
          endDatetime: occurrenceEnd,
        });
      }

      currentDate.setDate(currentDate.getDate() + 14);
    }
  } else if (event.recurrenceType === "monthly") {
    const dayOfMonth = originalStartLocal.getDate();
    let currentYear = startDate.getFullYear();
    let currentMonth = startDate.getMonth();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const occurrenceDate = new Date(currentYear, currentMonth, dayOfMonth);

        if (occurrenceDate < startDate) {
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
          continue;
        }

        if (occurrenceDate > endDate) {
          break;
        }

        const occurrenceStart = new Date(occurrenceDate);
        occurrenceStart.setHours(
          originalStartDate.getUTCHours(),
          originalStartDate.getUTCMinutes(),
          0,
          0,
        );

        const occurrenceEnd = new Date(occurrenceDate);
        occurrenceEnd.setDate(occurrenceEnd.getDate() + durationDays);
        occurrenceEnd.setHours(
          originalEndDate.getUTCHours(),
          originalEndDate.getUTCMinutes(),
          0,
          0,
        );

        dates.push({
          date: occurrenceDate,
          startDatetime: occurrenceStart,
          endDatetime: occurrenceEnd,
        });

        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      } catch {
        // Day doesn't exist in this month, skip
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
    }
  } else if (event.recurrenceType === "yearly") {
    const originalMonth = originalStartLocal.getMonth();
    const originalDay = originalStartLocal.getDate();
    let currentYear = startDate.getFullYear();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const occurrenceDate = new Date(
          currentYear,
          originalMonth,
          originalDay,
        );

        if (occurrenceDate < startDate) {
          currentYear++;
          continue;
        }

        if (occurrenceDate > endDate) {
          break;
        }

        const occurrenceStart = new Date(occurrenceDate);
        occurrenceStart.setHours(
          originalStartDate.getUTCHours(),
          originalStartDate.getUTCMinutes(),
          0,
          0,
        );

        const occurrenceEnd = new Date(occurrenceDate);
        occurrenceEnd.setDate(occurrenceEnd.getDate() + durationDays);
        occurrenceEnd.setHours(
          originalEndDate.getUTCHours(),
          originalEndDate.getUTCMinutes(),
          0,
          0,
        );

        dates.push({
          date: occurrenceDate,
          startDatetime: occurrenceStart,
          endDatetime: occurrenceEnd,
        });

        currentYear++;
      } catch {
        // Day doesn't exist in this year, skip
        currentYear++;
      }
    }
  }

  return dates;
};
