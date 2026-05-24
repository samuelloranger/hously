import { Elysia, t } from "elysia";
import {
  saveImageAndCreateThumbnail,
  getImage,
  getThumbnail,
  getContentType,
} from "@hously/api/services/imageService";
import { validateImageFile } from "@hously/api/utils";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { logActivity } from "@hously/api/utils/activityLogs";
import { prisma } from "@hously/api/db";
import { requireUser } from "@hously/api/middleware/auth";

export const choreStatsRoutes = new Elysia()
  .use(requireUser)
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
        const imagePath = await saveImageAndCreateThumbnail(image);

        await logActivity({
          type: "chore_image_uploaded",
          userId: user!.id,
          payload: { image_path: imagePath },
        });
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
    async ({ user: _user, params, set }) => {
      const { filename } = params;

      if (filename.includes("..") || filename.startsWith("/")) {
        return badRequest(set, "Invalid filename");
      }

      try {
        const imageBuffer = await getImage(filename);

        if (!imageBuffer) {
          return notFound(set, "Image not found");
        }

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
    async ({ user: _user, params, set }) => {
      const { filename } = params;

      if (filename.includes("..") || filename.startsWith("/")) {
        return badRequest(set, "Invalid filename");
      }

      try {
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
        for (let i = 0; i < chore_ids.length; i++) {
          if (isNaN(chore_ids[i])) {
            return badRequest(set, `Invalid chore_id: ${chore_ids[i]}`);
          }
        }

        await prisma.$transaction(async (tx) => {
          for (let i = 0; i < chore_ids.length; i++) {
            await tx.chore.update({
              where: { id: chore_ids[i] },
              data: { position: i },
            });
          }
        });

        await logActivity({
          type: "chore_reordered",
          userId: user!.id,
          payload: { count: chore_ids.length },
        });
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
