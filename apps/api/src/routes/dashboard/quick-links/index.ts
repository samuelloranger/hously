import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser, requireAdmin } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, serverError } from "@hously/api/errors";
import type { QuickLink } from "@hously/shared/types";

function isQuickLinkArray(value: unknown): value is QuickLink[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as QuickLink).id === "string" &&
        typeof (item as QuickLink).label === "string" &&
        typeof (item as QuickLink).url === "string",
    )
  );
}

export const dashboardQuickLinksRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/quick-links", async ({ set }) => {
    try {
      const row = await prisma.appSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });
      const links = isQuickLinkArray(row.quickLinks) ? row.quickLinks : [];
      return { quick_links: links };
    } catch {
      return serverError(set, "Failed to load quick links");
    }
  })
  .put(
    "/quick-links",
    async ({ body, set, user }) => {
      if (!user?.is_admin) {
        set.status = 403;
        return { error: "Admin access required" };
      }
      try {
        if (body.quick_links.length > 20) {
          return badRequest(set, "Maximum 20 quick links allowed");
        }
        const row = await prisma.appSettings.upsert({
          where: { id: 1 },
          create: { id: 1, quickLinks: body.quick_links as object[] },
          update: { quickLinks: body.quick_links as object[] },
        });
        const links = isQuickLinkArray(row.quickLinks) ? row.quickLinks : [];
        return { quick_links: links };
      } catch {
        return serverError(set, "Failed to save quick links");
      }
    },
    {
      body: t.Object({
        quick_links: t.Array(
          t.Object({
            id: t.String(),
            label: t.String({ maxLength: 32 }),
            url: t.String({ maxLength: 512 }),
          }),
        ),
      }),
    },
  );
