import { prisma } from "@hously/api/db";
import { pingMinecraftServer } from "@hously/api/utils/minecraft/ping";
import { sendWebPushNotification } from "@hously/api/utils/webpush";
import type { PushSubscription } from "@hously/api/utils/webpush";

export async function pollMinecraftServers(): Promise<void> {
  const integration = await prisma.integration.findFirst({
    where: { type: "minecraft" },
  });
  if (!integration?.enabled) return;

  const servers = await prisma.minecraftServer.findMany({
    where: { enabled: true },
  });

  const now = new Date();

  for (const server of servers) {
    const minutesSinceCheck = server.lastCheckedAt
      ? (now.getTime() - new Date(server.lastCheckedAt).getTime()) / 60_000
      : Infinity;

    if (minutesSinceCheck < server.pollIntervalMinutes) continue;

    const pingResult = await pingMinecraftServer(server.host, server.port);
    const statusChanged = pingResult.is_online !== server.isOnline;

    await prisma.minecraftServer.update({
      where: { id: server.id },
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
        lastStatusChangeAt: statusChanged ? now : server.lastStatusChangeAt,
        updatedAt: now,
      },
    });

    if (statusChanged) {
      await notifyStatusChange(server.name, pingResult.is_online);
    }
  }
}

async function notifyStatusChange(serverName: string, isOnline: boolean): Promise<void> {
  const subscriptions = await prisma.userSubscription.findMany();

  for (const sub of subscriptions) {
    let subscriptionInfo: PushSubscription;
    try {
      subscriptionInfo = JSON.parse(sub.subscriptionInfo) as PushSubscription;
    } catch {
      continue;
    }

    const result = await sendWebPushNotification(subscriptionInfo, {
      title: "Minecraft Server",
      body: isOnline ? `${serverName} is back online` : `${serverName} is offline`,
      tag: `minecraft-status-${serverName}`,
      data: { notification_type: "minecraft_status" },
    });

    if (result.expired) {
      await prisma.userSubscription.delete({ where: { id: sub.id } });
    }
  }
}
