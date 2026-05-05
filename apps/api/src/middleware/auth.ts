import { Elysia } from "elysia";
import { auth as betterAuth } from "@hously/api/lib/auth";
import { prisma } from "@hously/api/db";
import { mapUser } from "@hously/api/utils/mappers";

export const resolveUser = async (request: Request) => {
  const session = await betterAuth.api.getSession({ headers: request.headers });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  return user ? mapUser(user) : null;
};

export const requireUser = (app: Elysia) =>
  app
    .resolve(async ({ request }) => ({ user: await resolveUser(request) }))
    .onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
    });

export const requireAdmin = (app: Elysia) =>
  app
    .resolve(async ({ request }) => ({ user: await resolveUser(request) }))
    .onBeforeHandle(({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (!user.is_admin) {
        set.status = 403;
        return { error: "Forbidden" };
      }
    });
