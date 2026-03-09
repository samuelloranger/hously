import { Elysia, t } from 'elysia';
import { prisma } from '../db';
import { auth } from '../auth';
import { saveImageAndCreateThumbnail, deleteImageFiles, getImage, getContentType } from '../services/imageService';
import { formatIso, nowUtc, sanitizeInput } from '../utils';
import { logActivity } from '../utils/activityLogs';
import { badRequest, forbidden, notFound, serverError, unauthorized } from '../utils/errors';
import { hasUpdates } from '../utils/updates';

export const recipesRoutes = new Elysia({ prefix: '/api/recipes' })
  .use(auth)
  // GET /api/recipes - Get all recipes
  .get('/', async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, 'Unauthorized');
    }

    try {
      // Get all recipes with user info
      const allRecipes = await prisma.recipe.findMany({
        include: {
          _count: {
            select: { ingredients: true },
          },
        },
        orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }],
      });

      // Get all users for username lookup
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          firstName: true,
          email: true,
        },
      });

      const usersById = new Map<number, { firstName: string | null; email: string }>();
      for (const u of allUsers) {
        usersById.set(u.id, { firstName: u.firstName, email: u.email });
      }

      const recipesList = allRecipes.map(recipe => {
        const addedByUser = recipe.addedBy ? usersById.get(recipe.addedBy) : null;
        return {
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
          added_by_username: addedByUser?.firstName || addedByUser?.email || null,
          ingredient_count: recipe._count.ingredients,
        };
      });

      return { recipes: recipesList };
    } catch (error) {
      console.error('Error getting recipes:', error);
      return serverError(set, 'Failed to get recipes');
    }
  })

  // GET /api/recipes/:id - Get single recipe with ingredients
  .get(
    '/:id',
    async ({ user, params, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        return badRequest(set, 'Invalid recipe ID');
      }

      try {
        // Get recipe
        const recipe = await prisma.recipe.findFirst({
          where: { id: recipeId },
        });

        if (!recipe) {
          return notFound(set, 'Recipe not found');
        }

        // Get user info for addedBy
        let addedByUsername: string | null = null;
        if (recipe.addedBy) {
          const addedByUser = await prisma.user.findFirst({
            where: { id: recipe.addedBy },
            select: { firstName: true, email: true },
          });
          if (addedByUser) {
            addedByUsername = addedByUser.firstName || addedByUser.email || null;
          }
        }

        // Get ingredients
        const ingredients = await prisma.recipeIngredient.findMany({
          where: { recipeId },
          orderBy: { position: 'asc' },
        });

        const ingredientsList = ingredients.map(ing => ({
          id: ing.id,
          name: ing.name,
          quantity: ing.quantity ? parseFloat(ing.quantity.toString()) : null,
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
            added_by_username: addedByUsername,
            ingredients: ingredientsList,
          },
        };
      } catch (error) {
        console.error('Error getting recipe detail:', error);
        return serverError(set, 'Failed to get recipe');
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
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
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
        const nameTrimmed = (name || '').trim();
        if (!nameTrimmed) {
          return badRequest(set, 'Recipe name is required');
        }

        const instructionsTrimmed = (instructions || '').trim();
        if (!instructionsTrimmed) {
          return badRequest(set, 'Instructions are required');
        }

        // Validate servings
        const servingsNum = servings || 4;
        if (servingsNum <= 0) {
          return badRequest(set, 'Servings must be positive');
        }

        // Sanitize inputs (Markdown is stored as plain text, no HTML escaping needed)
        const sanitizedName = sanitizeInput(nameTrimmed);
        const sanitizedDescription = description ? sanitizeInput(description.trim()) : null;
        // Instructions are Markdown - store as-is without HTML sanitization
        const sanitizedInstructions = instructionsTrimmed;

        // Create recipe
        const newRecipe = await prisma.recipe.create({
          data: {
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
          },
        });

        // Add ingredients
        if (ingredients && ingredients.length > 0) {
          for (let idx = 0; idx < ingredients.length; idx++) {
            const ingData = ingredients[idx];
            const ingName = (ingData.name || '').trim();
            if (!ingName) continue;

            await prisma.recipeIngredient.create({
              data: {
                recipeId: newRecipe.id,
                name: sanitizeInput(ingName),
                quantity: ingData.quantity?.toString() || null,
                unit: ingData.unit?.trim() || null,
                position: idx,
              },
            });
          }
        }

        console.log(`User ${user.id} created recipe ${newRecipe.id}`);
        await logActivity({
          type: 'recipe_added',
          userId: user.id,
          payload: { recipe_id: newRecipe.id, recipe_name: newRecipe.name },
        });

        set.status = 201;
        return {
          success: true,
          message: 'Recipe created successfully',
          recipe: {
            id: newRecipe.id,
            name: newRecipe.name,
            description: newRecipe.description,
            instructions: newRecipe.instructions,
            category: newRecipe.category,
            servings: newRecipe.servings,
            prep_time_minutes: newRecipe.prepTimeMinutes,
            cook_time_minutes: newRecipe.cookTimeMinutes,
            image_path: newRecipe.imagePath,
            is_favorite: newRecipe.isFavorite,
            added_by: newRecipe.addedBy,
            created_at: formatIso(newRecipe.createdAt),
            updated_at: formatIso(newRecipe.updatedAt),
          },
        };
      } catch (error) {
        console.error('Error creating recipe:', error);
        return serverError(set, 'Failed to add recipe');
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
    '/:id',
    async ({ user, params, body, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        return badRequest(set, 'Invalid recipe ID');
      }

      try {
        // Get recipe
        const recipe = await prisma.recipe.findFirst({
          where: { id: recipeId },
        });

        if (!recipe) {
          return notFound(set, 'Recipe not found');
        }

        // Check ownership or admin
        if (recipe.addedBy !== user.id && !user.is_admin) {
          return forbidden(set, 'Unauthorized');
        }

        const updateData: Record<string, any> = {};

        // Update name if provided
        if (body.name !== undefined) {
          const name = (body.name || '').trim();
          if (!name) {
            return badRequest(set, 'Recipe name cannot be empty');
          }
          updateData.name = sanitizeInput(name);
        }

        // Update description if provided
        if (body.description !== undefined) {
          updateData.description = body.description ? sanitizeInput(body.description.trim()) : null;
        }

        // Update instructions if provided
        if (body.instructions !== undefined) {
          const instructions = (body.instructions || '').trim();
          if (!instructions) {
            return badRequest(set, 'Instructions cannot be empty');
          }
          // Instructions are Markdown - store as-is without HTML sanitization
          updateData.instructions = instructions;
        }

        // Update category if provided
        if (body.category !== undefined) {
          updateData.category = body.category?.trim() || null;
        }

        // Update servings if provided
        if (body.servings !== undefined) {
          if (body.servings <= 0) {
            return badRequest(set, 'Servings must be positive');
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
          await prisma.recipeIngredient.deleteMany({
            where: { recipeId },
          });

          // Add new ingredients
          for (let idx = 0; idx < body.ingredients.length; idx++) {
            const ingData = body.ingredients[idx];
            const ingName = (ingData.name || '').trim();
            if (!ingName) continue;

            await prisma.recipeIngredient.create({
              data: {
                recipeId,
                name: sanitizeInput(ingName),
                quantity: ingData.quantity?.toString() || null,
                unit: ingData.unit?.trim() || null,
                position: idx,
              },
            });
          }
        }

        // Update timestamp
        updateData.updatedAt = nowUtc();

        // Apply updates
        let updatedRecipe;
        if (hasUpdates(updateData)) {
          updatedRecipe = await prisma.recipe.update({
            where: { id: recipeId },
            data: updateData,
          });
        } else {
          updatedRecipe = recipe;
        }

        await logActivity({
          type: 'recipe_updated',
          userId: user.id,
          payload: { recipe_id: updatedRecipe.id, recipe_name: updatedRecipe.name },
        });

        return {
          success: true,
          message: 'Recipe updated successfully',
          recipe: {
            id: updatedRecipe.id,
            name: updatedRecipe.name,
            description: updatedRecipe.description,
            instructions: updatedRecipe.instructions,
            category: updatedRecipe.category,
            servings: updatedRecipe.servings,
            prep_time_minutes: updatedRecipe.prepTimeMinutes,
            cook_time_minutes: updatedRecipe.cookTimeMinutes,
            image_path: updatedRecipe.imagePath,
            is_favorite: updatedRecipe.isFavorite,
            added_by: updatedRecipe.addedBy,
            created_at: formatIso(updatedRecipe.createdAt),
            updated_at: formatIso(updatedRecipe.updatedAt),
          },
        };
      } catch (error) {
        console.error(`Error updating recipe ${recipeId}:`, error);
        return serverError(set, 'Failed to update recipe');
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
    '/:id',
    async ({ user, params, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        return badRequest(set, 'Invalid recipe ID');
      }

      try {
        // Get recipe
        const recipe = await prisma.recipe.findFirst({
          where: { id: recipeId },
        });

        if (!recipe) {
          return notFound(set, 'Recipe not found');
        }

        // Check ownership or admin
        if (recipe.addedBy !== user.id && !user.is_admin) {
          return forbidden(set, 'Unauthorized');
        }

        // Delete associated image files
        if (recipe.imagePath) {
          await deleteImageFiles(recipe.imagePath);
        }

        // Delete ingredients first (no cascade)
        await prisma.recipeIngredient.deleteMany({
          where: { recipeId },
        });

        // Delete recipe
        await prisma.recipe.delete({
          where: { id: recipeId },
        });

        console.log(`User ${user.id} deleted recipe ${recipeId}`);
        await logActivity({
          type: 'recipe_deleted',
          userId: user.id,
          payload: { recipe_id: recipeId, recipe_name: recipe.name },
        });

        return { success: true, message: 'Recipe deleted successfully' };
      } catch (error) {
        console.error(`Error deleting recipe ${recipeId}:`, error);
        return serverError(set, 'Failed to delete recipe');
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
    '/:id/toggle-favorite',
    async ({ user, params, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      const recipeId = parseInt(params.id, 10);
      if (isNaN(recipeId)) {
        return badRequest(set, 'Invalid recipe ID');
      }

      try {
        // Get recipe
        const recipe = await prisma.recipe.findFirst({
          where: { id: recipeId },
        });

        if (!recipe) {
          return notFound(set, 'Recipe not found');
        }

        // Toggle favorite
        const newFavorite = recipe.isFavorite === 0 ? 1 : 0;

        await prisma.recipe.update({
          where: { id: recipeId },
          data: {
            isFavorite: newFavorite,
            updatedAt: nowUtc(),
          },
        });

        console.log(`User ${user.id} toggled recipe ${recipeId} favorite to ${newFavorite}`);

        return { success: true, is_favorite: newFavorite };
      } catch (error) {
        console.error('Error toggling recipe favorite:', error);
        return serverError(set, 'Failed to toggle favorite');
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
    '/upload-image',
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      try {
        const file = body.image;
        if (!file) {
          return badRequest(set, 'No image file provided');
        }

        // Save image and create thumbnail
        const imagePath = await saveImageAndCreateThumbnail(file);

        console.log(`Recipe image upload successful - image_path: ${imagePath}`);

        return {
          success: true,
          data: {
            image_path: imagePath,
          },
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid file type')) {
          return badRequest(set, error.message);
        }
        console.error('Error uploading recipe image:', error);
        return serverError(set, 'Failed to upload image');
      }
    },
    {
      body: t.Object({
        image: t.File(),
      }),
    }
  )

  // GET /api/recipes/image/:filename - Serve recipe image (public)
  .get(
    '/image/*',
    async ({ params, set }) => {
      try {
        const filename = params['*'] || '';

        // Security: ensure filename doesn't contain path traversal
        if (filename.includes('..') || filename.startsWith('/')) {
          return badRequest(set, 'Invalid filename');
        }

        const imageBuffer = await getImage(filename);

        if (!imageBuffer) {
          return notFound(set, 'Image not found');
        }

        const contentType = getContentType(filename);

        return new Response(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
          },
        });
      } catch (error) {
        console.error('Error serving recipe image:', error);
        return serverError(set, 'Failed to serve image');
      }
    },
    {
      params: t.Object({
        '*': t.String(),
      }),
    }
  );
