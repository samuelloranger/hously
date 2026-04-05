import { Elysia, t } from "elysia";
import type { Chore, Reminder } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import {
  saveImageAndCreateThumbnail,
  deleteImageFiles,
  getImage,
  getThumbnail,
  getContentType,
} from "@hously/api/services/imageService";
import {
  formatIso,
  nowUtc,
  sanitizeInput,
  buildUserMap,
  validateImageFile,
} from "@hously/api/utils";
import {
  createNextChoreOccurrence,
  removeChoreRecurrence,
} from "@hously/api/services/choreService";
import {
  addJob,
  QUEUE_NAMES,
  NOTIFICATION_JOB_NAMES,
} from "@hously/api/services/queueService";
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "@hously/api/errors";
import { hasUpdates } from "@hously/api/utils/updates";

type ChoreUser = { firstName: string | null; email: string } | null;

// Map database chore to frontend format (snake_case)
const mapChore = (
  chore: Chore,
  activeReminder?: Pick<Reminder, "reminderDatetime" | "active"> | null,
  addedByUser?: ChoreUser,
  assignedToUser?: ChoreUser,
  completedByUser?: ChoreUser,
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
  assigned_to_username:
    assignedToUser?.firstName || assignedToUser?.email || null,
  completed_by_username:
    completedByUser?.firstName || completedByUser?.email || null,
  reminder_datetime: activeReminder
    ? formatIso(activeReminder.reminderDatetime)
    : null,
  reminder_active: activeReminder?.active || false,
  recurrence_type: chore.recurrenceType,
  recurrence_interval_days: chore.recurrenceIntervalDays,
  recurrence_weekday: chore.recurrenceWeekday,
  recurrence_original_created_at: formatIso(chore.recurrenceOriginalCreatedAt),
  recurrence_parent_id: chore.recurrenceParentId,
});

// Helper to deactivate reminders for a chore
const deactivateRemindersForChore = async (choreId: number) => {
  await prisma.reminder.updateMany({
    where: { choreId },
    data: { active: false },
  });
};

export const choresRoutes = new Elysia({ prefix: "/api/chores" })
  .use(auth)
  .use(requireUser)
  // GET /api/chores - Get all chores with users
  .get(
    "/",
    async ({ user, query, set }) => {
      try {
        const page = query.page ? Math.max(1, parseInt(query.page, 10) || 1) : null;
        const limit = page ? Math.min(parseInt(query.limit || "50", 10) || 50, 100) : undefined;

        const [allChores, total] = await Promise.all([
          prisma.chore.findMany({
            orderBy: [
              { completed: "asc" },
              { position: "asc" },
              { createdAt: "desc" },
            ],
            ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
          }),
          page ? prisma.chore.count() : Promise.resolve(undefined),
        ]);

      // Get all users
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { email: "asc" },
      });

      // Get all active reminders
      const activeReminders = await prisma.reminder.findMany({
        where: { active: true },
        orderBy: [{ choreId: "asc" }, { reminderDatetime: "asc" }],
      });

      // Create lookup maps
      const remindersByChoreId = new Map<number, any>();
      for (const reminder of activeReminders) {
        if (!remindersByChoreId.has(reminder.choreId)) {
          remindersByChoreId.set(reminder.choreId, reminder);
        }
      }

      const usersById = buildUserMap(allUsers);

      // Build response
      const choresList = allChores.map((chore) => {
        const activeReminder = remindersByChoreId.get(chore.id);
        const addedByUser = chore.addedBy ? usersById.get(chore.addedBy) : null;
        const assignedToUser = chore.assignedTo
          ? usersById.get(chore.assignedTo)
          : null;
        const completedByUser = chore.completedBy
          ? usersById.get(chore.completedBy)
          : null;

        return mapChore(
          chore,
          activeReminder,
          addedByUser,
          assignedToUser,
          completedByUser,
        );
      });

      const usersList = allUsers.map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.firstName,
        last_name: u.lastName,
      }));

      return {
        chores: choresList,
        users: usersList,
        ...(page && limit && total != null
          ? { pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
          : {}),
      };
    } catch (error) {
      console.error("Error getting chores:", error);
      return serverError(set, "Failed to get chores");
    }
  },
  {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
    }),
  },
  )

  // POST /api/chores - Add a new chore
  .post(
    "/",
    async ({ user, body, set }) => {
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
        return badRequest(set, "chore_name is required");
      }

      // Handle assigned_to
      let assignedTo: number | null = null;
      if (
        assigned_to !== undefined &&
        assigned_to !== null &&
        assigned_to !== ""
      ) {
        const parsedAssignedTo =
          typeof assigned_to === "string"
            ? parseInt(assigned_to, 10)
            : assigned_to;
        if (isNaN(parsedAssignedTo)) {
          return badRequest(set, "Invalid assigned user");
        }
        // Validate user exists
        const assignedUser = await prisma.user.findFirst({
          where: { id: parsedAssignedTo },
        });
        if (!assignedUser) {
          return badRequest(set, "Assigned user does not exist");
        }
        assignedTo = parsedAssignedTo;
      }

      // Validate recurrence fields
      let validatedRecurrenceType: string | null = null;
      let validatedRecurrenceIntervalDays: number | null = null;
      let validatedRecurrenceWeekday: number | null = null;

      if (recurrence_type) {
        if (!["daily_interval", "weekly"].includes(recurrence_type)) {
          return badRequest(
            set,
            'Invalid recurrence_type. Must be "daily_interval" or "weekly"',
          );
        }

        validatedRecurrenceType = recurrence_type;

        if (recurrence_type === "daily_interval") {
          if (!recurrence_interval_days || recurrence_interval_days <= 0) {
            return badRequest(
              set,
              "recurrence_interval_days must be positive for daily_interval type",
            );
          }
          validatedRecurrenceIntervalDays = recurrence_interval_days;
        } else if (recurrence_type === "weekly") {
          if (
            recurrence_weekday === null ||
            recurrence_weekday === undefined ||
            recurrence_weekday < 0 ||
            recurrence_weekday > 6
          ) {
            return badRequest(
              set,
              "recurrence_weekday must be between 0 (Monday) and 6 (Sunday)",
            );
          }
          validatedRecurrenceWeekday = recurrence_weekday;
        }
      }

      try {
        // Get max position for incomplete chores
        const maxPositionResult = await prisma.chore.aggregate({
          _max: { position: true },
          where: { OR: [{ completed: false }, { completed: null }] },
        });

        const newPosition = (maxPositionResult._max.position ?? -1) + 1;

        // Create chore
        const newChore = await prisma.chore.create({
          data: {
            choreName,
            assignedTo,
            description: description ? sanitizeInput(description.trim()) : null,
            addedBy: user!.id,
            reminderEnabled: reminder_enabled || false,
            imagePath: image_path || null,
            position: newPosition,
            recurrenceType: validatedRecurrenceType,
            recurrenceIntervalDays: validatedRecurrenceIntervalDays,
            recurrenceWeekday: validatedRecurrenceWeekday,
            recurrenceOriginalCreatedAt: validatedRecurrenceType
              ? nowUtc()
              : null,
            completed: false,
            createdAt: nowUtc(),
          },
        });

        // Create reminder if enabled
        if (reminder_enabled && reminder_datetime) {
          await prisma.reminder.create({
            data: {
              choreId: newChore.id,
              reminderDatetime: reminder_datetime,
              userId: assignedTo || user!.id,
              active: true,
              createdAt: nowUtc(),
            },
          });
        }

        console.log(`User ${user!.id} created chore ${newChore.id}`);
        // Trigger calendar sync on iOS
        addJob(QUEUE_NAMES.NOTIFICATIONS, NOTIFICATION_JOB_NAMES.SILENT_PUSH, {
          userId: user!.id,
          type: "CALENDAR_SYNC",
        }).catch(() => {});
        return {
          success: true,
          id: newChore.id,
          message: "Chore created successfully",
        };
      } catch (error) {
        console.error("Error creating chore:", error);
        return serverError(set, "Failed to add chore");
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
    },
  )

  // POST /api/chores/:id/toggle - Toggle completion status
  .post(
    "/:id/toggle",
    async ({ user, params, body, set }) => {
      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        return badRequest(set, "Invalid chore ID");
      }

      const { emotion } = body || {};

      try {
        // Get chore
        const chore = await prisma.chore.findFirst({
          where: { id: choreId },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        const newStatus = !chore.completed;
        const completedAt = newStatus ? new Date() : null;

        // Update chore
        await prisma.chore.update({
          where: { id: choreId },
          data: {
            completed: newStatus,
            completedBy: newStatus ? user!.id : null,
            completedAt: newStatus ? nowUtc() : null,
          },
        });

        if (newStatus) {
          // Record task completion with emotion
          await prisma.taskCompletion.create({
            data: {
              userId: user!.id,
              taskType: "chore",
              taskId: chore.id,
              taskName: chore.choreName,
              emotion: emotion || null,
              completedAt: nowUtc(),
            },
          });

          // Deactivate reminders
          await deactivateRemindersForChore(choreId);

          // Mark related notifications as read
          await prisma.notification.updateMany({
            where: {
              userId: user!.id,
              read: false,
              notificationMetadata: {
                path: ["chore_id"],
                equals: String(choreId),
              },
            },
            data: {
              read: true,
              readAt: nowUtc(),
            },
          });

          // Create next occurrence if recurring
          if (chore.recurrenceType) {
            try {
              await createNextChoreOccurrence(chore, completedAt!);
            } catch (error) {
              console.error(
                `Error creating next occurrence for recurring chore ${choreId}:`,
                error,
              );
              // Don't fail the toggle if recurrence creation fails
            }
          }
        }

        console.log(
          `User ${user!.id} toggled chore ${choreId} to ${newStatus ? "completed" : "pending"}`,
        );
        // Trigger calendar sync on iOS
        addJob(QUEUE_NAMES.NOTIFICATIONS, NOTIFICATION_JOB_NAMES.SILENT_PUSH, {
          userId: user!.id,
          type: "CALENDAR_SYNC",
        }).catch(() => {});
        return { success: true, completed: newStatus };
      } catch (error) {
        console.error("Error toggling chore:", error);
        return serverError(set, "Failed to toggle chore");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Optional(
        t.Object({
          emotion: t.Optional(t.Union([t.String(), t.Null()])),
        }),
      ),
    },
  )

  // PUT /api/chores/:id - Update a chore
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        return badRequest(set, "Invalid chore ID");
      }

      try {
        // Get chore
        const chore = await prisma.chore.findFirst({
          where: { id: choreId },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        // Check ownership or admin
        if (chore.addedBy !== user!.id && !user!.is_admin) {
          return forbidden(set, "Unauthorized");
        }

        // Don't allow updating completed chores
        if (chore.completed) {
          return badRequest(set, "Cannot update completed chore");
        }

        const updateData: Record<string, any> = {};

        // Update chore name if provided
        if (body.chore_name !== undefined) {
          const choreName = sanitizeInput((body.chore_name || "").trim());
          if (!choreName) {
            return badRequest(set, "chore_name cannot be empty");
          }
          updateData.choreName = choreName;
        }

        // Update description if provided
        if (body.description !== undefined) {
          updateData.description = body.description
            ? sanitizeInput(body.description.trim())
            : null;
        }

        // Update assigned_to if provided
        if (body.assigned_to !== undefined) {
          if (body.assigned_to === null || body.assigned_to === "") {
            updateData.assignedTo = null;
          } else {
            const parsedAssignedTo =
              typeof body.assigned_to === "string"
                ? parseInt(body.assigned_to, 10)
                : body.assigned_to;
            if (isNaN(parsedAssignedTo)) {
              return badRequest(set, "Invalid assigned user");
            }
            const assignedUser = await prisma.user.findFirst({
              where: { id: parsedAssignedTo },
            });
            if (!assignedUser) {
              return badRequest(set, "Assigned user does not exist");
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

            let reminderUserId: number;
            if (body.assigned_to !== undefined) {
              if (body.assigned_to === null || body.assigned_to === "") {
                reminderUserId = user!.id;
              } else {
                const parsed =
                  typeof body.assigned_to === "string"
                    ? parseInt(body.assigned_to, 10)
                    : body.assigned_to;
                reminderUserId = isNaN(parsed as number)
                  ? user!.id
                  : (parsed as number);
              }
            } else {
              reminderUserId = chore.assignedTo || user!.id;
            }

            await prisma.reminder.create({
              data: {
                choreId: chore.id,
                reminderDatetime: body.reminder_datetime,
                userId: reminderUserId,
                active: true,
                createdAt: nowUtc(),
              },
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
              return badRequest(
                set,
                'Invalid recurrence_type. Must be "daily_interval" or "weekly"',
              );
            }

            updateData.recurrenceType = body.recurrence_type;

            if (body.recurrence_type === "daily_interval") {
              if (
                !body.recurrence_interval_days ||
                body.recurrence_interval_days <= 0
              ) {
                return badRequest(
                  set,
                  "recurrence_interval_days must be positive for daily_interval type",
                );
              }
              updateData.recurrenceIntervalDays = body.recurrence_interval_days;
              updateData.recurrenceWeekday = null;
            } else if (body.recurrence_type === "weekly") {
              if (
                body.recurrence_weekday === null ||
                body.recurrence_weekday === undefined ||
                body.recurrence_weekday < 0 ||
                body.recurrence_weekday > 6
              ) {
                return badRequest(
                  set,
                  "recurrence_weekday must be between 0 (Monday) and 6 (Sunday)",
                );
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
        if (hasUpdates(updateData)) {
          await prisma.chore.update({
            where: { id: choreId },
            data: updateData,
          });
        }

        console.log(`User ${user!.id} updated chore ${choreId}`);
        return { success: true, message: "Chore updated successfully" };
      } catch (error) {
        console.error(`Error updating chore ${choreId}:`, error);
        return serverError(set, "Failed to update chore");
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
    },
  )

  // PUT /api/chores/:id/remove-recurrence - Remove recurrence from a chore
  .put(
    "/:id/remove-recurrence",
    async ({ user, params, set }) => {
      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        return badRequest(set, "Invalid chore ID");
      }

      try {
        // Get chore
        const chore = await prisma.chore.findFirst({
          where: { id: choreId },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        // Check ownership or admin
        if (chore.addedBy !== user!.id && !user!.is_admin) {
          return forbidden(set, "Unauthorized");
        }

        await removeChoreRecurrence(choreId);

        console.log(
          `User ${user!.id} removed recurrence from chore ${choreId}`,
        );
        return { success: true, message: "Recurrence removed successfully" };
      } catch (error) {
        console.error(
          `Error removing recurrence from chore ${choreId}:`,
          error,
        );
        return serverError(set, "Failed to remove recurrence");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  // POST /api/chores/clear-completed - Delete all completed chores
  .post("/clear-completed", async ({ user, set }) => {
    try {
      // Get count of completed chores
      const count = await prisma.chore.count({
        where: { completed: true },
      });

      // Delete all completed chores (reminders cascade delete)
      await prisma.chore.deleteMany({
        where: { completed: true },
      });

      console.log(`User ${user!.id} deleted ${count} completed chores`);
      // Trigger calendar sync on iOS
      addJob(QUEUE_NAMES.NOTIFICATIONS, NOTIFICATION_JOB_NAMES.SILENT_PUSH, {
        userId: user!.id,
        type: "CALENDAR_SYNC",
      }).catch(() => {});
      return {
        success: true,
        message: `Deleted ${count} completed chores`,
        count,
      };
    } catch (error) {
      console.error("Error deleting completed chores:", error);
      return serverError(set, "Failed to delete completed chores");
    }
  })

  // DELETE /api/chores/:id - Delete a chore
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        return badRequest(set, "Invalid chore ID");
      }

      try {
        // Get chore
        const chore = await prisma.chore.findFirst({
          where: { id: choreId },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        // Check ownership or admin
        if (chore.addedBy !== user!.id && !user!.is_admin) {
          return forbidden(set, "Unauthorized");
        }

        // Delete associated image files from S3
        if (chore.imagePath) {
          await deleteImageFiles(chore.imagePath);
        }

        // Delete chore (reminders cascade delete)
        await prisma.chore.delete({
          where: { id: choreId },
        });

        console.log(`User ${user!.id} deleted chore ${choreId}`);
        // Trigger calendar sync on iOS
        addJob(QUEUE_NAMES.NOTIFICATIONS, NOTIFICATION_JOB_NAMES.SILENT_PUSH, {
          userId: user!.id,
          type: "CALENDAR_SYNC",
        }).catch(() => {});
        return { success: true, message: "Chore deleted successfully" };
      } catch (error) {
        console.error(`Error deleting chore ${choreId}:`, error);
        return serverError(set, "Failed to delete chore");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  // POST /api/chores/upload-image - Upload an image for a chore
  .post(
    "/upload-image",
    async ({ user, body, set }) => {
      const { image } = body;

      const validationError = validateImageFile(image, {
        maxSizeBytes: 10 * 1024 * 1024,
      });
      if (validationError) {
        return badRequest(set, validationError.error);
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
        return serverError(set, "Failed to upload image");
      }
    },
    {
      body: t.Object({
        image: t.File(),
      }),
    },
  )

  // GET /api/chores/image/:filename - Serve chore image from S3
  .get(
    "/image/:filename",
    async ({ user, params, set }) => {
      const { filename } = params;

      // Security: ensure filename doesn't contain path traversal
      if (filename.includes("..") || filename.startsWith("/")) {
        return badRequest(set, "Invalid filename");
      }

      try {
        // Get image from S3
        const imageBuffer = await getImage(filename);

        if (!imageBuffer) {
          return notFound(set, "Image not found");
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
        return serverError(set, "Failed to serve image");
      }
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
    },
  )

  // GET /api/chores/thumbnail/:filename - Serve chore thumbnail from S3
  .get(
    "/thumbnail/:filename",
    async ({ user, params, set }) => {
      const { filename } = params;

      // Security: ensure filename doesn't contain path traversal
      if (filename.includes("..") || filename.startsWith("/")) {
        return badRequest(set, "Invalid filename");
      }

      try {
        // Get thumbnail from S3
        const thumbnailBuffer = await getThumbnail(filename);

        if (!thumbnailBuffer) {
          return notFound(set, "Thumbnail not found");
        }

        return new Response(thumbnailBuffer, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000",
          },
        });
      } catch (error) {
        console.error("Error serving thumbnail:", error);
        return serverError(set, "Failed to serve thumbnail");
      }
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
    },
  )

  // POST /api/chores/reorder - Reorder chores
  .post(
    "/reorder",
    async ({ user, body, set }) => {
      const { chore_ids } = body;

      if (!Array.isArray(chore_ids)) {
        return badRequest(set, "chore_ids must be an array");
      }

      try {
        // Validate all IDs upfront
        for (let i = 0; i < chore_ids.length; i++) {
          if (isNaN(chore_ids[i])) {
            return badRequest(set, `Invalid chore_id: ${chore_ids[i]}`);
          }
        }

        // Update positions atomically in a transaction
        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < chore_ids.length; i++) {
            await tx.chore.update({
              where: { id: chore_ids[i] },
              data: { position: i },
            });
          }
        });

        console.log(`User ${user!.id} reordered chores`);
        return { success: true, message: "Chores reordered successfully" };
      } catch (error) {
        console.error("Error reordering chores:", error);
        return serverError(set, "Failed to reorder chores");
      }
    },
    {
      body: t.Object({
        chore_ids: t.Array(t.Number()),
      }),
    },
  );
