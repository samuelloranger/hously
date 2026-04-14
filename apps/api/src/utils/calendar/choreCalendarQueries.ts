import { prisma } from "@hously/api/db";

/** Shared shape for recurring chore rows used by calendar JSON + iCal feed. */
export const recurringChoreCalendarSelect = {
  id: true,
  choreName: true,
  description: true,
  recurrenceType: true,
  recurrenceIntervalDays: true,
  recurrenceWeekday: true,
  recurrenceOriginalCreatedAt: true,
  completed: true,
  completedAt: true,
  createdAt: true,
  assignedTo: true,
} as const;

export async function fetchRecurringChoresForCalendar() {
  return prisma.chore.findMany({
    where: {
      recurrenceType: { not: null },
      completed: false,
    },
    select: recurringChoreCalendarSelect,
  });
}
