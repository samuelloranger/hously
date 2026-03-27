export type ChoreRecurrenceType = 'daily_interval' | 'weekly';

export interface ChoreRecurrenceInput {
  recurrenceType: ChoreRecurrenceType | null;
  recurrenceIntervalDays: number | null;
  recurrenceWeekday: number | null;
}

/**
 * Computes the next due date for a recurring chore given the date it was completed.
 * Returns null if recurrence is not configured or the config is invalid.
 *
 * recurrenceWeekday uses Monday=0 … Sunday=6 encoding.
 */
export function computeNextRecurrenceDate(chore: ChoreRecurrenceInput, completedAt: Date): Date | null {
  if (!chore.recurrenceType) return null;

  if (chore.recurrenceType === 'daily_interval') {
    if (!chore.recurrenceIntervalDays || chore.recurrenceIntervalDays <= 0) return null;
    const next = new Date(completedAt);
    next.setDate(next.getDate() + chore.recurrenceIntervalDays);
    return next;
  }

  if (chore.recurrenceType === 'weekly') {
    if (chore.recurrenceWeekday === null || chore.recurrenceWeekday === undefined) return null;
    const next = new Date(completedAt);
    const currentDay = next.getDay();
    const currentDayMondayBased = currentDay === 0 ? 6 : currentDay - 1;
    let daysUntilNext = chore.recurrenceWeekday - currentDayMondayBased;
    if (daysUntilNext <= 0) daysUntilNext += 7;
    next.setDate(next.getDate() + daysUntilNext);
    return next;
  }

  return null;
}
