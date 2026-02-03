import { Elysia, t } from "elysia";
import { db } from "../db";
import { recipes, recipeIngredients, users } from "../db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { auth } from "../auth";
import { saveImageAndCreateThumbnail, deleteImageFiles, getImage } from "../services/imageService";
import { formatIso, nowUtc, sanitizeInput, sanitizeRichText } from "../utils";

export const recipesRoutes = new Elysia({ prefix: "/api/recipes" })
  .use(auth)
  // GET /api/recipes - Get all recipes
  .get("/", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    try {
      // Get all recipes with user info
      const allRecipes = await db
        .select({
          id: recipes.id,
          name: recipes.name,
          description: recipes.description,
          instructions: recipes.instructions,
          category: recipes.category,
          servings: recipes.servings,
          prepTimeMinutes: recipes.prepTimeMinutes,
          cookTimeMinutes: recipes.cookTimeMinutes,
          imagePath: recipes.imagePath,
          isFavorite: recipes.isFavorite,
          addedBy: recipes.addedBy,
          createdAt: recipes.createdAt,
          updatedAt: recipes.updatedAt,
          userFirstName: users.firstName,
          userEmail: users.email,
        })
        .from(recipes)
        .leftJoin(users, eq(recipes.addedBy, users.id))
        .orderBy(desc(recipes.isFavorite), desc(recipes.createdAt));

      // Get ingredient counts for each recipe
      const ingredientCounts = await db
        .select({
          recipeId: recipeIngredients.recipeId,
        })
        .from(recipeIngredients);

      const countMap = new Map<number, number>();
      for (const ing of ingredientCounts) {
        countMap.set(ing.recipeId, (countMap.get(ing.recipeId) || 0) + 1);
      }

      const recipesList = allRecipes.map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        instructions: recipe.instructions,
        category: recipe.category,
        servings: recipe.servings,
        prep_time_minutes: recipe.prepTimeMinutes,
        cook_time_minutes: recipe.cookTimeMinutes,
        image_path: recipe.imagePath,
        is_favorite: recipe.isFavorite,
        added_by: recipe.addedBy,
        created_at: formatIso(recipe.createdAt),
        updated_at: formatIso(recipe.updatedAt),
        added_by_username: recipe.userFirstName || recipe.userEmail || null,
        ingredient_count: countMap.get(recipe.id) || 0,
      }));

      return { recipes: recipesList };
    } catch (error) {
      console.error("Error getting recipes:", error);
      set.status = 500;
      return { error: "Failed to get recipes" };
    }
  })

  // GET /api/recipes/:id - Get single recipe with ingredients
  .get(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        set.status = 400;
        return { error: "Invalid recipe ID" };
      }

      try {
        // Get recipe with user info
        const recipeResult = await db
          .select({
            id: recipes.id,
            name: recipes.name,
            description: recipes.description,
            instructions: recipes.instructions,
            category: recipes.category,
            servings: recipes.servings,
            prepTimeMinutes: recipes.prepTimeMinutes,
            cookTimeMinutes: recipes.cookTimeMinutes,
            imagePath: recipes.imagePath,
            isFavorite: recipes.isFavorite,
            addedBy: recipes.addedBy,
            createdAt: recipes.createdAt,
            updatedAt: recipes.updatedAt,
            userFirstName: users.firstName,
            userEmail: users.email,
          })
          .from(recipes)
          .leftJoin(users, eq(recipes.addedBy, users.id))
          .where(eq(recipes.id, recipeId))
          .limit(1);

        if (recipeResult.length === 0) {
          set.status = 404;
          return { error: "Recipe not found" };
        }

        const recipe = recipeResult[0];

        // Get ingredients
        const ingredients = await db
          .select()
          .from(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipeId))
          .orderBy(asc(recipeIngredients.position));

        const ingredientsList = ingredients.map((ing) => ({
          id: ing.id,
          name: ing.name,
          quantity: ing.quantity ? parseFloat(ing.quantity) : null,
          unit: ing.unit,
          position: ing.position,
        }));

        return {
          recipe: {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            instructions: recipe.instructions,
            category: recipe.category,
            servings: recipe.servings,
            prep_time_minutes: recipe.prepTimeMinutes,
            cook_time_minutes: recipe.cookTimeMinutes,
            image_path: recipe.imagePath,
            is_favorite: recipe.isFavorite,
            added_by: recipe.addedBy,
            created_at: formatIso(recipe.createdAt),
            updated_at: formatIso(recipe.updatedAt),
            added_by_username: recipe.userFirstName || recipe.userEmail || null,
            ingredients: ingredientsList,
          },
        };
      } catch (error) {
        console.error("Error getting recipe detail:", error);
        set.status = 500;
        return { error: "Failed to get recipe" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/recipes - Create a new recipe
  .post(
    "/",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const {
          name,
          description,
          instructions,
          category,
          servings,
          prep_time_minutes,
          cook_time_minutes,
          image_path,
          ingredients,
        } = body;

        // Validate required fields
        const nameTrimmed = (name || "").trim();
        if (!nameTrimmed) {
          set.status = 400;
          return { error: "Recipe name is required" };
        }

        const instructionsTrimmed = (instructions || "").trim();
        if (!instructionsTrimmed) {
          set.status = 400;
          return { error: "Instructions are required" };
        }

        // Validate servings
        const servingsNum = servings || 4;
        if (servingsNum <= 0) {
          set.status = 400;
          return { error: "Servings must be positive" };
        }

        // Sanitize inputs
        const sanitizedName = sanitizeInput(nameTrimmed);
        const sanitizedDescription = description
          ? sanitizeInput(description.trim())
          : null;
        const sanitizedInstructions = sanitizeRichText(instructionsTrimmed);

        // Create recipe
        const [newRecipe] = await db
          .insert(recipes)
          .values({
            name: sanitizedName,
            description: sanitizedDescription,
            instructions: sanitizedInstructions,
            category: category?.trim() || null,
            servings: servingsNum,
            prepTimeMinutes: prep_time_minutes || null,
            cookTimeMinutes: cook_time_minutes || null,
            imagePath: image_path || null,
            isFavorite: 0,
            addedBy: user.id,
            createdAt: nowUtc(),
          })
          .returning();

        // Add ingredients
        if (ingredients && ingredients.length > 0) {
          for (let idx = 0; idx < ingredients.length; idx++) {
            const ingData = ingredients[idx];
            const ingName = (ingData.name || "").trim();
            if (!ingName) continue;

            await db.insert(recipeIngredients).values({
              recipeId: newRecipe.id,
              name: sanitizeInput(ingName),
              quantity: ingData.quantity?.toString() || null,
              unit: ingData.unit?.trim() || null,
              position: idx,
            });
          }
        }

        console.log(`User ${user.id} created recipe ${newRecipe.id}`);

        set.status = 201;
        return {
          success: true,
          data: { id: newRecipe.id },
          message: "Recipe created successfully",
        };
      } catch (error) {
        console.error("Error creating recipe:", error);
        set.status = 500;
        return { error: "Failed to add recipe" };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        instructions: t.String(),
        category: t.Optional(t.Union([t.String(), t.Null()])),
        servings: t.Optional(t.Number()),
        prep_time_minutes: t.Optional(t.Union([t.Number(), t.Null()])),
        cook_time_minutes: t.Optional(t.Union([t.Number(), t.Null()])),
        image_path: t.Optional(t.Union([t.String(), t.Null()])),
        ingredients: t.Optional(
          t.Array(
            t.Object({
              name: t.String(),
              quantity: t.Optional(t.Union([t.Number(), t.Null()])),
              unit: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
      }),
    }
  )

  // PUT /api/recipes/:id - Update a recipe
  .put(
    "/:id",
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        set.status = 400;
        return { error: "Invalid recipe ID" };
      }

      try {
        // Get recipe
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, recipeId),
        });

        if (!recipe) {
          set.status = 404;
          return { error: "Recipe not found" };
        }

        // Check ownership or admin
        if (recipe.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        const updateData: Partial<typeof recipes.$inferInsert> = {};

        // Update name if provided
        if (body.name !== undefined) {
          const name = (body.name || "").trim();
          if (!name) {
            set.status = 400;
            return { error: "Recipe name cannot be empty" };
          }
          updateData.name = sanitizeInput(name);
        }

        // Update description if provided
        if (body.description !== undefined) {
          updateData.description = body.description
            ? sanitizeInput(body.description.trim())
            : null;
        }

        // Update instructions if provided
        if (body.instructions !== undefined) {
          const instructions = (body.instructions || "").trim();
          if (!instructions) {
            set.status = 400;
            return { error: "Instructions cannot be empty" };
          }
          updateData.instructions = sanitizeRichText(instructions);
        }

        // Update category if provided
        if (body.category !== undefined) {
          updateData.category = body.category?.trim() || null;
        }

        // Update servings if provided
        if (body.servings !== undefined) {
          if (body.servings <= 0) {
            set.status = 400;
            return { error: "Servings must be positive" };
          }
          updateData.servings = body.servings;
        }

        // Update prep_time_minutes if provided
        if (body.prep_time_minutes !== undefined) {
          updateData.prepTimeMinutes = body.prep_time_minutes;
        }

        // Update cook_time_minutes if provided
        if (body.cook_time_minutes !== undefined) {
          updateData.cookTimeMinutes = body.cook_time_minutes;
        }

        // Handle image updates
        if (body.image_path !== undefined) {
          // Delete old image if exists
          if (recipe.imagePath) {
            await deleteImageFiles(recipe.imagePath);
          }
          updateData.imagePath = body.image_path;
        } else if (body.remove_image) {
          if (recipe.imagePath) {
            await deleteImageFiles(recipe.imagePath);
          }
          updateData.imagePath = null;
        }

        // Handle ingredients update
        if (body.ingredients !== undefined) {
          // Delete existing ingredients
          await db
            .delete(recipeIngredients)
            .where(eq(recipeIngredients.recipeId, recipeId));

          // Add new ingredients
          for (let idx = 0; idx < body.ingredients.length; idx++) {
            const ingData = body.ingredients[idx];
            const ingName = (ingData.name || "").trim();
            if (!ingName) continue;

            await db.insert(recipeIngredients).values({
              recipeId,
              name: sanitizeInput(ingName),
              quantity: ingData.quantity?.toString() || null,
              unit: ingData.unit?.trim() || null,
              position: idx,
            });
          }
        }

        // Update timestamp
        updateData.updatedAt = nowUtc();

        // Apply updates
        if (Object.keys(updateData).length > 0) {
          await db.update(recipes).set(updateData).where(eq(recipes.id, recipeId));
        }

        console.log(`User ${user.id} updated recipe ${recipeId}`);

        return { success: true, message: "Recipe updated successfully" };
      } catch (error) {
        console.error(`Error updating recipe ${recipeId}:`, error);
        set.status = 500;
        return { error: "Failed to update recipe" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.Union([t.String(), t.Null()])),
        instructions: t.Optional(t.String()),
        category: t.Optional(t.Union([t.String(), t.Null()])),
        servings: t.Optional(t.Number()),
        prep_time_minutes: t.Optional(t.Union([t.Number(), t.Null()])),
        cook_time_minutes: t.Optional(t.Union([t.Number(), t.Null()])),
        image_path: t.Optional(t.Union([t.String(), t.Null()])),
        remove_image: t.Optional(t.Boolean()),
        ingredients: t.Optional(
          t.Array(
            t.Object({
              name: t.String(),
              quantity: t.Optional(t.Union([t.Number(), t.Null()])),
              unit: t.Optional(t.Union([t.String(), t.Null()])),
            })
          )
        ),
      }),
    }
  )

  // DELETE /api/recipes/:id - Delete a recipe
  .delete(
    "/:id",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        set.status = 400;
        return { error: "Invalid recipe ID" };
      }

      try {
        // Get recipe
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, recipeId),
        });

        if (!recipe) {
          set.status = 404;
          return { error: "Recipe not found" };
        }

        // Check ownership or admin
        if (recipe.addedBy !== user.id && !user.is_admin) {
          set.status = 403;
          return { error: "Unauthorized" };
        }

        // Delete associated image files
        if (recipe.imagePath) {
          await deleteImageFiles(recipe.imagePath);
        }

        // Delete ingredients first (no cascade)
        await db
          .delete(recipeIngredients)
          .where(eq(recipeIngredients.recipeId, recipeId));

        // Delete recipe
        await db.delete(recipes).where(eq(recipes.id, recipeId));

        console.log(`User ${user.id} deleted recipe ${recipeId}`);

        return { success: true, message: "Recipe deleted successfully" };
      } catch (error) {
        console.error(`Error deleting recipe ${recipeId}:`, error);
        set.status = 500;
        return { error: "Failed to delete recipe" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/recipes/:id/toggle-favorite - Toggle favorite status
  .post(
    "/:id/toggle-favorite",
    async ({ user, params, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        set.status = 400;
        return { error: "Invalid recipe ID" };
      }

      try {
        // Get recipe
        const recipe = await db.query.recipes.findFirst({
          where: eq(recipes.id, recipeId),
        });

        if (!recipe) {
          set.status = 404;
          return { error: "Recipe not found" };
        }

        // Toggle favorite
        const newFavorite = recipe.isFavorite === 0 ? 1 : 0;

        await db
          .update(recipes)
          .set({
            isFavorite: newFavorite,
            updatedAt: nowUtc(),
          })
          .where(eq(recipes.id, recipeId));

        console.log(`User ${user.id} toggled recipe ${recipeId} favorite to ${newFavorite}`);

        return { success: true, is_favorite: newFavorite };
      } catch (error) {
        console.error("Error toggling recipe favorite:", error);
        set.status = 500;
        return { error: "Failed to toggle favorite" };
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  // POST /api/recipes/upload-image - Upload recipe image
  .post(
    "/upload-image",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      try {
        const file = body.image;
        if (!file) {
          set.status = 400;
          return { error: "No image file provided" };
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save image and create thumbnail
        const imagePath = await saveImageAndCreateThumbnail(
          buffer,
          file.name,
          file.type
        );

        console.log(`Recipe image upload successful - image_path: ${imagePath}`);

        return {
          success: true,
          data: {
            image_path: imagePath,
          },
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("Invalid file type")) {
          set.status = 400;
          return { error: error.message };
        }
        console.error("Error uploading recipe image:", error);
        set.status = 500;
        return { error: "Failed to upload image" };
      }
    },
    {
      body: t.Object({
        image: t.File(),
      }),
    }
  )

  // GET /api/recipes/image/:filename - Serve recipe image
  .get(
    "/image/*",
    async ({ params, set }) => {
      try {
        const filename = params["*"];

        // Security: ensure filename doesn't contain path traversal
        if (filename.includes("..") || filename.startsWith("/")) {
          set.status = 400;
          return { error: "Invalid filename" };
        }

        const result = await getImage(filename);

        if (!result) {
          set.status = 404;
          return { error: "Image not found" };
        }

        set.headers["Content-Type"] = result.contentType;
        set.headers["Cache-Control"] = "public, max-age=31536000";

        return new Response(result.buffer);
      } catch (error) {
        console.error("Error serving recipe image:", error);
        set.status = 500;
        return { error: "Failed to serve image" };
      }
    },
    {
      params: t.Object({
        "*": t.String(),
      }),
    }
  );
