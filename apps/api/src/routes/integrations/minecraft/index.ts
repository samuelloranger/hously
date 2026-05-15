import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";
import { logActivity } from "@hously/api/utils/activityLogs";
import { pingMinecraftServer } from "@hously/api/utils/minecraft/ping";
import type { MinecraftServerEntry } from "@hously/shared/types/integrations";

function formatServer(s: {
  id: number;
  name: string;
  host: string;
  port: number;
  pollIntervalMinutes: number;
  enabled: boolean;
  widgetView: string;
  isOnline: boolean;
  onlinePlayers: number | null;
  maxPlayers: number | null;
  version: string | null;
  motd: string | null;
  latencyMs: number | null;
  favicon: string | null;
  playerSample: unknown;
  lastCheckedAt: Date | null;
}): MinecraftServerEntry {
  return {
    id: s.id,
    name: s.name,
    host: s.host,
    port: s.port,
    poll_interval_minutes: s.pollIntervalMinutes as 5 | 15 | 30 | 60,
    enabled: s.enabled,
    widget_view: s.widgetView as "compact" | "cards",
    is_online: s.isOnline,
    online_players: s.onlinePlayers,
    max_players: s.maxPlayers,
    version: s.version,
    motd: s.motd,
    latency_ms: s.latencyMs,
    favicon: s.favicon,
    player_sample: (s.playerSample as Array<{ name: string; id: string }>) ?? null,
    last_checked_at: s.lastCheckedAt?.toISOString() ?? null,
  };
}

const POLL_INTERVALS = [5, 15, 30, 60];

export const minecraftIntegrationRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/minecraft", async ({ set }) => {
    try {
      const integration = await prisma.integration.findFirst({
        where: { type: "minecraft" },
      });
      return {
        integration: {
          type: "minecraft",
          enabled: integration?.enabled ?? false,
        },
      };
    } catch (error) {
      console.error("Error fetching Minecraft integration:", error);
      return serverError(set, "Failed to fetch Minecraft integration");
    }
  })
  .put(
    "/minecraft",
    async ({ body, user, set }) => {
      try {
        const now = nowUtc();
        const integration = await prisma.integration.upsert({
          where: { type: "minecraft" },
          update: { enabled: body.enabled, updatedAt: now },
          create: {
            type: "minecraft",
            enabled: body.enabled,
            createdAt: now,
            updatedAt: now,
          },
        });
        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "minecraft" },
        });
        return { success: true, integration: { type: "minecraft", enabled: integration.enabled } };
      } catch (error) {
        console.error("Error updating Minecraft integration:", error);
        return serverError(set, "Failed to update Minecraft integration");
      }
    },
    { body: t.Object({ enabled: t.Boolean() }) },
  )
  .get("/minecraft/servers", async ({ set }) => {
    try {
      const servers = await prisma.minecraftServer.findMany({
        orderBy: { createdAt: "asc" },
      });
      return { servers: servers.map(formatServer) };
    } catch (error) {
      console.error("Error fetching Minecraft servers:", error);
      return serverError(set, "Failed to fetch Minecraft servers");
    }
  })
  .post(
    "/minecraft/servers",
    async ({ body, user, set }) => {
      if (!POLL_INTERVALS.includes(body.poll_interval_minutes)) {
        return badRequest(set, "poll_interval_minutes must be 5, 15, 30, or 60");
      }
      if (!["compact", "cards"].includes(body.widget_view)) {
        return badRequest(set, "widget_view must be compact or cards");
      }
      try {
        const now = nowUtc();
        const server = await prisma.minecraftServer.create({
          data: {
            name: body.name,
            host: body.host.trim(),
            port: body.port,
            pollIntervalMinutes: body.poll_interval_minutes,
            enabled: body.enabled,
            widgetView: body.widget_view,
            createdAt: now,
            updatedAt: now,
          },
        });
        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "minecraft", server_id: server.id },
        });
        return { success: true, server: formatServer(server) };
      } catch (error) {
        console.error("Error creating Minecraft server:", error);
        return serverError(set, "Failed to create Minecraft server");
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        host: t.String({ minLength: 1 }),
        port: t.Number({ minimum: 1, maximum: 65535 }),
        poll_interval_minutes: t.Number(),
        enabled: t.Boolean(),
        widget_view: t.String(),
      }),
    },
  )
  .put(
    "/minecraft/servers/:id",
    async ({ params, body, user, set }) => {
      const id = Number(params.id);
      if (!POLL_INTERVALS.includes(body.poll_interval_minutes)) {
        return badRequest(set, "poll_interval_minutes must be 5, 15, 30, or 60");
      }
      if (!["compact", "cards"].includes(body.widget_view)) {
        return badRequest(set, "widget_view must be compact or cards");
      }
      try {
        const server = await prisma.minecraftServer.update({
          where: { id },
          data: {
            name: body.name,
            host: body.host.trim(),
            port: body.port,
            pollIntervalMinutes: body.poll_interval_minutes,
            enabled: body.enabled,
            widgetView: body.widget_view,
            updatedAt: nowUtc(),
          },
        });
        await logActivity({
          type: "integration_updated",
          userId: user!.id,
          payload: { integration_type: "minecraft", server_id: server.id },
        });
        return { success: true, server: formatServer(server) };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === "P2025") {
          return badRequest(set, "Server not found");
        }
        console.error("Error updating Minecraft server:", error);
        return serverError(set, "Failed to update Minecraft server");
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        host: t.String({ minLength: 1 }),
        port: t.Number({ minimum: 1, maximum: 65535 }),
        poll_interval_minutes: t.Number(),
        enabled: t.Boolean(),
        widget_view: t.String(),
      }),
    },
  )
  .delete("/minecraft/servers/:id", async ({ params, user, set }) => {
    const id = Number(params.id);
    try {
      await prisma.minecraftServer.delete({ where: { id } });
      await logActivity({
        type: "integration_updated",
        userId: user!.id,
        payload: { integration_type: "minecraft", server_id: id, action: "deleted" },
      });
      return { success: true };
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2025") {
        return badRequest(set, "Server not found");
      }
      console.error("Error deleting Minecraft server:", error);
      return serverError(set, "Failed to delete Minecraft server");
    }
  })
  .post("/minecraft/servers/:id/ping", async ({ params, set }) => {
    const id = Number(params.id);
    try {
      const server = await prisma.minecraftServer.findUnique({ where: { id } });
      if (!server) return badRequest(set, "Server not found");

      const pingResult = await pingMinecraftServer(server.host, server.port);
      const now = nowUtc();
      const updated = await prisma.minecraftServer.update({
        where: { id },
        data: {
          isOnline: pingResult.is_online,
          onlinePlayers: pingResult.online_players,
          maxPlayers: pingResult.max_players,
          version: pingResult.version,
          motd: pingResult.motd,
          latencyMs: pingResult.latency_ms,
          favicon: pingResult.favicon,
          playerSample: pingResult.player_sample ?? undefined,
          lastCheckedAt: now,
          lastStatusChangeAt:
            pingResult.is_online !== server.isOnline ? now : server.lastStatusChangeAt,
          updatedAt: now,
        },
      });
      return { success: true, server: formatServer(updated) };
    } catch (error) {
      console.error("Error pinging Minecraft server:", error);
      return serverError(set, "Failed to ping Minecraft server");
    }
  });
