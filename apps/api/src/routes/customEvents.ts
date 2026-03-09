import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { requireUser } from '../middleware/auth';
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
} from '../utils';
import { logActivity } from '../utils/activityLogs';
import { sendSilentPushToUser } from '../services/externalNotificationService';
import { badRequest, notFound, serverError, unauthorized } from '../utils/errors';
import { hasUpdates } from '../utils/updates';

// Valid recurrence types
const VALID_RECURRENCE_TYPES = ['yearly', 'monthly', 'weekly', 'biweekly', 'daily_interval'];

export const customEventsRoutes = new Elysia({ prefix: '/api/custom-events' })
  .use(auth)
  .use(requireUser)
  // GET /api/custom-events - Get all custom events for the authenticated user
  .get(
    '/',
    async ({ user, query, set }) => {
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
          events = await prisma.customEvent.findMany({
            where: {
              userId: user!.id,
              startDatetime: { lte: endDateVal.toISOString() },
              endDatetime: { gte: startDate.toISOString() },
            },
            orderBy: { startDatetime: 'asc' },
          });
        } else {
          events = await prisma.customEvent.findMany({
            where: { userId: user!.id },
            orderBy: { startDatetime: 'asc' },
          });
        }

        const eventsList = events.map(event => ({
          id: event.id,
          title: event.title,
          description: event.description,
          start_datetime: formatIso(event.startDatetime),
          end_datetime: formatIso(event.endDatetime),
          all_day: event.allDay,
          color: event.color,
          recurrence_type: event.recurrenceType,
          recurrence_interval_days: event.recurrenceIntervalDays,
          recurrence_original_created_at: formatIso(event.recurrenceOriginalCreatedAt),
          created_at: formatIso(event.createdAt),
        }));

        return { events: eventsList };
      } catch (error) {
        console.error('Error getting custom events:', error);
        return serverError(set, 'Failed to get custom events');
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
    '/',
    async ({ user, body, set }) => {
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
        const titleTrimmed = (title || '').trim();
        if (!titleTrimmed) {
          return badRequest(set, 'title is required');
        }

        if (!start_datetime || !end_datetime) {
          return badRequest(set, 'start_datetime and end_datetime are required');
        }

        // Parse datetimes
        let startDt: Date;
        let endDt: Date;
        try {
          startDt = parseDateTime(start_datetime);
          endDt = parseDateTime(end_datetime);
        } catch (e) {
          return badRequest(set, `Invalid datetime format: ${e}`);
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
          return badRequest(set, 'end_datetime must be after start_datetime');
        }

        // Validate recurrence
        if (recurrence_type) {
          if (!VALID_RECURRENCE_TYPES.includes(recurrence_type)) {
            return badRequest(set, 'Invalid recurrence_type');
          }

          if (recurrence_type === 'daily_interval') {
            if (!recurrence_interval_days || recurrence_interval_days < 1) {
              return badRequest(set, 'recurrence_interval_days must be >= 1 for daily_interval');
            }
          }
        }

        // Sanitize inputs
        const sanitizedTitle = sanitizeInput(titleTrimmed);
        const sanitizedDescription = description ? sanitizeRichText(description) : null;

        // Validate color
        const eventColor = color || '#3b82f6';
        if (!isValidColor(eventColor)) {
          return badRequest(set, 'Invalid color format');
        }

        // Create event
        const newEvent = await prisma.customEvent.create({
          data: {
            title: sanitizedTitle,
            description: sanitizedDescription,
            startDatetime: startDt.toISOString(),
            endDatetime: endDt.toISOString(),
            allDay: all_day || false,
            color: eventColor,
            userId: user!.id,
            recurrenceType: recurrence_type || null,
            recurrenceIntervalDays: recurrence_interval_days || null,
            recurrenceOriginalCreatedAt: recurrence_type ? nowUtc() : null,
            createdAt: nowUtc(),
          },
        });

        console.log(`User ${user!.id} created custom event ${newEvent.id}`);
        await logActivity({
          type: 'event_created',
          userId: user!.id,
          payload: { event_id: newEvent.id, event_title: newEvent.title },
        });

        // Trigger calendar sync on iOS
        sendSilentPushToUser(user!.id, 'CALENDAR_SYNC').catch(err => 
          console.error('Error triggering silent push after event creation:', err)
        );

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
          recurrence_original_created_at: formatIso(newEvent.recurrenceOriginalCreatedAt),
          created_at: formatIso(newEvent.createdAt),
        };
      } catch (error) {
        console.error('Error creating custom event:', error);
        return serverError(set, 'Failed to create custom event');
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
    '/:id',
    async ({ user, params, body, set }) => {
      const eventId = parseInt(params.id, 10);
      if (isNaN(eventId)) {
        return badRequest(set, 'Invalid event ID');
      }

      try {
        // Get event (only if owned by user)
        const event = await prisma.customEvent.findFirst({
          where: {
            id: eventId,
            userId: user!.id,
          },
        });

        if (!event) {
          return notFound(set, 'Event not found');
        }

        const updateData: Record<string, any> = {};

        // Update title if provided
        if (body.title !== undefined) {
          const title = (body.title || '').trim();
          if (title) {
            updateData.title = sanitizeInput(title);
          }
        }

        // Update description if provided
        if (body.description !== undefined) {
          updateData.description = body.description ? sanitizeRichText(body.description) : null;
        }

        // Update datetimes if both provided
        if (body.start_datetime !== undefined && body.end_datetime !== undefined) {
          let startDt: Date;
          let endDt: Date;
          try {
            startDt = parseDateTime(body.start_datetime);
            endDt = parseDateTime(body.end_datetime);
          } catch (e) {
            return badRequest(set, `Invalid datetime format: ${e}`);
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
            return badRequest(set, 'end_datetime must be after start_datetime');
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
          const eventColor = body.color || '#3b82f6';
          if (!isValidColor(eventColor)) {
            return badRequest(set, 'Invalid color format');
          }
          updateData.color = eventColor;
        }

        // Update recurrence if provided
        if (body.recurrence_type !== undefined) {
          const recurrenceType = body.recurrence_type;
          if (recurrenceType) {
            if (!VALID_RECURRENCE_TYPES.includes(recurrenceType)) {
              return badRequest(set, 'Invalid recurrence_type');
            }

            if (recurrenceType === 'daily_interval') {
              const intervalDays = body.recurrence_interval_days;
              if (!intervalDays || intervalDays < 1) {
                return badRequest(set, 'recurrence_interval_days must be >= 1 for daily_interval');
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
        if (hasUpdates(updateData)) {
          await prisma.customEvent.update({
            where: { id: eventId },
            data: updateData,
          });
        }

        // Get updated event
        const updatedEvent = await prisma.customEvent.findFirst({
          where: { id: eventId },
        });

        if (!updatedEvent) {
          return serverError(set, 'Failed to retrieve updated event');
        }

        console.log(`User ${user!.id} updated custom event ${eventId}`);
        await logActivity({
          type: 'event_updated',
          userId: user!.id,
          payload: { event_id: updatedEvent.id, event_title: updatedEvent.title },
        });

        // Trigger calendar sync on iOS
        sendSilentPushToUser(user!.id, 'CALENDAR_SYNC').catch(err => 
          console.error('Error triggering silent push after event update:', err)
        );

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
          recurrence_original_created_at: formatIso(updatedEvent.recurrenceOriginalCreatedAt),
          created_at: formatIso(updatedEvent.createdAt),
        };
      } catch (error) {
        console.error(`Error updating custom event ${eventId}:`, error);
        return serverError(set, 'Failed to update custom event');
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
    '/:id',
    async ({ user, params, set }) => {
      const eventId = parseInt(params.id, 10);
      if (isNaN(eventId)) {
        return badRequest(set, 'Invalid event ID');
      }

      try {
        // Get event (only if owned by user)
        const event = await prisma.customEvent.findFirst({
          where: {
            id: eventId,
            userId: user!.id,
          },
        });

        if (!event) {
          return notFound(set, 'Event not found');
        }

        // Delete event
        await prisma.customEvent.delete({
          where: { id: eventId },
        });

        console.log(`User ${user!.id} deleted custom event ${eventId}`);
        await logActivity({
          type: 'event_deleted',
          userId: user!.id,
          payload: { event_id: eventId, event_title: event.title },
        });

        // Trigger calendar sync on iOS
        sendSilentPushToUser(user!.id, 'CALENDAR_SYNC').catch(err => 
          console.error('Error triggering silent push after event deletion:', err)
        );

        return { success: true };
      } catch (error) {
        console.error(`Error deleting custom event ${eventId}:`, error);
        return serverError(set, 'Failed to delete custom event');
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
