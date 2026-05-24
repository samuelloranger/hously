import { Elysia, t } from "elysia";
import type { Prisma, Reminder } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { deleteImageFiles } from "@hously/api/services/imageService";
import { nowUtc, sanitizeInput, buildUserMap } from "@hously/api/utils";
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@hously/api/errors";
import { hasUpdates } from "@hously/api/utils/updates";
import { logActivity } from "@hously/api/utils/activityLogs";
import {
  mapChore,
  deactivateRemindersForChore,
  validateRecurrenceFields,
  resolveAssignedTo,
} from "./choreMappers";
import { requireUser } from "@hously/api/middleware/auth";

export const choreCrudRoutes = new Elysia()
  .use(requireUser)
  // GET /api/chores - Get all chores with users
  .get(
    "/",
    async ({ user: _user, query, set }) => {
      try {
        const page = query.page
          ? Math.max(1, parseInt(query.page, 10) || 1)
          : null;
        const limit = page
          ? Math.min(parseInt(query.limit || "50", 10) || 50, 100)
          : undefined;

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

        const allUsers = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
          orderBy: { email: "asc" },
        });

        const activeReminders = await prisma.reminder.findMany({
          where: { active: true },
          orderBy: [{ choreId: "asc" }, { reminderDatetime: "asc" }],
        });

        const remindersByChoreId = new Map<number, Reminder>();
        for (const reminder of activeReminders) {
          if (!remindersByChoreId.has(reminder.choreId)) {
            remindersByChoreId.set(reminder.choreId, reminder);
          }
        }

        const usersById = buildUserMap(allUsers);

        const choresList = allChores.map((chore) => {
          const activeReminder = remindersByChoreId.get(chore.id);
          const addedByUser = chore.addedBy
            ? usersById.get(chore.addedBy)
            : null;
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
            ? {
                pagination: {
                  page,
                  limit,
                  total,
                  pages: Math.ceil(total / limit),
                },
              }
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

      const choreName = sanitizeInput((chore_name || "").trim());
      if (!choreName) {
        return badRequest(set, "chore_name is required");
      }

      const assignedResult = await resolveAssignedTo(
        assigned_to,
        set,
        badRequest,
      );
      if (!assignedResult.ok) return assignedResult.response;
      const assignedTo = assignedResult.value;

      const recurrenceResult = validateRecurrenceFields(
        { recurrence_type, recurrence_interval_days, recurrence_weekday },
        set,
        badRequest,
      );
      if (!recurrenceResult.ok) return recurrenceResult.response;
      const {
        recurrenceType: validatedRecurrenceType,
        recurrenceIntervalDays: validatedRecurrenceIntervalDays,
        recurrenceWeekday: validatedRecurrenceWeekday,
      } = recurrenceResult.value;

      try {
        const maxPositionResult = await prisma.chore.aggregate({
          _max: { position: true },
          where: { OR: [{ completed: false }, { completed: null }] },
        });

        const newPosition = (maxPositionResult._max.position ?? -1) + 1;

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

        await logActivity({
          type: "chore_created",
          userId: user!.id,
          payload: { chore_id: newChore.id },
        });
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

  // PUT /api/chores/:id - Update a chore
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      const choreId = parseInt(params.id, 10);
      if (isNaN(choreId)) {
        return badRequest(set, "Invalid chore ID");
      }

      try {
        const chore = await prisma.chore.findFirst({
          where: { id: choreId },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        if (chore.addedBy !== user!.id && !user!.is_admin) {
          return forbidden(set, "Unauthorized");
        }

        if (chore.completed) {
          return badRequest(set, "Cannot update completed chore");
        }

        const updateData: Prisma.ChoreUncheckedUpdateInput = {};

        if (body.chore_name !== undefined) {
          const choreName = sanitizeInput((body.chore_name || "").trim());
          if (!choreName) {
            return badRequest(set, "chore_name cannot be empty");
          }
          updateData.choreName = choreName;
        }

        if (body.description !== undefined) {
          updateData.description = body.description
            ? sanitizeInput(body.description.trim())
            : null;
        }

        if (body.assigned_to !== undefined) {
          const assignedResult = await resolveAssignedTo(
            body.assigned_to,
            set,
            badRequest,
          );
          if (!assignedResult.ok) return assignedResult.response;
          updateData.assignedTo = assignedResult.value;
        }

        if (body.reminder_enabled !== undefined) {
          updateData.reminderEnabled = body.reminder_enabled;

          if (!body.reminder_enabled) {
            await deactivateRemindersForChore(choreId);
          } else if (body.reminder_datetime) {
            await deactivateRemindersForChore(choreId);

            let reminderUserId: string;
            if (body.assigned_to !== undefined) {
              if (body.assigned_to === null || body.assigned_to === "") {
                reminderUserId = user!.id;
              } else {
                reminderUserId = String(body.assigned_to);
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

        if (body.image_path !== undefined) {
          if (chore.imagePath && chore.imagePath !== body.image_path) {
            await deleteImageFiles(chore.imagePath);
          }
          updateData.imagePath = body.image_path;
        } else if (body.remove_image) {
          if (chore.imagePath) {
            await deleteImageFiles(chore.imagePath);
          }
          updateData.imagePath = null;
        }

        if (body.recurrence_type !== undefined) {
          if (body.recurrence_type === null) {
            updateData.recurrenceType = null;
            updateData.recurrenceIntervalDays = null;
            updateData.recurrenceWeekday = null;
          } else if (body.recurrence_type) {
            const recurrenceResult = validateRecurrenceFields(
              {
                recurrence_type: body.recurrence_type,
                recurrence_interval_days: body.recurrence_interval_days,
                recurrence_weekday: body.recurrence_weekday,
              },
              set,
              badRequest,
            );
            if (!recurrenceResult.ok) return recurrenceResult.response;

            updateData.recurrenceType = recurrenceResult.value.recurrenceType;
            updateData.recurrenceIntervalDays =
              recurrenceResult.value.recurrenceIntervalDays;
            updateData.recurrenceWeekday =
              recurrenceResult.value.recurrenceWeekday;

            if (!chore.recurrenceOriginalCreatedAt) {
              updateData.recurrenceOriginalCreatedAt = chore.createdAt;
            }
          }
        }

        if (hasUpdates(updateData)) {
          await prisma.chore.update({
            where: { id: choreId },
            data: updateData,
          });
        }

        await logActivity({
          type: "chore_updated",
          userId: user!.id,
          payload: { chore_id: choreId },
        });
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
  );
