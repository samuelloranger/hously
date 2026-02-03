import { Elysia, t } from "elysia";
import { db } from "../db";
import { chores, reminders, users, taskCompletions, notifications } from "../db/schema";
import { eq, and, asc, desc, isNull, or, sql } from "drizzle-orm";
import { auth } from "../auth";
import {
  saveImageAndCreateThumbnail,
  deleteImageFiles,
  getImage,
  getThumbnail,
  getContentType,
} from "../services/imageService";
import { formatIso, nowUtc, sanitizeInput } from "../utils";

// Map database chore to frontend format (snake_case)
const mapChore = (
  chore: typeof chores.$inferSelect,
  activeReminder?: typeof reminders.$inferSelect | null,
  addedByUser?: { firstName: string | null; email: string } | null,
  assignedToUser?: { firstName: string | null; email: string } | null,
  completedByUser?: { firstName: string | null; email: string } | null
) => ({
  id: chore.id,
  position: chore.position,
  chore_name: chore.choreName,
  description: chore.description,
  assigned_to: chore.assignedTo,
  completed: chore.completed,
  added_by: chore.addedBy,
  completed_by: chore.completedBy,
  reminder_enabled: chore.reminderEnabled,
  image_path: chore.imagePath,
  created_at: formatIso(chore.createdAt),
  completed_at: formatIso(chore.completedAt),
  added_by_username: addedByUser?.firstName || addedByUser?.email || null,
  assigned_to_username: assignedToUser?.firstName || assignedToUser?.email || null,
  completed_by_username: completedByUser?.firstName || completedByUser?.email || null,
  reminder_datetime: activeReminder ? formatIso(activeReminder.reminderDatetime) : null,
  reminder_active: activeReminder?.active || false,
  recurrence_type: chore.recurrenceType,
  recurrence_interval_days: chore.recurrenceIntervalDays,
  recurrence_weekday: chore.recurrenceWeekday,
  recurrence_original_created_at: formatIso(chore.recurrenceOriginalCreatedAt),
  recurrence_parent_id: chore.recurrenceParentId,
});

// Helper to deactivate reminders for a chore
const deactivateRemindersForChore = async (choreId: number) => {
  await db
    .update(reminders)
    .set({ active: false })
    .where(eq(reminders.choreId, choreId));
};

// Helper to create next chore occurrence for recurring chores
const createNextChoreOccurrence = async (
  chore: typeof chores.$inferSelect,
  completedAt: Date
) => {
  if (!chore.recurrenceType) return null;

  let nextDate: Date;

  if (chore.recurrenceType === "daily_interval" && chore.recurrenceIntervalDays) {
    nextDate = new Date(completedAt);
    nextDate.setDate(nextDate.getDate() + chore.recurrenceIntervalDays);
  } else if (chore.recurrenceType === "weekly" && chore.recurrenceWeekday !== null) {
    nextDate = new Date(completedAt);
    const currentDay = nextDate.getDay();
    // Convert from Sunday=0 to Monday=0 format
    const currentDayMondayBased = currentDay === 0 ? 6 : currentDay - 1;
    let daysUntilNext = chore.recurrenceWeekday - currentDayMondayBased;
    if (daysUntilNext <= 0) daysUntilNext += 7;
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
  } else {
    return null;
  }

  // Get max position for new chore
  const maxPositionResult = await db
    .select({ maxPos: sql<number>`MAX(${chores.position})` })
    .from(chores)
    .where(or(eq(chores.completed, false), isNull(chores.completed)));

  const newPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;

  // Create new chore
  const [newChore] = await db
    .insert(chores)
    .values({
      choreName: chore.choreName,
      description: chore.description,
      assignedTo: chore.assignedTo,
      addedBy: chore.addedBy,
      reminderEnabled: chore.reminderEnabled,
      imagePath: chore.imagePath,
      position: newPosition,
      recurrenceType: chore.recurrenceType,
      recurrenceIntervalDays: chore.recurrenceIntervalDays,
      recurrenceWeekday: chore.recurrenceWeekday,
      recurrenceOriginalCreatedAt: chore.recurrenceOriginalCreatedAt,
      recurrenceParentId: chore.id,
      completed: false,
      createdAt: nowUtc(),
    })
    .returning();

  return newChore;
};

// Helper to remove recurrence from a chore
const removeRecurrence = async (choreId: number) => {
  await db
    .update(chores)
    .set({
      recurrenceType: null,
      recurrenceIntervalDays: null,
      recurrenceWeekday: null,
    })
    .where(eq(chores.id, choreId));
};

export const choresRoutes = new Elysia({ prefix: "/api/chores" })
  .use(auth)
  // GET /api/chores - Get all chores with users
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      // Get all chores ordered by completed, position, created_at
      const allChores = await db
        .select()
        .from(chores)
        .orderBy(asc(chores.completed), asc(chores.position), desc(chores.createdAt));

      // Get all users
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .orderBy(asc(users.email));

      // Get all active reminders
      const activeReminders = await db
        .select()
        .from(reminders)
        .where(eq(reminders.active, true))
        .orderBy(asc(reminders.choreId), asc(reminders.reminderDatetime));

      // Create lookup maps
      const remindersByChoreId = new Map<number, typeof reminders.$inferSelect>();
      for (const reminder of activeReminders) {
        if (!remindersByChoreId.has(reminder.choreId)) {
          remindersByChoreId.set(reminder.choreId, reminder);
        }
      }

      const usersById = new Map<number, { firstName: string | null; email: string }>();
      for (const u of allUsers) {
        usersById.set(u.id, { firstName: u.firstName, email: u.email });
      }

      // Build response
      const choresList = allChores.map((chore) => {
        const activeReminder = remindersByChoreId.get(chore.id);
        const addedByUser = chore.addedBy ? usersById.get(chore.addedBy) : null;
        const assignedToUser = chore.assignedTo ? usersById.get(chore.assignedTo) : null;
        const completedByUser = chore.completedBy ? usersById.get(chore.completedBy) : null;

        return mapChore(chore, activeReminder, addedByUser, assignedToUser, completedByUser);
      });

      const usersList = allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.firstName,
        last_name: u.lastName,
      }));

      return { chores: choresList, users: usersList };
    } catch (error) {
      console.error("Error getting chores:", error);
      set.status = 500;
      return { error: "Failed to get chores" };
    }
  })

  // POST /api/chores - Add a new chore
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const {
        chore_name,
        assigned_to,
        description,
        reminder_enabled,
        reminder_datetime,
        image_path,
        recurrence_type,
        recurrence_interval_days,
        recurrence_weekday,
      } = body;

      // Validate chore name
      const choreName = sanitizeInput((chore_name || "").trim());
      if (!choreName) {
        set.status = 400;
        return { error: "chore_name is required" };
      }

      // Handle assigned_to
      let assignedTo: number | null = null;
      if (assigned_to !== undefined && assigned_to !== null && assigned_to !== "") {
        const parsedAssignedTo = typeof assigned_to === "string" ? parseInt(assigned_to, 10) : assigned_to;
        if (isNaN(parsedAssignedTo)) {
          set.status = 400;
          return { error: "Invalid assigned user" };
        }
        // Validate user exists
        const assignedUser = await db.query.users.findFirst({
          where: eq(users.id, parsedAssignedTo),
        });
        if (!assignedUser) {
          set.status = 400;
          return { error: "Assigned user does not exist" };
        }
        assignedTo = parsedAssignedTo;
      }

      // Validate recurrence fields
      let validatedRecurrenceType: string | null = null;
      let validatedRecurrenceIntervalDays: number | null = null;
      let validatedRecurrenceWeekday: number | null = null;

      if (recurrence_type) {
        if (!["daily_interval", "weekly"].includes(recurrence_type)) {
          set.status = 400;
          return { error: 'Invalid recurrence_type. Must be "daily_interval" or "weekly"' };
        }

        validatedRecurrenceType = recurrence_type;

        if (recurrence_type === "daily_interval") {
          if (!recurrence_interval_days || recurrence_interval_days <= 0) {
            set.status = 400;
            return { error: "recurrence_interval_days must be positive for daily_interval type" };
          }
          validatedRecurrenceIntervalDays = recurrence_interval_days;
        } else if (recurrence_type === "weekly") {
          if (recurrence_weekday === null || recurrence_weekday === undefined || recurrence_weekday < 0 || recurrence_weekday > 6) {
            set.status = 400;
            return { error: "recurrence_weekday must be between 0 (Monday) and 6 (Sunday)" };
          }
          validatedRecurrenceWeekday = recurrence_weekday;
        }
      }

      try {
        // Get max position for incomplete chores
        const maxPositionResult = await db
          .select({ maxPos: sql<number>`MAX(${chores.position})` })
          .from(chores)
          .where(or(eq(chores.completed, false), isNull(chores.completed)));

        const newPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;

        // Create chore
        const [newChore] = await db
          .insert(chores)
          .values({
            choreName,
            assignedTo,
            description: description ? sanitizeInput(description.trim()) : null,
            addedBy: user.id,
            reminderEnabled: reminder_enabled || false,
            imagePath: image_path || null,
            position: newPosition,
            recurrenceType: validatedRecurrenceType,
            recurrenceIntervalDays: validatedRecurrenceIntervalDays,
            recurrenceWeekday: validatedRecurrenceWeekday,
            recurrenceOriginalCreatedAt: validatedRecurrenceType ? nowUtc() : null,
            completed: false,
            createdAt: nowUtc(),
          })
          .returning();

        // Create reminder if enabled
        if (reminder_enabled && reminder_datetime) {
          await db.insert(reminders).values({
            choreId: newChore.id,
            reminderDatetime: reminder_datetime,
            userId: assignedTo || user.id,
            active: true,
            createdAt: nowUtc(),
          });
        }

        console.log(`User ${user.id} created chore ${newChore.id}`);
        return { success: true, id: newChore.id, message: "Chore created successfully" };
      } catch (error) {
        console.error("Error creating chore:", error);
        set.status = 500;
        return { error: `Failed to add chore: ${error}` };
      }
    },
    {
      body: t.Object({
        chore_name: t.String(),
        assigned_to: t.Optional(t.Union([t.String(), t.Number(), t.Null()])),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        reminder_enabled: t.Optional(t.Boolean()),
        reminder_datetime: t.Optional(t.Union([t.String(), t.Null()])),
        image_path: t.Optional(t.Union([t.String(), t.Null()])),
        recurrence_type: t.Optional(t.Union([t.String(), t.Null()])),
        recurrence_interval_days: t.Optional(t.Union([t.Number(), t.Null()])),
        recurrence_weekday: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  )

  // POST /api/chores/:id/toggle - Toggle completion status
  .post(
    "/:id/toggle",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        set.status = 400;
        return { error: "Invalid chore ID" };
      }

      const { emotion } = body || {};

      try {
        // Get chore
        const chore = await db.query.chores.findFirst({
          where: eq(chores.id, choreId),
        });

        if (!chore) {
          set.status = 404;
          return { error: "Chore not found" };
        }

        const newStatus = !chore.completed;
        const completedAt = newStatus ? new Date() : null;

        // Update chore
        await db
          .update(chores)
          .set({
            completed: newStatus,
            completedBy: newStatus ? user.id : null,
            completedAt: newStatus ? nowUtc() : null,
          })
          .where(eq(chores.id, choreId));

        if (newStatus) {
          // Record task completion with emotion
          await db.insert(taskCompletions).values({
            userId: user.id,
            taskType: "chore",
            taskId: chore.id,
            taskName: chore.choreName,
            emotion: emotion || null,
            completedAt: nowUtc(),
          });

          // Deactivate reminders
          await deactivateRemindersForChore(choreId);

          // Mark related notifications as read
          await db
            .update(notifications)
            .set({ read: true, readAt: nowUtc() })
            .where(
              and(
                eq(notifications.userId, user.id),
                eq(notifications.read, false),
                sql`${notifications.notificationMetadata}->>'chore_id' = ${String(choreId)}`
              )
            );

          // Create next occurrence if recurring
          if (chore.recurrenceType) {
            try {
              await createNextChoreOccurrence(chore, completedAt!);
            } catch (error) {
              console.error(`Error creating next occurrence for recurring chore ${choreId}:`, error);
              // Don't fail the toggle if recurrence creation fails
            }
          }
        }

        console.log(`User ${user.id} toggled chore ${choreId} to ${newStatus ? "completed" : "pending"}`);
        return { success: true, completed: newStatus };
      } catch (error) {
        console.error("Error toggling chore:", error);
        set.status = 500;
        return { error: "Failed to toggle chore" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Optional(
        t.Object({
          emotion: t.Optional(t.Union([t.String(), t.Null()])),
        })
      ),
    }
  )

  // PUT /api/chores/:id - Update a chore
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        set.status = 400;
        return { error: "Invalid chore ID" };
      }

      try {
        // Get chore
        const chore = await db.query.chores.findFirst({
          where: eq(chores.id, choreId),
        });

        if (!chore) {
          set.status = 404;
          return { error: "Chore not found" };
        }

        // Check ownership or admin
        if (chore.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        // Don't allow updating completed chores
        if (chore.completed) {
          set.status = 400;
          return { error: "Cannot update completed chore" };
        }

        const updateData: Partial<typeof chores.$inferInsert> = {};

        // Update chore name if provided
        if (body.chore_name !== undefined) {
          const choreName = sanitizeInput((body.chore_name || "").trim());
          if (!choreName) {
            set.status = 400;
            return { error: "chore_name cannot be empty" };
          }
          updateData.choreName = choreName;
        }

        // Update description if provided
        if (body.description !== undefined) {
          updateData.description = body.description ? sanitizeInput(body.description.trim()) : null;
        }

        // Update assigned_to if provided
        if (body.assigned_to !== undefined) {
          if (body.assigned_to === null || body.assigned_to === "") {
            updateData.assignedTo = null;
          } else {
            const parsedAssignedTo = typeof body.assigned_to === "string" ? parseInt(body.assigned_to, 10) : body.assigned_to;
            if (isNaN(parsedAssignedTo)) {
              set.status = 400;
              return { error: "Invalid assigned user" };
            }
            const assignedUser = await db.query.users.findFirst({
              where: eq(users.id, parsedAssignedTo),
            });
            if (!assignedUser) {
              set.status = 400;
              return { error: "Assigned user does not exist" };
            }
            updateData.assignedTo = parsedAssignedTo;
          }
        }

        // Handle reminder updates
        if (body.reminder_enabled !== undefined) {
          updateData.reminderEnabled = body.reminder_enabled;

          if (!body.reminder_enabled) {
            // Disable existing reminders
            await deactivateRemindersForChore(choreId);
          } else if (body.reminder_datetime) {
            // Delete existing reminders and create new one
            await deactivateRemindersForChore(choreId);

            const reminderUserId = body.assigned_to !== undefined
              ? (body.assigned_to === null || body.assigned_to === "" ? user.id : (typeof body.assigned_to === "string" ? parseInt(body.assigned_to, 10) : body.assigned_to))
              : (chore.assignedTo || user.id);

            await db.insert(reminders).values({
              choreId: chore.id,
              reminderDatetime: body.reminder_datetime,
              userId: reminderUserId,
              active: true,
              createdAt: nowUtc(),
            });
          }
        }

        // Handle image updates
        if (body.image_path !== undefined) {
          // Delete old image from S3 if replacing
          if (chore.imagePath && chore.imagePath !== body.image_path) {
            await deleteImageFiles(chore.imagePath);
          }
          updateData.imagePath = body.image_path;
        } else if (body.remove_image) {
          // Delete image from S3 if removing
          if (chore.imagePath) {
            await deleteImageFiles(chore.imagePath);
          }
          updateData.imagePath = null;
        }

        // Handle recurrence updates
        if (body.recurrence_type !== undefined) {
          if (body.recurrence_type === null) {
            // Remove recurrence
            updateData.recurrenceType = null;
            updateData.recurrenceIntervalDays = null;
            updateData.recurrenceWeekday = null;
          } else if (body.recurrence_type) {
            if (!["daily_interval", "weekly"].includes(body.recurrence_type)) {
              set.status = 400;
              return { error: 'Invalid recurrence_type. Must be "daily_interval" or "weekly"' };
            }

            updateData.recurrenceType = body.recurrence_type;

            if (body.recurrence_type === "daily_interval") {
              if (!body.recurrence_interval_days || body.recurrence_interval_days <= 0) {
                set.status = 400;
                return { error: "recurrence_interval_days must be positive for daily_interval type" };
              }
              updateData.recurrenceIntervalDays = body.recurrence_interval_days;
              updateData.recurrenceWeekday = null;
            } else if (body.recurrence_type === "weekly") {
              if (body.recurrence_weekday === null || body.recurrence_weekday === undefined || body.recurrence_weekday < 0 || body.recurrence_weekday > 6) {
                set.status = 400;
                return { error: "recurrence_weekday must be between 0 (Monday) and 6 (Sunday)" };
              }
              updateData.recurrenceWeekday = body.recurrence_weekday;
              updateData.recurrenceIntervalDays = null;
            }

            // Set original_created_at if not already set
            if (!chore.recurrenceOriginalCreatedAt) {
              updateData.recurrenceOriginalCreatedAt = chore.createdAt;
            }
          }
        }

        // Apply updates
        if (Object.keys(updateData).length > 0) {
          await db.update(chores).set(updateData).where(eq(chores.id, choreId));
        }

        console.log(`User ${user.id} updated chore ${choreId}`);
        return { success: true, message: "Chore updated successfully" };
      } catch (error) {
        console.error(`Error updating chore ${choreId}:`, error);
        set.status = 500;
        return { error: `Failed to update chore: ${error}` };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        chore_name: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        assigned_to: t.Optional(t.Union([t.String(), t.Number(), t.Null()])),
        reminder_enabled: t.Optional(t.Boolean()),
        reminder_datetime: t.Optional(t.Union([t.String(), t.Null()])),
        image_path: t.Optional(t.Union([t.String(), t.Null()])),
        remove_image: t.Optional(t.Boolean()),
        recurrence_type: t.Optional(t.Union([t.String(), t.Null()])),
        recurrence_interval_days: t.Optional(t.Union([t.Number(), t.Null()])),
        recurrence_weekday: t.Optional(t.Union([t.Number(), t.Null()])),
      }),
    }
  )

  // PUT /api/chores/:id/remove-recurrence - Remove recurrence from a chore
  .put(
    "/:id/remove-recurrence",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        set.status = 400;
        return { error: "Invalid chore ID" };
      }

      try {
        // Get chore
        const chore = await db.query.chores.findFirst({
          where: eq(chores.id, choreId),
        });

        if (!chore) {
          set.status = 404;
          return { error: "Chore not found" };
        }

        // Check ownership or admin
        if (chore.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        await removeRecurrence(choreId);

        console.log(`User ${user.id} removed recurrence from chore ${choreId}`);
        return { success: true, message: "Recurrence removed successfully" };
      } catch (error) {
        console.error(`Error removing recurrence from chore ${choreId}:`, error);
        set.status = 500;
        return { error: `Failed to remove recurrence: ${error}` };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/chores/clear-completed - Delete all completed chores
  .post("/clear-completed", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      // Get count of completed chores
      const completedChores = await db
        .select({ id: chores.id })
        .from(chores)
        .where(eq(chores.completed, true));

      const count = completedChores.length;

      // Delete all completed chores (reminders cascade delete)
      await db.delete(chores).where(eq(chores.completed, true));

      console.log(`User ${user.id} deleted ${count} completed chores`);
      return {
        success: true,
        message: `Deleted ${count} completed chores`,
        count,
      };
    } catch (error) {
      console.error("Error deleting completed chores:", error);
      set.status = 500;
      return { error: "Failed to delete completed chores" };
    }
  })

  // DELETE /api/chores/:id - Delete a chore
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        set.status = 400;
        return { error: "Invalid chore ID" };
      }

      try {
        // Get chore
        const chore = await db.query.chores.findFirst({
          where: eq(chores.id, choreId),
        });

        if (!chore) {
          set.status = 404;
          return { error: "Chore not found" };
        }

        // Check ownership or admin
        if (chore.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        // Delete associated image files from S3
        if (chore.imagePath) {
          await deleteImageFiles(chore.imagePath);
        }

        // Delete chore (reminders cascade delete)
        await db.delete(chores).where(eq(chores.id, choreId));

        console.log(`User ${user.id} deleted chore ${choreId}`);
        return { success: true, message: "Chore deleted successfully" };
      } catch (error) {
        console.error(`Error deleting chore ${choreId}:`, error);
        set.status = 500;
        return { error: "Failed to delete chore" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/chores/upload-image - Upload an image for a chore
  .post(
    "/upload-image",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { image } = body;

      if (!image || !(image instanceof File)) {
        set.status = 400;
        return { error: "No image file provided" };
      }

      if (image.size === 0) {
        set.status = 400;
        return { error: "No file selected" };
      }

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(image.type)) {
        set.status = 400;
        return { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" };
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (image.size > maxSize) {
        set.status = 400;
        return { error: "File too large. Maximum size is 10MB" };
      }

      try {
        // Save image and create thumbnail using S3
        const imagePath = await saveImageAndCreateThumbnail(image);

        console.log(`Image upload successful - image_path: ${imagePath}`);
        return {
          success: true,
          data: {
            image_path: imagePath,
          },
        };
      } catch (error) {
        console.error("Error uploading image:", error);
        set.status = 500;
        return { error: `Failed to upload image: ${error}` };
      }
    },
    {
      body: t.Object({
        image: t.File(),
      }),
    }
  )

  // GET /api/chores/image/:filename - Serve chore image from S3
  .get(
    "/image/:filename",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { filename } = params;

      // Security: ensure filename doesn't contain path traversal
      if (filename.includes("..") || filename.startsWith("/")) {
        set.status = 400;
        return { error: "Invalid filename" };
      }

      try {
        // Get image from S3
        const imageBuffer = await getImage(filename);

        if (!imageBuffer) {
          set.status = 404;
          return { error: "Image not found" };
        }

        // Determine content type
        const contentType = getContentType(filename);

        set.headers = {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        };

        return new Response(imageBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000",
          },
        });
      } catch (error) {
        console.error("Error serving image:", error);
        set.status = 500;
        return { error: "Failed to serve image" };
      }
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
    }
  )

  // GET /api/chores/thumbnail/:filename - Serve chore thumbnail from S3
  .get(
    "/thumbnail/:filename",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { filename } = params;

      // Security: ensure filename doesn't contain path traversal
      if (filename.includes("..") || filename.startsWith("/")) {
        set.status = 400;
        return { error: "Invalid filename" };
      }

      try {
        // Get thumbnail from S3
        const thumbnailBuffer = await getThumbnail(filename);

        if (!thumbnailBuffer) {
          set.status = 404;
          return { error: "Thumbnail not found" };
        }

        return new Response(thumbnailBuffer, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000",
          },
        });
      } catch (error) {
        console.error("Error serving thumbnail:", error);
        set.status = 500;
        return { error: "Failed to serve thumbnail" };
      }
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
    }
  )

  // POST /api/chores/reorder - Reorder chores
  .post(
    "/reorder",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { chore_ids } = body;

      if (!Array.isArray(chore_ids)) {
        set.status = 400;
        return { error: "chore_ids must be an array" };
      }

      try {
        // Update positions based on the order in the array
        for (let i = 0; i < chore_ids.length; i++) {
          const choreId = typeof chore_ids[i] === "string" ? parseInt(chore_ids[i], 10) : chore_ids[i];
          if (isNaN(choreId)) {
            set.status = 400;
            return { error: `Invalid chore_id: ${chore_ids[i]}` };
          }

          await db.update(chores).set({ position: i }).where(eq(chores.id, choreId));
        }

        console.log(`User ${user.id} reordered chores`);
        return { success: true, message: "Chores reordered successfully" };
      } catch (error) {
        console.error("Error reordering chores:", error);
        set.status = 500;
        return { error: "Failed to reorder chores" };
      }
    },
    {
      body: t.Object({
        chore_ids: t.Array(t.Union([t.String(), t.Number()])),
      }),
    }
  );
