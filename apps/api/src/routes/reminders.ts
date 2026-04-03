import { Elysia, t } from "elysia";
import { prisma } from "../db";
import { auth } from "../auth";
import { requireUser } from "../middleware/auth";
import { formatIso, nowUtc, parseDateTime } from "../utils";
import {
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "../utils/errors";

export const remindersRoutes = new Elysia({ prefix: "/api/reminders" })
  .use(auth)
  .use(requireUser)
  // POST /api/reminders - Create a new reminder
  .post(
    "/",
    async ({ user, body, set }) => {
      try {
        const { chore_id, reminder_datetime } = body;

        if (!chore_id || !reminder_datetime) {
          return badRequest(set, "chore_id and reminder_datetime are required");
        }

        // Verify chore exists
        const chore = await prisma.chore.findFirst({
          where: { id: chore_id },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        // Parse datetime
        let reminderDt: Date;
        try {
          reminderDt = parseDateTime(reminder_datetime);
        } catch (e) {
          return badRequest(set, `Invalid reminder_datetime format: ${e}`);
        }

        // Create reminder
        const newReminder = await prisma.reminder.create({
          data: {
            choreId: chore_id,
            reminderDatetime: reminderDt.toISOString(),
            userId: user!.id,
            active: true,
            createdAt: nowUtc(),
          },
        });

        console.log(
          `User ${user!.id} created reminder ${newReminder.id} for chore ${chore_id}`,
        );

        return {
          success: true,
          id: newReminder.id,
          message: "Reminder created successfully",
        };
      } catch (error) {
        console.error("Error creating reminder:", error);
        return serverError(set, "Failed to create reminder");
      }
    },
    {
      body: t.Object({
        chore_id: t.Number(),
        reminder_datetime: t.String(),
      }),
    },
  )

  // GET /api/reminders/chore/:choreId - Get all reminders for a chore
  .get(
    "/chore/:choreId",
    async ({ user, params, set }) => {
      const choreId = parseInt(params.choreId, 10);
      if (isNaN(choreId)) {
        return badRequest(set, "Invalid chore ID");
      }

      try {
        const choreReminders = await prisma.reminder.findMany({
          where: { choreId },
          orderBy: { reminderDatetime: "asc" },
        });

        const remindersList = choreReminders.map((reminder) => ({
          id: reminder.id,
          chore_id: reminder.choreId,
          reminder_datetime: formatIso(reminder.reminderDatetime),
          user_id: reminder.userId,
          active: reminder.active,
          last_notification_sent: formatIso(reminder.lastNotificationSent),
          created_at: formatIso(reminder.createdAt),
        }));

        return { reminders: remindersList };
      } catch (error) {
        console.error("Error getting reminders:", error);
        return serverError(set, "Failed to get reminders");
      }
    },
    {
      params: t.Object({
        choreId: t.String(),
      }),
    },
  )

  // DELETE /api/reminders/:id - Delete a reminder
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      const reminderId = parseInt(params.id, 10);
      if (isNaN(reminderId)) {
        return badRequest(set, "Invalid reminder ID");
      }

      try {
        // Verify reminder exists and belongs to user
        const reminder = await prisma.reminder.findFirst({
          where: {
            id: reminderId,
            userId: user!.id,
          },
        });

        if (!reminder) {
          return notFound(set, "Reminder not found");
        }

        // Delete reminder
        await prisma.reminder.delete({
          where: { id: reminderId },
        });

        console.log(`User ${user!.id} deleted reminder ${reminderId}`);

        return { success: true, message: "Reminder deleted successfully" };
      } catch (error) {
        console.error(`Error deleting reminder ${reminderId}:`, error);
        return serverError(set, "Failed to delete reminder");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );
