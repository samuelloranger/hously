import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { sanitizeInput } from "@hously/api/utils";
import { badRequest, notFound, serverError } from "@hously/api/errors";

export const boardTagsRoutes = new Elysia({ prefix: "/api/board-tags" })
  .use(auth)
  .use(requireUser)
  .get("/", async ({ set }) => {
    try {
      const tags = await prisma.boardTag.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tasks: true } } },
      });

      return {
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          task_count: tag._count.tasks,
          created_at: tag.createdAt.toISOString(),
        })),
      };
    } catch (error) {
      console.error("Error listing board tags:", error);
      return serverError(set, "Failed to list board tags");
    }
  })

  .post(
    "/",
    async ({ body, set }) => {
      const name = sanitizeInput((body.name || "").trim().toLowerCase());
      if (!name) return badRequest(set, "Tag name is required");

      try {
        const existing = await prisma.boardTag.findUnique({ where: { name } });
        if (existing) return badRequest(set, "Tag already exists");

        const tag = await prisma.boardTag.create({
          data: { name, color: body.color ?? null },
        });

        return {
          tag: { id: tag.id, name: tag.name, color: tag.color, task_count: 0 },
        };
      } catch (error) {
        console.error("Error creating board tag:", error);
        return serverError(set, "Failed to create tag");
      }
    },
    {
      body: t.Object({
        name: t.String(),
        color: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) return badRequest(set, "Invalid id");

      try {
        const existing = await prisma.boardTag.findUnique({ where: { id } });
        if (!existing) return notFound(set, "Tag not found");

        const data: { name?: string; color?: string | null } = {};

        if (body.name !== undefined) {
          const name = sanitizeInput(body.name.trim().toLowerCase());
          if (!name) return badRequest(set, "Tag name cannot be empty");
          const conflict = await prisma.boardTag.findFirst({
            where: { name, NOT: { id } },
          });
          if (conflict) return badRequest(set, "Tag name already in use");
          data.name = name;
        }

        if ("color" in body) {
          data.color = body.color ?? null;
        }

        const tag = await prisma.boardTag.update({ where: { id }, data });

        return { tag: { id: tag.id, name: tag.name, color: tag.color } };
      } catch (error) {
        console.error("Error updating board tag:", error);
        return serverError(set, "Failed to update tag");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        color: t.Optional(t.Nullable(t.String())),
      }),
    },
  )

  .delete(
    "/:id",
    async ({ params, body, set }) => {
      const id = Number(params.id);
      if (Number.isNaN(id)) return badRequest(set, "Invalid id");

      try {
        const existing = await prisma.boardTag.findUnique({ where: { id } });
        if (!existing) return notFound(set, "Tag not found");

        if (body?.merge_into_id) {
          const mergeId = body.merge_into_id;
          const target = await prisma.boardTag.findUnique({
            where: { id: mergeId },
          });
          if (!target) return notFound(set, "Merge target tag not found");

          const tasksWithSourceTag = await prisma.boardTask.findMany({
            where: { boardTags: { some: { id } } },
            select: { id: true },
          });

          await prisma.$transaction([
            ...tasksWithSourceTag.map((task) =>
              prisma.boardTask.update({
                where: { id: task.id },
                data: { boardTags: { connect: { id: mergeId } } },
              }),
            ),
            prisma.boardTag.delete({ where: { id } }),
          ]);
        } else {
          await prisma.boardTag.delete({ where: { id } });
        }

        return { success: true };
      } catch (error) {
        console.error("Error deleting board tag:", error);
        return serverError(set, "Failed to delete tag");
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(
        t.Object({
          merge_into_id: t.Optional(t.Number()),
        }),
      ),
    },
  );
