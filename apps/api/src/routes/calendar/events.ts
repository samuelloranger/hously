import { Elysia, t } from "elysia";
import type { Reminder } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { formatIso, todayLocal, toLocalDate, getDaysInMonth } from "@hously/api/utils";
import { badRequest, serverError } from "@hously/api/errors";
import {
  calculateRecurringChoreDates,
  calculateRecurringCustomEventDates,
  type ChoreData,
  type CustomEventData,
} from "@hously/api/utils/calendar/recurrence";

export const calendarEventsRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  // GET /api/calendar - Get all calendar events for a specific month
  .get(
    "/",
    async ({ user, query, set }) => {
      try {
        // Get year and month from query parameters, default to current month
        const today = todayLocal();
        const year = query.year ? parseInt(query.year) : today.getFullYear();
        const month = query.month
          ? parseInt(query.month)
          : today.getMonth() + 1;
        const months = query.months
          ? Math.min(Math.max(parseInt(query.months), 1), 12)
          : 1;

        // Validate month
        if (month < 1 || month > 12) {
          return badRequest(set, "Invalid month");
        }

        // Calculate date range: start of month to end of (month + months - 1)
        const startDate = new Date(year, month - 1, 1);
        const endMonth = month - 1 + months;
        const endYear = year + Math.floor(endMonth / 12);
        const endMonthNormalized = endMonth % 12;
        const daysInEndMonth = getDaysInMonth(endYear, endMonthNormalized + 1);
        const endDate = new Date(endYear, endMonthNormalized, daysInEndMonth);

        const events: Array<{
          id: string;
          type: string;
          date: string;
          title: string;
          description: string | null;
          metadata: Record<string, unknown>;
        }> = [];

        // Get chores with active reminders
        // Replacing inner join with separate queries
        const incompleteChores = await prisma.chore.findMany({
          where: { completed: false },
          select: {
            id: true,
            choreName: true,
            description: true,
            recurrenceType: true,
            recurrenceIntervalDays: true,
            recurrenceWeekday: true,
            assignedTo: true,
          },
        });

        const incompleteChoreIds = incompleteChores.map((c) => c.id);

        const activeRemindersForChores =
          incompleteChoreIds.length > 0
            ? await prisma.reminder.findMany({
                where: {
                  choreId: { in: incompleteChoreIds },
                  active: true,
                },
              })
            : [];

        // Build choresWithReminders by joining in JS
        const remindersByChoreIdForJoin = new Map<number, Reminder[]>();
        for (const r of activeRemindersForChores) {
          if (!remindersByChoreIdForJoin.has(r.choreId)) {
            remindersByChoreIdForJoin.set(r.choreId, []);
          }
          remindersByChoreIdForJoin.get(r.choreId)!.push(r);
        }

        for (const chore of incompleteChores) {
          const remindersForChore =
            remindersByChoreIdForJoin.get(chore.id) || [];
          for (const reminder of remindersForChore) {
            if (reminder.reminderDatetime) {
              const reminderDateLocal = toLocalDate(reminder.reminderDatetime);

              if (
                reminderDateLocal &&
                reminderDateLocal >= startDate &&
                reminderDateLocal <= endDate
              ) {
                events.push({
                  id: `chore-${chore.id}-reminder`,
                  type: "chore",
                  date: reminderDateLocal.toISOString().split("T")[0],
                  title: chore.choreName,
                  description: chore.description,
                  metadata: {
                    chore_id: chore.id,
                    reminder_datetime: formatIso(reminder.reminderDatetime),
                    recurrence_type: chore.recurrenceType,
                    recurrence_interval_days: chore.recurrenceIntervalDays,
                    recurrence_weekday: chore.recurrenceWeekday,
                    assigned_to: chore.assignedTo,
                  },
                });
              }
            }
          }
        }

        // Get recurring chores (not completed) and calculate future dates
        const recurringChores = await prisma.chore.findMany({
          where: {
            recurrenceType: { not: null },
            completed: false,
          },
          select: {
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
          },
        });

        // Batch-fetch active reminders for all recurring chores
        const recurringChoreIds = recurringChores.map((c) => c.id);
        const activeRemindersForRecurring =
          recurringChoreIds.length > 0
            ? await prisma.reminder.findMany({
                where: {
                  choreId: { in: recurringChoreIds },
                  active: true,
                },
                orderBy: { reminderDatetime: "asc" },
                select: {
                  choreId: true,
                  reminderDatetime: true,
                },
              })
            : [];

        // Group by choreId, keeping only the first (earliest) reminder per chore
        const firstReminderByChoreId = new Map<
          number,
          { reminderDatetime: Date }
        >();
        for (const r of activeRemindersForRecurring) {
          if (!firstReminderByChoreId.has(r.choreId)) {
            firstReminderByChoreId.set(r.choreId, r);
          }
        }

        for (const chore of recurringChores) {
          const choreData: ChoreData = {
            ...chore,
            recurrenceOriginalCreatedAt:
              chore.recurrenceOriginalCreatedAt?.toISOString() ?? null,
            completedAt: chore.completedAt?.toISOString() ?? null,
            createdAt: chore.createdAt?.toISOString() ?? null,
          };

          const recurringDates = calculateRecurringChoreDates(
            choreData,
            startDate,
            endDate,
          );

          const activeReminder = firstReminderByChoreId.get(chore.id);

          for (const recurringDate of recurringDates) {
            const metadata: Record<string, unknown> = {
              chore_id: chore.id,
              recurrence_type: chore.recurrenceType,
              recurrence_interval_days: chore.recurrenceIntervalDays,
              recurrence_weekday: chore.recurrenceWeekday,
              assigned_to: chore.assignedTo,
            };

            if (activeReminder) {
              metadata.reminder_datetime = formatIso(
                activeReminder.reminderDatetime,
              );
            }

            events.push({
              id: `chore-${chore.id}-recurring-${recurringDate.toISOString().split("T")[0]}`,
              type: "chore",
              date: recurringDate.toISOString().split("T")[0],
              title: chore.choreName,
              description: chore.description,
              metadata,
            });
          }
        }

        // Get custom events for this user
        const userCustomEvents = await prisma.customEvent.findMany({
          where: { userId: user!.id },
        });

        for (const event of userCustomEvents) {
          const eventData: CustomEventData = {
            id: event.id,
            title: event.title,
            description: event.description,
            startDatetime: event.startDatetime.toISOString(),
            endDatetime: event.endDatetime.toISOString(),
            allDay: event.allDay,
            color: event.color,
            recurrenceType: event.recurrenceType,
            recurrenceIntervalDays: event.recurrenceIntervalDays,
            recurrenceOriginalCreatedAt:
              event.recurrenceOriginalCreatedAt?.toISOString() ?? null,
          };

          if (event.recurrenceType) {
            // Handle recurring events
            const recurringOccurrences = calculateRecurringCustomEventDates(
              eventData,
              startDate,
              endDate,
            );

            for (const occurrence of recurringOccurrences) {
              const occurrenceEndDate = toLocalDate(
                occurrence.endDatetime.toISOString(),
              );

              // Include event if it overlaps with the month
              if (
                occurrenceEndDate &&
                occurrence.date <= endDate &&
                occurrenceEndDate >= startDate
              ) {
                events.push({
                  id: `custom-event-${event.id}-recurring-${occurrence.date.toISOString().split("T")[0]}`,
                  type: "custom_event",
                  date: occurrence.date.toISOString().split("T")[0],
                  title: event.title,
                  description: event.description,
                  metadata: {
                    custom_event_id: event.id,
                    start_datetime: occurrence.startDatetime.toISOString(),
                    end_datetime: occurrence.endDatetime.toISOString(),
                    all_day: event.allDay,
                    color: event.color,
                    recurrence_type: event.recurrenceType,
                    recurrence_interval_days: event.recurrenceIntervalDays,
                  },
                });
              }
            }
          } else {
            // Handle non-recurring events
            const eventStartDate = toLocalDate(
              event.startDatetime.toISOString(),
            );
            const eventEndDate = toLocalDate(event.endDatetime.toISOString());

            // Include event if it overlaps with the month
            if (
              eventStartDate &&
              eventEndDate &&
              eventStartDate <= endDate &&
              eventEndDate >= startDate
            ) {
              events.push({
                id: `custom-event-${event.id}`,
                type: "custom_event",
                date: eventStartDate.toISOString().split("T")[0],
                title: event.title,
                description: event.description,
                metadata: {
                  custom_event_id: event.id,
                  type: "custom_event",
                  start_datetime: formatIso(event.startDatetime),
                  end_datetime: formatIso(event.endDatetime),
                  all_day: event.allDay,
                  color: event.color,
                  recurrence_type: event.recurrenceType,
                  recurrence_interval_days: event.recurrenceIntervalDays,
                },
              });
            }
          }
        }

        // Sort events by date
        events.sort((a, b) => a.date.localeCompare(b.date));

        return { events };
      } catch (error) {
        console.error("Error getting calendar events:", error);
        return serverError(set, "Failed to get calendar events");
      }
    },
    {
      query: t.Object({
        year: t.Optional(t.String()),
        month: t.Optional(t.String()),
        months: t.Optional(t.String()),
      }),
    },
  );
