import { Elysia, t } from "elysia";
import { prisma } from "@hously/api/db";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { serverError } from "@hously/api/errors";

export const searchRoutes = new Elysia({ prefix: "/api/search" })
  .use(auth)
  .use(requireUser)
  .get(
    "/quick",
    async ({ query, set }) => {
      try {
        const q = (query.q ?? "").trim().toLowerCase();
        const limit = Math.min(parseInt(query.limit || "6", 10) || 6, 20);

        const empty = {
          medias: [],
          users: [],
        };

        if (!q || q.length < 2) {
          return empty;
        }

        const users = await prisma.user.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        });

        // Medias from library
        let medias: {
          id: number;
          title: string;
          type: string;
          year: number | null;
          status: string;
        }[] = [];
        try {
          medias = await prisma.libraryMedia.findMany({
            where: { title: { contains: q, mode: "insensitive" } },
            take: limit,
            select: {
              id: true,
              title: true,
              type: true,
              year: true,
              status: true,
            },
          });
        } catch {
          // library table not yet available — return empty
        }

        return {
          medias,
          users: users.map((u) => ({
            id: u.id,
            name: u.firstName
              ? `${u.firstName}${u.lastName ? ` ${u.lastName}` : ""}`
              : u.email,
            email: u.email,
          })),
        };
      } catch (error) {
        console.error("Error in quick search:", error);
        return serverError(set, "Search failed");
      }
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
  );
