import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import {
  formatIso,
  nowUtc,
  sanitizeInput,
  buildUserMap,
  getUserDisplayName,
} from "@hously/api/utils";
import { logActivity } from "@hously/api/utils/activityLogs";
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
  unauthorized,
} from "@hously/api/errors";
import type { Prisma } from "@prisma/client";
import { hasUpdates } from "@hously/api/utils/updates";

export const shoppingRoutes = new Elysia({ prefix: "/api/shopping" })
  .use(auth)
  .use(requireUser)
  // GET /api/shopping - Get all shopping items
  .get(
    "/",
    async ({ user, query, set }) => {
      try {
        const page = query.page
          ? Math.max(1, parseInt(query.page, 10) || 1)
          : null;
        const limit = page
          ? Math.min(parseInt(query.limit || "50", 10) || 50, 100)
          : undefined;
        const where = { deletedAt: null } as const;

        const [items, total] = await Promise.all([
          prisma.shoppingItem.findMany({
            where,
            select: {
              id: true,
              position: true,
              itemName: true,
              notes: true,
              completed: true,
              addedBy: true,
              completedBy: true,
              createdAt: true,
              completedAt: true,
            },
            orderBy: [
              { completed: "asc" },
              { position: "asc" },
              { createdAt: "desc" },
            ],
            ...(page && limit ? { skip: (page - 1) * limit, take: limit } : {}),
          }),
          page
            ? prisma.shoppingItem.count({ where })
            : Promise.resolve(undefined),
        ]);

        // Get all users for username lookups
        const allUsers = await prisma.user.findMany({
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        });

        const usersById = buildUserMap(allUsers);

        // Map items to response format
        const itemsList = items.map((item) => {
          return {
            id: item.id,
            position: item.position,
            item_name: item.itemName,
            notes: item.notes,
            completed: item.completed,
            added_by: item.addedBy,
            completed_by: item.completedBy,
            created_at: formatIso(item.createdAt),
            completed_at: formatIso(item.completedAt),
            added_by_username: getUserDisplayName(item.addedBy, usersById),
            completed_by_username: getUserDisplayName(
              item.completedBy,
              usersById,
            ),
          };
        });

        return {
          items: itemsList,
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
        console.error("Error getting shopping items:", error);
        return serverError(set, "Failed to get shopping items");
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  )

  // POST /api/shopping - Add a new shopping item
  .post(
    "/",
    async ({ user, body, set }) => {
      const { item_name, notes } = body;

      // Validate item name
      const itemName = sanitizeInput((item_name || "").trim());
      if (!itemName) {
        return badRequest(set, "Item name is required");
      }

      // Sanitize notes if provided
      const sanitizedNotes = notes ? sanitizeInput(notes.trim()) : null;

      try {
        // Get max position for incomplete items
        const maxPositionResult = await prisma.shoppingItem.aggregate({
          _max: { position: true },
          where: {
            completed: false,
            deletedAt: null,
          },
        });

        const newPosition = (maxPositionResult._max.position ?? -1) + 1;

        // Create item
        const newItem = await prisma.shoppingItem.create({
          data: {
            itemName,
            notes: sanitizedNotes,
            addedBy: user!.id,
            position: newPosition,
            completed: false,
            createdAt: nowUtc(),
          },
        });

        await logActivity({
          type: "shopping_item_added",
          userId: user!.id,
          payload: { shopping_item_id: newItem.id, item_name: itemName },
        });
        return {
          success: true,
          id: newItem.id,
          message: "Item added successfully",
        };
      } catch (error) {
        console.error("Error adding shopping item:", error);
        return serverError(set, "Failed to add item");
      }
    },
    {
      body: t.Object({
        item_name: t.String(),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )

  // POST /api/shopping/:id/toggle - Toggle completion status
  .post(
    "/:id/toggle",
    async ({ user, params, set }) => {
      const itemId = parseInt(params.id, 10);
      if (isNaN(itemId)) {
        return badRequest(set, "Invalid item ID");
      }

      try {
        // Get item (not soft-deleted)
        const item = await prisma.shoppingItem.findFirst({
          where: {
            id: itemId,
            deletedAt: null,
          },
        });

        if (!item) {
          return notFound(set, "Item not found");
        }

        const newStatus = !item.completed;

        // Update item
        await prisma.shoppingItem.update({
          where: { id: itemId },
          data: {
            completed: newStatus,
            completedBy: newStatus ? user!.id : null,
            completedAt: newStatus ? nowUtc() : null,
          },
        });

        await logActivity({
          type: "shopping_item_toggled",
          userId: user!.id,
          payload: {
            shopping_item_id: item.id,
            item_name: item.itemName,
            completed: newStatus,
          },
        });

        if (newStatus) {
          await logActivity({
            type: "shopping_item_completed",
            userId: user!.id,
            payload: { shopping_item_id: item.id, item_name: item.itemName },
          });
        }

        return { success: true, completed: newStatus };
      } catch (error) {
        console.error(`Error toggling shopping item ${itemId}:`, error);
        return serverError(set, "Failed to toggle item");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  // PUT /api/shopping/:id - Update a shopping item
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      const itemId = parseInt(params.id, 10);
      if (isNaN(itemId)) {
        return badRequest(set, "Invalid item ID");
      }

      try {
        // Get item (not soft-deleted)
        const item = await prisma.shoppingItem.findFirst({
          where: {
            id: itemId,
            deletedAt: null,
          },
        });

        if (!item) {
          return notFound(set, "Item not found");
        }

        // Check ownership or admin
        if (item.addedBy !== user!.id && !user!.is_admin) {
          return forbidden(set, "Unauthorized");
        }

        const updateData: Prisma.ShoppingItemUncheckedUpdateInput = {};

        // Update item_name if provided
        if (body.item_name !== undefined) {
          const itemName = sanitizeInput((body.item_name || "").trim());
          if (!itemName) {
            return badRequest(set, "Item name cannot be empty");
          }
          updateData.itemName = itemName;
        }

        // Update notes if provided
        if (body.notes !== undefined) {
          updateData.notes = body.notes
            ? sanitizeInput(body.notes.trim())
            : null;
        }

        // Apply updates
        if (hasUpdates(updateData)) {
          await prisma.shoppingItem.update({
            where: { id: itemId },
            data: updateData,
          });
          await logActivity({
            type: "shopping_item_updated",
            userId: user!.id,
            payload: { shopping_item_id: itemId },
          });
        }

        return { success: true, message: "Item updated successfully" };
      } catch (error) {
        console.error(`Error updating shopping item ${itemId}:`, error);
        return serverError(set, "Failed to update item");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        item_name: t.Optional(t.String()),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )

  // DELETE /api/shopping/:id - Delete a shopping item (soft delete)
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      const itemId = parseInt(params.id, 10);
      if (isNaN(itemId)) {
        return badRequest(set, "Invalid item ID");
      }

      try {
        // Get item (not already soft-deleted)
        const item = await prisma.shoppingItem.findFirst({
          where: {
            id: itemId,
            deletedAt: null,
          },
        });

        if (!item) {
          return notFound(set, "Item not found");
        }

        // Check ownership or admin
        if (item.addedBy !== user!.id && !user!.is_admin) {
          return forbidden(set, "Unauthorized");
        }

        // Soft delete by setting deleted_at timestamp
        await prisma.shoppingItem.update({
          where: { id: itemId },
          data: { deletedAt: nowUtc() },
        });

        await logActivity({
          type: "shopping_item_deleted",
          userId: user!.id,
          payload: { shopping_item_id: itemId },
        });
        return { success: true, message: "Item deleted successfully" };
      } catch (error) {
        console.error(`Error deleting shopping item ${itemId}:`, error);
        return serverError(set, "Failed to delete item");
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )

  // POST /api/shopping/clear-completed - Clear all completed items (soft delete)
  .post("/clear-completed", async ({ user, set }) => {
    try {
      // Get count of completed items (not soft-deleted)
      const count = await prisma.shoppingItem.count({
        where: {
          completed: true,
          deletedAt: null,
        },
      });

      if (count > 0) {
        // Soft delete all completed items
        await prisma.shoppingItem.updateMany({
          where: {
            completed: true,
            deletedAt: null,
          },
          data: { deletedAt: nowUtc() },
        });
      }

      await logActivity({
        type: "shopping_list_cleared",
        userId: user!.id,
        payload: { count },
      });
      return {
        success: true,
        message: `Deleted ${count} completed items`,
        count,
      };
    } catch (error) {
      console.error("Error deleting completed shopping items:", error);
      return serverError(set, "Failed to delete completed items");
    }
  })

  // POST /api/shopping/delete-bulk - Delete multiple items (soft delete)
  .post(
    "/delete-bulk",
    async ({ user, body, set }) => {
      const { item_ids } = body;

      if (!Array.isArray(item_ids) || item_ids.length === 0) {
        return badRequest(set, "item_ids must be a non-empty array");
      }

      // Normalize and validate IDs
      const normalizedIds: number[] = [];
      for (const id of item_ids) {
        const parsedId = typeof id === "string" ? parseInt(id, 10) : id;
        if (isNaN(parsedId)) {
          return badRequest(set, `Invalid item_id: ${id}`);
        }
        normalizedIds.push(parsedId);
      }

      // Remove duplicates
      const uniqueIds = [...new Set(normalizedIds)];

      try {
        // Validate ownership for all items
        for (const itemId of uniqueIds) {
          const item = await prisma.shoppingItem.findFirst({
            where: { id: itemId },
          });

          if (item && item.addedBy !== user!.id && !user!.is_admin) {
            return forbidden(set, "Unauthorized");
          }
        }

        // Get count of items to delete (not already soft-deleted)
        const count = await prisma.shoppingItem.count({
          where: {
            id: { in: uniqueIds },
            deletedAt: null,
          },
        });

        if (count > 0) {
          // Soft delete all matching items
          await prisma.shoppingItem.updateMany({
            where: {
              id: { in: uniqueIds },
              deletedAt: null,
            },
            data: { deletedAt: nowUtc() },
          });
        }

        await logActivity({
          type: "shopping_bulk_deleted",
          userId: user!.id,
          payload: { count },
        });
        return {
          success: true,
          message: `Deleted ${count} items`,
          count,
        };
      } catch (error) {
        console.error("Error deleting shopping items in bulk:", error);
        return serverError(set, "Failed to delete items");
      }
    },
    {
      body: t.Object({
        item_ids: t.Array(t.Union([t.String(), t.Number()])),
      }),
    },
  )

  // POST /api/shopping/reorder - Reorder shopping items
  .post(
    "/reorder",
    async ({ user, body, set }) => {
      const { item_ids } = body;

      if (!Array.isArray(item_ids)) {
        return badRequest(set, "item_ids must be an array");
      }

      try {
        // Validate and normalize all IDs upfront
        const normalizedIds: number[] = [];
        for (let i = 0; i < item_ids.length; i++) {
          const itemId =
            typeof item_ids[i] === "string"
              ? parseInt(item_ids[i] as string, 10)
              : (item_ids[i] as number);
          if (isNaN(itemId)) {
            return badRequest(set, `Invalid item_id: ${item_ids[i]}`);
          }
          normalizedIds.push(itemId);
        }

        // Update positions atomically in a transaction
        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < normalizedIds.length; i++) {
            await tx.shoppingItem.updateMany({
              where: {
                id: normalizedIds[i],
                deletedAt: null,
              },
              data: { position: i },
            });
          }
        });

        await logActivity({
          type: "shopping_reordered",
          userId: user!.id,
          payload: { count: item_ids.length },
        });
        return {
          success: true,
          message: "Shopping items reordered successfully",
        };
      } catch (error) {
        console.error("Error reordering shopping items:", error);
        return serverError(set, "Failed to reorder shopping items");
      }
    },
    {
      body: t.Object({
        item_ids: t.Array(t.Union([t.String(), t.Number()])),
      }),
    },
  );
