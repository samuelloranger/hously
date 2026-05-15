import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { serverError } from "@hously/api/errors";
import { requireUser } from "@hously/api/middleware/auth";
import { formatServer } from "@hously/api/utils/minecraft/format";

export const minecraftDashboardRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/minecraft", async ({ set }) => {
    try {
      const servers = await prisma.minecraftServer.findMany({
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
      });
      return { servers: servers.map(formatServer) };
    } catch (error) {
      console.error("Error fetching Minecraft dashboard data:", error);
      return serverError(set, "Failed to fetch Minecraft dashboard data");
    }
  });
