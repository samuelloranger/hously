import { Elysia, t } from "elysia";
import { db } from "../db";
import { shoppingItems, users } from "../db/schema";
import { eq, and, asc, desc, isNull, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { auth } from "../auth";
import { formatIso, nowUtc, sanitizeInput } from "../utils";

export const shoppingRoutes = new Elysia({ prefix: "/api/shopping" })
  .use(auth)
  // GET /api/shopping - Get all shopping items
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      // Get all non-deleted shopping items ordered by completed, position, created_at
      const items = await db
        .select({
          id: shoppingItems.id,
          position: shoppingItems.position,
          itemName: shoppingItems.itemName,
          notes: shoppingItems.notes,
          completed: shoppingItems.completed,
          addedBy: shoppingItems.addedBy,
          completedBy: shoppingItems.completedBy,
          createdAt: shoppingItems.createdAt,
          completedAt: shoppingItems.completedAt,
        })
        .from(shoppingItems)
        .where(isNull(shoppingItems.deletedAt))
        .orderBy(
          asc(shoppingItems.completed),
          asc(shoppingItems.position),
          desc(shoppingItems.createdAt)
        );

      // Get all users for username lookups
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
        })
        .from(users);

      const usersById = new Map<number, { firstName: string | null; email: string }>();
      for (const u of allUsers) {
        usersById.set(u.id, { firstName: u.firstName, email: u.email });
      }

      // Map items to response format
      const itemsList = items.map((item) => {
        const addedByUser = item.addedBy ? usersById.get(item.addedBy) : null;
        const completedByUser = item.completedBy ? usersById.get(item.completedBy) : null;

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
          added_by_username: addedByUser?.firstName || addedByUser?.email || null,
          completed_by_username: completedByUser?.firstName || completedByUser?.email || null,
        };
      });

      return { items: itemsList };
    } catch (error) {
      console.error("Error getting shopping items:", error);
      set.status = 500;
      return { error: "Failed to get shopping items" };
    }
  })

  // POST /api/shopping - Add a new shopping item
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { item_name, notes } = body;

      // Validate item name
      const itemName = sanitizeInput((item_name || "").trim());
      if (!itemName) {
        set.status = 400;
        return { error: "Item name is required" };
      }

      // Sanitize notes if provided
      const sanitizedNotes = notes ? sanitizeInput(notes.trim()) : null;

      try {
        // Get max position for incomplete items
        const maxPositionResult = await db
          .select({ maxPos: sql<number>`MAX(${shoppingItems.position})` })
          .from(shoppingItems)
          .where(
            and(
              eq(shoppingItems.completed, false),
              isNull(shoppingItems.deletedAt)
            )
          );

        const newPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;

        // Create item
        const [newItem] = await db
          .insert(shoppingItems)
          .values({
            itemName,
            notes: sanitizedNotes,
            addedBy: user.id,
            position: newPosition,
            completed: false,
            createdAt: nowUtc(),
          })
          .returning();

        console.log(`User ${user.id} added shopping item: ${itemName}`);
        return { success: true, id: newItem.id, message: "Item added successfully" };
      } catch (error) {
        console.error("Error adding shopping item:", error);
        set.status = 500;
        return { error: "Failed to add item" };
      }
    },
    {
      body: t.Object({
        item_name: t.String(),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )

  // POST /api/shopping/:id/toggle - Toggle completion status
  .post(
    "/:id/toggle",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const itemId = parseInt(params.id, 10);
      if (isNaN(itemId)) {
        set.status = 400;
        return { error: "Invalid item ID" };
      }

      try {
        // Get item (not soft-deleted)
        const item = await db.query.shoppingItems.findFirst({
          where: and(
            eq(shoppingItems.id, itemId),
            isNull(shoppingItems.deletedAt)
          ),
        });

        if (!item) {
          set.status = 404;
          return { error: "Item not found" };
        }

        const newStatus = !item.completed;

        // Update item
        await db
          .update(shoppingItems)
          .set({
            completed: newStatus,
            completedBy: newStatus ? user.id : null,
            completedAt: newStatus ? nowUtc() : null,
          })
          .where(eq(shoppingItems.id, itemId));

        const action = newStatus ? "completed" : "uncompleted";
        console.log(`User ${user.id} ${action} shopping item ${itemId}`);

        return { success: true, completed: newStatus };
      } catch (error) {
        console.error(`Error toggling shopping item ${itemId}:`, error);
        set.status = 500;
        return { error: "Failed to toggle item" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // PUT /api/shopping/:id - Update a shopping item
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const itemId = parseInt(params.id, 10);
      if (isNaN(itemId)) {
        set.status = 400;
        return { error: "Invalid item ID" };
      }

      try {
        // Get item (not soft-deleted)
        const item = await db.query.shoppingItems.findFirst({
          where: and(
            eq(shoppingItems.id, itemId),
            isNull(shoppingItems.deletedAt)
          ),
        });

        if (!item) {
          set.status = 404;
          return { error: "Item not found" };
        }

        // Check ownership or admin
        if (item.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        const updateData: Partial<typeof shoppingItems.$inferInsert> = {};

        // Update item_name if provided
        if (body.item_name !== undefined) {
          const itemName = sanitizeInput((body.item_name || "").trim());
          if (!itemName) {
            set.status = 400;
            return { error: "Item name cannot be empty" };
          }
          updateData.itemName = itemName;
        }

        // Update notes if provided
        if (body.notes !== undefined) {
          updateData.notes = body.notes ? sanitizeInput(body.notes.trim()) : null;
        }

        // Apply updates
        if (Object.keys(updateData).length > 0) {
          await db.update(shoppingItems).set(updateData).where(eq(shoppingItems.id, itemId));
        }

        console.log(`User ${user.id} updated shopping item ${itemId}`);
        return { success: true, message: "Item updated successfully" };
      } catch (error) {
        console.error(`Error updating shopping item ${itemId}:`, error);
        set.status = 500;
        return { error: "Failed to update item" };
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
    }
  )

  // DELETE /api/shopping/:id - Delete a shopping item (soft delete)
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const itemId = parseInt(params.id, 10);
      if (isNaN(itemId)) {
        set.status = 400;
        return { error: "Invalid item ID" };
      }

      try {
        // Get item (not already soft-deleted)
        const item = await db.query.shoppingItems.findFirst({
          where: and(
            eq(shoppingItems.id, itemId),
            isNull(shoppingItems.deletedAt)
          ),
        });

        if (!item) {
          set.status = 404;
          return { error: "Item not found" };
        }

        // Check ownership or admin
        if (item.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        // Soft delete by setting deleted_at timestamp
        await db
          .update(shoppingItems)
          .set({ deletedAt: nowUtc() })
          .where(eq(shoppingItems.id, itemId));

        console.log(`User ${user.id} deleted shopping item ${itemId}`);
        return { success: true, message: "Item deleted successfully" };
      } catch (error) {
        console.error(`Error deleting shopping item ${itemId}:`, error);
        set.status = 500;
        return { error: "Failed to delete item" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/shopping/clear-completed - Clear all completed items (soft delete)
  .post("/clear-completed", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      // Get count of completed items (not soft-deleted)
      const completedItems = await db
        .select({ id: shoppingItems.id })
        .from(shoppingItems)
        .where(
          and(
            eq(shoppingItems.completed, true),
            isNull(shoppingItems.deletedAt)
          )
        );

      const count = completedItems.length;

      if (count > 0) {
        // Soft delete all completed items
        await db
          .update(shoppingItems)
          .set({ deletedAt: nowUtc() })
          .where(
            and(
              eq(shoppingItems.completed, true),
              isNull(shoppingItems.deletedAt)
            )
          );
      }

      console.log(`User ${user.id} deleted ${count} completed shopping items`);
      return {
        success: true,
        message: `Deleted ${count} completed items`,
        count,
      };
    } catch (error) {
      console.error("Error deleting completed shopping items:", error);
      set.status = 500;
      return { error: "Failed to delete completed items" };
    }
  })

  // POST /api/shopping/delete-bulk - Delete multiple items (soft delete)
  .post(
    "/delete-bulk",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { item_ids } = body;

      if (!Array.isArray(item_ids) || item_ids.length === 0) {
        set.status = 400;
        return { error: "item_ids must be a non-empty array" };
      }

      // Normalize and validate IDs
      const normalizedIds: number[] = [];
      for (const id of item_ids) {
        const parsedId = typeof id === "string" ? parseInt(id, 10) : id;
        if (isNaN(parsedId)) {
          set.status = 400;
          return { error: `Invalid item_id: ${id}` };
        }
        normalizedIds.push(parsedId);
      }

      // Remove duplicates
      const uniqueIds = [...new Set(normalizedIds)];

      try {
        // Validate ownership for all items
        for (const itemId of uniqueIds) {
          const item = await db.query.shoppingItems.findFirst({
            where: eq(shoppingItems.id, itemId),
          });

          if (item && item.addedBy !== user.id && !user.is_admin) {
            set.status = 403;
            return { error: "Unauthorized" };
          }
        }

        // Get items to delete (not already soft-deleted)
        const itemsToDelete = await db
          .select({ id: shoppingItems.id })
          .from(shoppingItems)
          .where(
            and(
              inArray(shoppingItems.id, uniqueIds),
              isNull(shoppingItems.deletedAt)
            )
          );

        const count = itemsToDelete.length;

        if (count > 0) {
          // Soft delete all matching items
          await db
            .update(shoppingItems)
            .set({ deletedAt: nowUtc() })
            .where(
              and(
                inArray(shoppingItems.id, uniqueIds),
                isNull(shoppingItems.deletedAt)
              )
            );
        }

        console.log(`User ${user.id} deleted ${count} shopping items (bulk)`);
        return {
          success: true,
          message: `Deleted ${count} items`,
          count,
        };
      } catch (error) {
        console.error("Error deleting shopping items in bulk:", error);
        set.status = 500;
        return { error: "Failed to delete items" };
      }
    },
    {
      body: t.Object({
        item_ids: t.Array(t.Union([t.String(), t.Number()])),
      }),
    }
  )

  // POST /api/shopping/reorder - Reorder shopping items
  .post(
    "/reorder",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { item_ids } = body;

      if (!Array.isArray(item_ids)) {
        set.status = 400;
        return { error: "item_ids must be an array" };
      }

      try {
        // Validate and normalize all IDs upfront
        const normalizedIds: number[] = [];
        for (let i = 0; i < item_ids.length; i++) {
          const itemId = typeof item_ids[i] === "string" ? parseInt(item_ids[i] as string, 10) : item_ids[i] as number;
          if (isNaN(itemId)) {
            set.status = 400;
            return { error: `Invalid item_id: ${item_ids[i]}` };
          }
          normalizedIds.push(itemId);
        }

        // Update positions atomically in a transaction
        await db.transaction(async (tx) => {
          for (let i = 0; i < normalizedIds.length; i++) {
            await tx
              .update(shoppingItems)
              .set({ position: i })
              .where(
                and(
                  eq(shoppingItems.id, normalizedIds[i]),
                  isNull(shoppingItems.deletedAt)
                )
              );
          }
        });

        console.log(`User ${user.id} reordered shopping items`);
        return { success: true, message: "Shopping items reordered successfully" };
      } catch (error) {
        console.error("Error reordering shopping items:", error);
        set.status = 500;
        return { error: "Failed to reorder shopping items" };
      }
    },
    {
      body: t.Object({
        item_ids: t.Array(t.Union([t.String(), t.Number()])),
      }),
    }
  );
