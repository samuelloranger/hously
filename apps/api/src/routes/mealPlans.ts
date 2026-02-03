import { Elysia, t } from "elysia";
import { db } from "../db";
import { mealPlans, recipes, recipeIngredients, shoppingItems, users } from "../db/schema";
import { eq, and, gte, lte, asc, desc, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { auth } from "../auth";
import { formatIso, nowUtc, parseDate, sanitizeInput } from "../utils";

// Valid meal types
const VALID_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

export const mealPlansRoutes = new Elysia({ prefix: "/api/meal-plans" })
  .use(auth)
  // GET /api/meal-plans - Get all meal plans
  .get(
    "/",
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        // Optional date range filtering
        const startDateStr = query.start_date;
        const endDateStr = query.end_date;

        let mealPlansList = await db
          .select({
            id: mealPlans.id,
            recipeId: mealPlans.recipeId,
            plannedDate: mealPlans.plannedDate,
            mealType: mealPlans.mealType,
            notes: mealPlans.notes,
            addedBy: mealPlans.addedBy,
            createdAt: mealPlans.createdAt,
            recipeName: recipes.name,
            recipeImagePath: recipes.imagePath,
          })
          .from(mealPlans)
          .leftJoin(recipes, eq(mealPlans.recipeId, recipes.id))
          .orderBy(asc(mealPlans.plannedDate));

        // Apply date filters if provided
        if (startDateStr) {
          const startDate = parseDate(startDateStr);
          if (!startDate) {
            set.status = 400;
            return { error: "Invalid start_date format" };
          }
          mealPlansList = mealPlansList.filter((mp) => {
            if (!mp.plannedDate) return false;
            return mp.plannedDate >= startDateStr;
          });
        }

        if (endDateStr) {
          const endDate = parseDate(endDateStr);
          if (!endDate) {
            set.status = 400;
            return { error: "Invalid end_date format" };
          }
          mealPlansList = mealPlansList.filter((mp) => {
            if (!mp.plannedDate) return false;
            return mp.plannedDate <= endDateStr;
          });
        }

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

        // Build response
        const response = mealPlansList.map((mp) => {
          const addedByUser = mp.addedBy ? usersById.get(mp.addedBy) : null;

          return {
            id: mp.id,
            recipe_id: mp.recipeId,
            planned_date: mp.plannedDate,
            meal_type: mp.mealType,
            notes: mp.notes,
            added_by: mp.addedBy,
            created_at: formatIso(mp.createdAt),
            recipe_name: mp.recipeName,
            recipe_image_path: mp.recipeImagePath,
            added_by_username:
              addedByUser?.firstName || addedByUser?.email || null,
          };
        });

        return { meal_plans: response };
      } catch (error) {
        console.error("Error getting meal plans:", error);
        set.status = 500;
        return { error: "Failed to get meal plans" };
      }
    },
    {
      query: t.Object({
        start_date: t.Optional(t.String()),
        end_date: t.Optional(t.String()),
      }),
    }
  )

  // POST /api/meal-plans - Add a new meal plan
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const { recipe_id, planned_date, meal_type, notes } = body;

        // Validate required fields
        if (!recipe_id) {
          set.status = 400;
          return { error: "recipe_id is required" };
        }

        if (!planned_date) {
          set.status = 400;
          return { error: "planned_date is required" };
        }

        const mealTypeTrimmed = (meal_type || "").trim();
        if (!mealTypeTrimmed) {
          set.status = 400;
          return { error: "meal_type is required" };
        }

        // Validate meal_type
        if (!VALID_MEAL_TYPES.includes(mealTypeTrimmed)) {
          set.status = 400;
          return {
            error: `meal_type must be one of: ${VALID_MEAL_TYPES.join(", ")}`,
          };
        }

        // Parse and validate planned_date
        const parsedDate = parseDate(planned_date);
        if (!parsedDate) {
          set.status = 400;
          return { error: "Invalid planned_date format. Use YYYY-MM-DD" };
        }

        // Verify recipe exists
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, recipe_id),
        });

        if (!recipe) {
          set.status = 404;
          return { error: "Recipe not found" };
        }

        // Sanitize notes
        const sanitizedNotes = notes ? sanitizeInput(notes.trim()) : null;

        // Create meal plan
        const [newMealPlan] = await db
          .insert(mealPlans)
          .values({
            recipeId: recipe_id,
            plannedDate: planned_date,
            mealType: mealTypeTrimmed,
            notes: sanitizedNotes,
            addedBy: user.id,
            createdAt: nowUtc(),
          })
          .returning();

        console.log(`User ${user.id} created meal plan ${newMealPlan.id}`);

        return {
          success: true,
          id: newMealPlan.id,
          message: "Meal plan created successfully",
        };
      } catch (error) {
        console.error("Error creating meal plan:", error);
        set.status = 500;
        return { error: "Failed to add meal plan" };
      }
    },
    {
      body: t.Object({
        recipe_id: t.Number(),
        planned_date: t.String(),
        meal_type: t.String(),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )

  // PUT /api/meal-plans/:id - Update a meal plan
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const mealPlanId = parseInt(params.id, 10);
      if (isNaN(mealPlanId)) {
        set.status = 400;
        return { error: "Invalid meal plan ID" };
      }

      try {
        // Get meal plan
        const mealPlan = await db.query.mealPlans.findFirst({
          where: eq(mealPlans.id, mealPlanId),
        });

        if (!mealPlan) {
          set.status = 404;
          return { error: "Meal plan not found" };
        }

        // Check ownership or admin
        if (mealPlan.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        const updateData: Partial<typeof mealPlans.$inferInsert> = {};

        // Update recipe_id if provided
        if (body.recipe_id !== undefined) {
          if (!body.recipe_id) {
            set.status = 400;
            return { error: "recipe_id cannot be empty" };
          }

          // Verify recipe exists
          const recipe = await db.query.recipes.findFirst({
            where: eq(recipes.id, body.recipe_id),
          });

          if (!recipe) {
            set.status = 404;
            return { error: "Recipe not found" };
          }

          updateData.recipeId = body.recipe_id;
        }

        // Update planned_date if provided
        if (body.planned_date !== undefined) {
          if (!body.planned_date) {
            set.status = 400;
            return { error: "planned_date cannot be empty" };
          }

          const parsedDate = parseDate(body.planned_date);
          if (!parsedDate) {
            set.status = 400;
            return { error: "Invalid planned_date format. Use YYYY-MM-DD" };
          }

          updateData.plannedDate = body.planned_date;
        }

        // Update meal_type if provided
        if (body.meal_type !== undefined) {
          const mealTypeTrimmed = (body.meal_type || "").trim();
          if (!mealTypeTrimmed) {
            set.status = 400;
            return { error: "meal_type cannot be empty" };
          }

          if (!VALID_MEAL_TYPES.includes(mealTypeTrimmed)) {
            set.status = 400;
            return {
              error: `meal_type must be one of: ${VALID_MEAL_TYPES.join(", ")}`,
            };
          }

          updateData.mealType = mealTypeTrimmed;
        }

        // Update notes if provided
        if (body.notes !== undefined) {
          updateData.notes = body.notes ? sanitizeInput(body.notes.trim()) : null;
        }

        // Apply updates
        if (Object.keys(updateData).length > 0) {
          await db
            .update(mealPlans)
            .set(updateData)
            .where(eq(mealPlans.id, mealPlanId));
        }

        console.log(`User ${user.id} updated meal plan ${mealPlanId}`);

        return { success: true, message: "Meal plan updated successfully" };
      } catch (error) {
        console.error(`Error updating meal plan ${mealPlanId}:`, error);
        set.status = 500;
        return { error: "Failed to update meal plan" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        recipe_id: t.Optional(t.Number()),
        planned_date: t.Optional(t.String()),
        meal_type: t.Optional(t.String()),
        notes: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    }
  )

  // DELETE /api/meal-plans/:id - Delete a meal plan
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const mealPlanId = parseInt(params.id, 10);
      if (isNaN(mealPlanId)) {
        set.status = 400;
        return { error: "Invalid meal plan ID" };
      }

      try {
        // Get meal plan
        const mealPlan = await db.query.mealPlans.findFirst({
          where: eq(mealPlans.id, mealPlanId),
        });

        if (!mealPlan) {
          set.status = 404;
          return { error: "Meal plan not found" };
        }

        // Check ownership or admin
        if (mealPlan.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        // Delete meal plan
        await db.delete(mealPlans).where(eq(mealPlans.id, mealPlanId));

        console.log(`User ${user.id} deleted meal plan ${mealPlanId}`);

        return { success: true, message: "Meal plan deleted successfully" };
      } catch (error) {
        console.error(`Error deleting meal plan ${mealPlanId}:`, error);
        set.status = 500;
        return { error: "Failed to delete meal plan" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/meal-plans/:id/add-to-shopping - Add ingredients to shopping list
  .post(
    "/:id/add-to-shopping",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const mealPlanId = parseInt(params.id, 10);
      if (isNaN(mealPlanId)) {
        set.status = 400;
        return { error: "Invalid meal plan ID" };
      }

      try {
        // Get meal plan with recipe
        const mealPlan = await db.query.mealPlans.findFirst({
          where: eq(mealPlans.id, mealPlanId),
        });

        if (!mealPlan) {
          set.status = 404;
          return { error: "Meal plan not found" };
        }

        // Get recipe and its ingredients
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, mealPlan.recipeId),
        });

        if (!recipe) {
          set.status = 400;
          return { error: "Recipe not found" };
        }

        const ingredients = await db
          .select()
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipe.id))
          .orderBy(asc(recipeIngredients.position));

        if (ingredients.length === 0) {
          set.status = 400;
          return { error: "Recipe has no ingredients" };
        }

        // Get max position for shopping items
        const maxPositionResult = await db
          .select({ maxPos: sql<number>`MAX(${shoppingItems.position})` })
          .from(shoppingItems)
          .where(
            and(
              eq(shoppingItems.completed, false),
              isNull(shoppingItems.deletedAt)
            )
          );

        let newPosition = (maxPositionResult[0]?.maxPos ?? -1) + 1;

        // Add each ingredient to shopping list
        let addedCount = 0;
        for (const ingredient of ingredients) {
          // Format ingredient name with quantity and unit
          const quantityStr = ingredient.quantity
            ? `${parseFloat(ingredient.quantity)} `
            : "";
          const unitStr = ingredient.unit ? `${ingredient.unit} ` : "";
          const itemName = `${quantityStr}${unitStr}${ingredient.name}`;

          await db.insert(shoppingItems).values({
            itemName,
            completed: false,
            addedBy: user.id,
            position: newPosition + addedCount,
            createdAt: nowUtc(),
          });

          addedCount++;
        }

        console.log(
          `User ${user.id} added ${addedCount} ingredients from meal plan ${mealPlanId} to shopping list`
        );

        return {
          success: true,
          message: `Added ${addedCount} ingredients to shopping list`,
          count: addedCount,
        };
      } catch (error) {
        console.error(
          `Error adding meal plan ingredients to shopping:`,
          error
        );
        set.status = 500;
        return { error: "Failed to add ingredients to shopping list" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  );
