import type { MinecraftServerEntry } from "@hously/shared/types/integrations";

export type MinecraftServerRow = {
  id: number;
  name: string;
  host: string;
  port: number;
  pollIntervalMinutes: number;
  enabled: boolean;
  isOnline: boolean;
  onlinePlayers: number | null;
  maxPlayers: number | null;
  version: string | null;
  motd: string | null;
  latencyMs: number | null;
  favicon: string | null;
  playerSample: unknown;
  lastCheckedAt: Date | null;
};

export function formatServer(s: MinecraftServerRow): MinecraftServerEntry {
  return {
    id: s.id,
    name: s.name,
    host: s.host,
    port: s.port,
    poll_interval_minutes: s.pollIntervalMinutes as 5 | 15 | 30 | 60,
    enabled: s.enabled,
    is_online: s.isOnline,
    online_players: s.onlinePlayers,
    max_players: s.maxPlayers,
    version: s.version,
    motd: s.motd,
    latency_ms: s.latencyMs,
    favicon: s.favicon,
    player_sample:
      (s.playerSample as Array<{ name: string; id: string }>) ?? null,
    last_checked_at: s.lastCheckedAt?.toISOString() ?? null,
  };
}
