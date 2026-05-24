import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { deleteImageFiles } from "@hously/api/services/imageService";
import { nowUtc } from "@hously/api/utils";
import {
  createNextChoreOccurrence,
  removeChoreRecurrence,
} from "@hously/api/services/choreService";
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@hously/api/errors";
import { logActivity } from "@hously/api/utils/activityLogs";
import { deactivateRemindersForChore } from "./choreMappers";
import { requireUser } from "@hously/api/middleware/auth";

export const choreCompletionRoutes = new Elysia()
  .use(requireUser)
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
        const chore = await prisma.chore.findFirst({
          where: { id: choreId },
        });

        if (!chore) {
          return notFound(set, "Chore not found");
        }

        const newStatus = !chore.completed;
        const completedAt = newStatus ? new Date() : null;

        await prisma.chore.update({
          where: { id: choreId },
          data: {
            completed: newStatus,
            completedBy: newStatus ? user!.id : null,
            completedAt: newStatus ? nowUtc() : null,
          },
        });

        if (newStatus) {
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

          await deactivateRemindersForChore(choreId);

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

          if (chore.recurrenceType) {
            try {
              await createNextChoreOccurrence(chore, completedAt!);
            } catch (error) {
              console.error(
                `Error creating next occurrence for recurring chore ${choreId}:`,
                error,
              );
            }
          }
        }

        await logActivity({
          type: "chore_toggled",
          userId: user!.id,
          payload: {
            chore_id: choreId,
            completed: newStatus,
          },
        });
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

  // POST /api/chores/clear-completed - Delete all completed chores
  .post("/clear-completed", async ({ user, set }) => {
    try {
      const count = await prisma.chore.count({
        where: { completed: true },
      });

      await prisma.chore.deleteMany({
        where: { completed: true },
      });

      await logActivity({
        type: "chore_completed_cleared",
        userId: user!.id,
        payload: { count },
      });
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

  // PUT /api/chores/:id/remove-recurrence - Remove recurrence from a chore
  .put(
    "/:id/remove-recurrence",
    async ({ user, params, set }) => {
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

        await removeChoreRecurrence(choreId);

        await logActivity({
          type: "chore_recurrence_removed",
          userId: user!.id,
          payload: { chore_id: choreId },
        });
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

  // DELETE /api/chores/:id - Delete a chore
  .delete(
    "/:id",
    async ({ user, params, set }) => {
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

        if (chore.imagePath) {
          await deleteImageFiles(chore.imagePath);
        }

        await prisma.chore.delete({
          where: { id: choreId },
        });

        await logActivity({
          type: "chore_deleted",
          userId: user!.id,
          payload: { chore_id: choreId },
        });
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
  );
