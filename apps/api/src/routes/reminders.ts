import { Elysia, t } from "elysia";
import { db } from "../db";
import { reminders, chores } from "../db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "../auth";
import { formatIso, nowUtc, parseDateTime } from "../utils";

export const remindersRoutes = new Elysia({ prefix: "/api/reminders" })
  .use(auth)
  // POST /api/reminders - Create a new reminder
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const { chore_id, reminder_datetime } = body;

        if (!chore_id || !reminder_datetime) {
          set.status = 400;
          return { error: "chore_id and reminder_datetime are required" };
        }

        // Verify chore exists
        const chore = await db.query.chores.findFirst({
          where: eq(chores.id, chore_id),
        });

        if (!chore) {
          set.status = 404;
          return { error: "Chore not found" };
        }

        // Parse datetime
        let reminderDt: Date;
        try {
          reminderDt = parseDateTime(reminder_datetime);
        } catch (e) {
          set.status = 400;
          return { error: `Invalid reminder_datetime format: ${e}` };
        }

        // Create reminder
        const [newReminder] = await db
          .insert(reminders)
          .values({
            choreId: chore_id,
            reminderDatetime: reminderDt.toISOString(),
            userId: user.id,
            active: true,
            createdAt: nowUtc(),
          })
          .returning();

        console.log(
          `User ${user.id} created reminder ${newReminder.id} for chore ${chore_id}`
        );

        return {
          success: true,
          id: newReminder.id,
          message: "Reminder created successfully",
        };
      } catch (error) {
        console.error("Error creating reminder:", error);
        set.status = 500;
        return { error: "Failed to create reminder" };
      }
    },
    {
      body: t.Object({
        chore_id: t.Number(),
        reminder_datetime: t.String(),
      }),
    }
  )

  // GET /api/reminders/chore/:choreId - Get all reminders for a chore
  .get(
    "/chore/:choreId",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const choreId = parseInt(params.choreId, 10);
      if (isNaN(choreId)) {
        set.status = 400;
        return { error: "Invalid chore ID" };
      }

      try {
        const choreReminders = await db
          .select()
          .from(reminders)
          .where(eq(reminders.choreId, choreId))
          .orderBy(asc(reminders.reminderDatetime));

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
        set.status = 500;
        return { error: "Failed to get reminders" };
      }
    },
    {
      params: t.Object({
        choreId: t.String(),
      }),
    }
  )

  // DELETE /api/reminders/:id - Delete a reminder
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const reminderId = parseInt(params.id, 10);
      if (isNaN(reminderId)) {
        set.status = 400;
        return { error: "Invalid reminder ID" };
      }

      try {
        // Verify reminder exists and belongs to user
        const reminder = await db.query.reminders.findFirst({
          where: and(
            eq(reminders.id, reminderId),
            eq(reminders.userId, user.id)
          ),
        });

        if (!reminder) {
          set.status = 404;
          return { error: "Reminder not found" };
        }

        // Delete reminder
        await db.delete(reminders).where(eq(reminders.id, reminderId));

        console.log(`User ${user.id} deleted reminder ${reminderId}`);

        return { success: true, message: "Reminder deleted successfully" };
      } catch (error) {
        console.error(`Error deleting reminder ${reminderId}:`, error);
        set.status = 500;
        return { error: "Failed to delete reminder" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
