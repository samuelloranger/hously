import { Elysia, t } from "elysia";
import { db } from "../db";
import { customEvents } from "../db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { auth } from "../auth";
import {
  formatIso,
  nowUtc,
  getDaysInMonth,
  parseDateTime,
  roundTo15Minutes,
  startOfDay,
  endOfDay,
  sanitizeInput,
  sanitizeRichText,
  isValidColor,
} from "../utils";

// Valid recurrence types
const VALID_RECURRENCE_TYPES = [
  "yearly",
  "monthly",
  "weekly",
  "biweekly",
  "daily_interval",
];

export const customEventsRoutes = new Elysia({ prefix: "/api/custom-events" })
  .use(auth)
  // GET /api/custom-events - Get all custom events for the authenticated user
  .get(
    "/",
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const year = query.year ? parseInt(query.year) : undefined;
        const month = query.month ? parseInt(query.month) : undefined;

        let events;

        if (year && month) {
          // Filter by month
          const startDate = new Date(year, month - 1, 1);
          const daysInMonth = getDaysInMonth(year, month);
          const endDateVal = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);

          // Get events that overlap with the month
          events = await db
            .select()
            .from(customEvents)
            .where(
              and(
                eq(customEvents.userId, user.id),
                lte(customEvents.startDatetime, endDateVal.toISOString()),
                gte(customEvents.endDatetime, startDate.toISOString())
              )
            )
            .orderBy(customEvents.startDatetime);
        } else {
          events = await db
            .select()
            .from(customEvents)
            .where(eq(customEvents.userId, user.id))
            .orderBy(customEvents.startDatetime);
        }

        const eventsList = events.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          start_datetime: formatIso(event.startDatetime),
          end_datetime: formatIso(event.endDatetime),
          all_day: event.allDay,
          color: event.color,
          recurrence_type: event.recurrenceType,
          recurrence_interval_days: event.recurrenceIntervalDays,
          recurrence_original_created_at: formatIso(
            event.recurrenceOriginalCreatedAt
          ),
          created_at: formatIso(event.createdAt),
        }));

        return { events: eventsList };
      } catch (error) {
        console.error("Error getting custom events:", error);
        set.status = 500;
        return { error: "Failed to get custom events" };
      }
    },
    {
      query: t.Object({
        year: t.Optional(t.String()),
        month: t.Optional(t.String()),
      }),
    }
  )

  // POST /api/custom-events - Create a new custom event
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const {
          title,
          description,
          start_datetime,
          end_datetime,
          all_day,
          color,
          recurrence_type,
          recurrence_interval_days,
        } = body;

        // Validate required fields
        const titleTrimmed = (title || "").trim();
        if (!titleTrimmed) {
          set.status = 400;
          return { error: "title is required" };
        }

        if (!start_datetime || !end_datetime) {
          set.status = 400;
          return { error: "start_datetime and end_datetime are required" };
        }

        // Parse datetimes
        let startDt: Date;
        let endDt: Date;
        try {
          startDt = parseDateTime(start_datetime);
          endDt = parseDateTime(end_datetime);
        } catch (e) {
          set.status = 400;
          return { error: `Invalid datetime format: ${e}` };
        }

        // Round to 15-minute intervals if not all_day
        if (!all_day) {
          startDt = roundTo15Minutes(startDt);
          endDt = roundTo15Minutes(endDt);
        }

        // Handle all_day: extend to full days
        if (all_day) {
          startDt = startOfDay(startDt);
          endDt = endOfDay(endDt);
        }

        // Validate end is after start
        if (endDt <= startDt) {
          set.status = 400;
          return { error: "end_datetime must be after start_datetime" };
        }

        // Validate recurrence
        if (recurrence_type) {
          if (!VALID_RECURRENCE_TYPES.includes(recurrence_type)) {
            set.status = 400;
            return { error: "Invalid recurrence_type" };
          }

          if (recurrence_type === "daily_interval") {
            if (!recurrence_interval_days || recurrence_interval_days < 1) {
              set.status = 400;
              return {
                error:
                  "recurrence_interval_days must be >= 1 for daily_interval",
              };
            }
          }
        }

        // Sanitize inputs
        const sanitizedTitle = sanitizeInput(titleTrimmed);
        const sanitizedDescription = description
          ? sanitizeRichText(description)
          : null;

        // Validate color
        const eventColor = color || "#3b82f6";
        if (!isValidColor(eventColor)) {
          set.status = 400;
          return { error: "Invalid color format" };
        }

        // Create event
        const [newEvent] = await db
          .insert(customEvents)
          .values({
            title: sanitizedTitle,
            description: sanitizedDescription,
            startDatetime: startDt.toISOString(),
            endDatetime: endDt.toISOString(),
            allDay: all_day || false,
            color: eventColor,
            userId: user.id,
            recurrenceType: recurrence_type || null,
            recurrenceIntervalDays: recurrence_interval_days || null,
            recurrenceOriginalCreatedAt: recurrence_type ? nowUtc() : null,
            createdAt: nowUtc(),
          })
          .returning();

        console.log(`User ${user.id} created custom event ${newEvent.id}`);

        set.status = 201;
        return {
          id: newEvent.id,
          title: newEvent.title,
          description: newEvent.description,
          start_datetime: formatIso(newEvent.startDatetime),
          end_datetime: formatIso(newEvent.endDatetime),
          all_day: newEvent.allDay,
          color: newEvent.color,
          recurrence_type: newEvent.recurrenceType,
          recurrence_interval_days: newEvent.recurrenceIntervalDays,
          recurrence_original_created_at: formatIso(
            newEvent.recurrenceOriginalCreatedAt
          ),
          created_at: formatIso(newEvent.createdAt),
        };
      } catch (error) {
        console.error("Error creating custom event:", error);
        set.status = 500;
        return { error: "Failed to create custom event" };
      }
    },
    {
      body: t.Object({
        title: t.String(),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        start_datetime: t.String(),
        end_datetime: t.String(),
        all_day: t.Optional(t.Boolean()),
        color: t.Optional(t.String()),
        recurrence_type: t.Optional(t.Union([t.String(), t.Null()])),
        recurrence_interval_days: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  )

  // PUT /api/custom-events/:id - Update a custom event
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const eventId = parseInt(params.id, 10);
      if (isNaN(eventId)) {
        set.status = 400;
        return { error: "Invalid event ID" };
      }

      try {
        // Get event (only if owned by user)
        const event = await db.query.customEvents.findFirst({
          where: and(
            eq(customEvents.id, eventId),
            eq(customEvents.userId, user.id)
          ),
        });

        if (!event) {
          set.status = 404;
          return { error: "Event not found" };
        }

        const updateData: Partial<typeof customEvents.$inferInsert> = {};

        // Update title if provided
        if (body.title !== undefined) {
          const title = (body.title || "").trim();
          if (title) {
            updateData.title = sanitizeInput(title);
          }
        }

        // Update description if provided
        if (body.description !== undefined) {
          updateData.description = body.description
            ? sanitizeRichText(body.description)
            : null;
        }

        // Update datetimes if both provided
        if (body.start_datetime !== undefined && body.end_datetime !== undefined) {
          let startDt: Date;
          let endDt: Date;
          try {
            startDt = parseDateTime(body.start_datetime);
            endDt = parseDateTime(body.end_datetime);
          } catch (e) {
            set.status = 400;
            return { error: `Invalid datetime format: ${e}` };
          }

          const allDay = body.all_day !== undefined ? body.all_day : event.allDay;

          // Round to 15-minute intervals if not all_day
          if (!allDay) {
            startDt = roundTo15Minutes(startDt);
            endDt = roundTo15Minutes(endDt);
          }

          // Handle all_day
          if (allDay) {
            startDt = startOfDay(startDt);
            endDt = endOfDay(endDt);
          }

          // Validate end is after start
          if (endDt <= startDt) {
            set.status = 400;
            return { error: "end_datetime must be after start_datetime" };
          }

          updateData.startDatetime = startDt.toISOString();
          updateData.endDatetime = endDt.toISOString();
        }

        // Update all_day if provided
        if (body.all_day !== undefined) {
          updateData.allDay = body.all_day;
        }

        // Update color if provided
        if (body.color !== undefined) {
          const eventColor = body.color || "#3b82f6";
          if (!isValidColor(eventColor)) {
            set.status = 400;
            return { error: "Invalid color format" };
          }
          updateData.color = eventColor;
        }

        // Update recurrence if provided
        if (body.recurrence_type !== undefined) {
          const recurrenceType = body.recurrence_type;
          if (recurrenceType) {
            if (!VALID_RECURRENCE_TYPES.includes(recurrenceType)) {
              set.status = 400;
              return { error: "Invalid recurrence_type" };
            }

            if (recurrenceType === "daily_interval") {
              const intervalDays = body.recurrence_interval_days;
              if (!intervalDays || intervalDays < 1) {
                set.status = 400;
                return {
                  error:
                    "recurrence_interval_days must be >= 1 for daily_interval",
                };
              }
              updateData.recurrenceIntervalDays = intervalDays;
            } else {
              updateData.recurrenceIntervalDays = null;
            }
          }

          updateData.recurrenceType = recurrenceType;
          updateData.recurrenceOriginalCreatedAt = recurrenceType ? nowUtc() : null;
        }

        // Apply updates
        if (Object.keys(updateData).length > 0) {
          await db
            .update(customEvents)
            .set(updateData)
            .where(eq(customEvents.id, eventId));
        }

        // Get updated event
        const updatedEvent = await db.query.customEvents.findFirst({
          where: eq(customEvents.id, eventId),
        });

        if (!updatedEvent) {
          set.status = 500;
          return { error: "Failed to retrieve updated event" };
        }

        console.log(`User ${user.id} updated custom event ${eventId}`);

        return {
          id: updatedEvent.id,
          title: updatedEvent.title,
          description: updatedEvent.description,
          start_datetime: formatIso(updatedEvent.startDatetime),
          end_datetime: formatIso(updatedEvent.endDatetime),
          all_day: updatedEvent.allDay,
          color: updatedEvent.color,
          recurrence_type: updatedEvent.recurrenceType,
          recurrence_interval_days: updatedEvent.recurrenceIntervalDays,
          recurrence_original_created_at: formatIso(
            updatedEvent.recurrenceOriginalCreatedAt
          ),
          created_at: formatIso(updatedEvent.createdAt),
        };
      } catch (error) {
        console.error(`Error updating custom event ${eventId}:`, error);
        set.status = 500;
        return { error: "Failed to update custom event" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        start_datetime: t.Optional(t.String()),
        end_datetime: t.Optional(t.String()),
        all_day: t.Optional(t.Boolean()),
        color: t.Optional(t.String()),
        recurrence_type: t.Optional(t.Union([t.String(), t.Null()])),
        recurrence_interval_days: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  )

  // DELETE /api/custom-events/:id - Delete a custom event
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const eventId = parseInt(params.id, 10);
      if (isNaN(eventId)) {
        set.status = 400;
        return { error: "Invalid event ID" };
      }

      try {
        // Get event (only if owned by user)
        const event = await db.query.customEvents.findFirst({
          where: and(
            eq(customEvents.id, eventId),
            eq(customEvents.userId, user.id)
          ),
        });

        if (!event) {
          set.status = 404;
          return { error: "Event not found" };
        }

        // Delete event
        await db.delete(customEvents).where(eq(customEvents.id, eventId));

        console.log(`User ${user.id} deleted custom event ${eventId}`);

        return { success: true };
      } catch (error) {
        console.error(`Error deleting custom event ${eventId}:`, error);
        set.status = 500;
        return { error: "Failed to delete custom event" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
