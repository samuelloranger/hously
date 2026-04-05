import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { toLocalDate } from "@hously/api/utils";
import { getBaseUrl } from "@hously/api/config";
import {
  calculateRecurringChoreDates,
  calculateRecurringCustomEventDates,
  type ChoreData,
  type CustomEventData,
} from "@hously/api/utils/calendar/recurrence";
import { requireUser } from "@hously/api/middleware/auth";
import { unauthorized } from "@hously/api/errors";

const generateCalendarToken = (): string => {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

const escapeICalText = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

const formatICalDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

const formatICalDateTime = (date: Date): string => {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}`;
};

const buildFeedUrl = (token: string): string => {
  const base = getBaseUrl();
  return `${base}/api/calendar/feed/${token}.ics`;
};

const buildWebcalUrl = (token: string): string => {
  const base = getBaseUrl();
  const httpUrl = `${base}/api/calendar/feed/${token}.ics`;
  return httpUrl.replace(/^https?:\/\//, "webcal://");
};

export const icalFeedRoutes = new Elysia()
  // Public feed endpoint — no auth, token in URL
  .get(
    "/feed/:token",
    async ({ params, set }) => {
      const rawToken = params.token.replace(/\.ics$/, "");

      const user = await prisma.user.findFirst({
        where: { calendarToken: rawToken },
      });

      if (!user) {
        set.status = 403;
        return "Invalid feed token";
      }

      // Window: 30 days past → 90 days future
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 90);

      const lines: string[] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Hously//Calendar Feed//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:Hously`,
      ];

      // --- Chores with active reminders (non-recurring) ---
      const incompleteChores = await prisma.chore.findMany({
        where: { completed: false, recurrenceType: null },
        select: {
          id: true,
          choreName: true,
          description: true,
          assignedTo: true,
          reminders: {
            where: { active: true },
            select: { reminderDatetime: true },
          },
        },
      });

      for (const chore of incompleteChores) {
        for (const reminder of chore.reminders) {
          const reminderDate = toLocalDate(reminder.reminderDatetime);
          if (
            !reminderDate ||
            reminderDate < startDate ||
            reminderDate > endDate
          )
            continue;

          lines.push("BEGIN:VEVENT");
          lines.push(`UID:hously-chore-${chore.id}-reminder@hously`);
          lines.push(`DTSTART;VALUE=DATE:${formatICalDate(reminderDate)}`);
          lines.push(`SUMMARY:${escapeICalText(chore.choreName)}`);
          if (chore.description) {
            lines.push(`DESCRIPTION:${escapeICalText(chore.description)}`);
          }
          lines.push("END:VEVENT");
        }
      }

      // --- Recurring chores ---
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

      for (const chore of recurringChores) {
        const dates = calculateRecurringChoreDates(
          chore as unknown as ChoreData,
          startDate,
          endDate,
        );
        for (const date of dates) {
          const dateStr = formatICalDate(date);
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:hously-chore-${chore.id}-${dateStr}@hously`);
          lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
          lines.push(`SUMMARY:${escapeICalText(chore.choreName)}`);
          if (chore.description) {
            lines.push(`DESCRIPTION:${escapeICalText(chore.description)}`);
          }
          lines.push("END:VEVENT");
        }
      }

      // --- Custom events ---
      const customEvents = await prisma.customEvent.findMany({
        where: { userId: user.id },
      });

      for (const event of customEvents) {
        if (event.recurrenceType) {
          const occurrences = calculateRecurringCustomEventDates(
            event as unknown as CustomEventData,
            startDate,
            endDate,
          );
          for (const occ of occurrences) {
            const dateStr = formatICalDate(occ.date);
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:hously-event-${event.id}-${dateStr}@hously`);
            if (event.allDay) {
              lines.push(
                `DTSTART;VALUE=DATE:${formatICalDate(occ.startDatetime)}`,
              );
              lines.push(`DTEND;VALUE=DATE:${formatICalDate(occ.endDatetime)}`);
            } else {
              lines.push(`DTSTART:${formatICalDateTime(occ.startDatetime)}`);
              lines.push(`DTEND:${formatICalDateTime(occ.endDatetime)}`);
            }
            lines.push(`SUMMARY:${escapeICalText(event.title)}`);
            if (event.description) {
              lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
            }
            lines.push("END:VEVENT");
          }
        } else {
          const eventStart = toLocalDate(event.startDatetime.toISOString());
          const eventEnd = toLocalDate(event.endDatetime.toISOString());
          if (
            !eventStart ||
            !eventEnd ||
            eventEnd < startDate ||
            eventStart > endDate
          )
            continue;

          lines.push("BEGIN:VEVENT");
          lines.push(`UID:hously-event-${event.id}@hously`);
          if (event.allDay) {
            lines.push(`DTSTART;VALUE=DATE:${formatICalDate(eventStart)}`);
            lines.push(`DTEND;VALUE=DATE:${formatICalDate(eventEnd)}`);
          } else {
            lines.push(`DTSTART:${formatICalDateTime(eventStart)}`);
            lines.push(`DTEND:${formatICalDateTime(eventEnd)}`);
          }
          lines.push(`SUMMARY:${escapeICalText(event.title)}`);
          if (event.description) {
            lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
          }
          lines.push("END:VEVENT");
        }
      }

      lines.push("END:VCALENDAR");

      set.headers["content-type"] = "text/calendar; charset=utf-8";
      set.headers["content-disposition"] = 'inline; filename="hously.ics"';
      return lines.join("\r\n");
    },
    {
      params: t.Object({
        token: t.String(),
      }),
    },
  )
  // Authenticated endpoints for token management
  .use(auth)
  .use(requireUser)
  .get("/ical-token", async ({ user, set }) => {
    const dbUser = await prisma.user.findFirst({
      where: { id: user!.id },
      select: { calendarToken: true },
    });

    if (!dbUser?.calendarToken) {
      return { hasToken: false, url: null, webcalUrl: null };
    }

    return {
      hasToken: true,
      url: buildFeedUrl(dbUser.calendarToken),
      webcalUrl: buildWebcalUrl(dbUser.calendarToken),
    };
  })
  .post("/ical-token", async ({ user, set }) => {
    const token = generateCalendarToken();

    await prisma.user.update({
      where: { id: user!.id },
      data: { calendarToken: token },
    });

    return {
      url: buildFeedUrl(token),
      webcalUrl: buildWebcalUrl(token),
    };
  })
  .delete("/ical-token", async ({ user, set }) => {
    await prisma.user.update({
      where: { id: user!.id },
      data: { calendarToken: null },
    });

    return { success: true };
  });
