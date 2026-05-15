import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { serverError } from "@hously/api/errors";
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

export const minecraftDashboardRoutes = new Elysia()
  .use(auth)
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
