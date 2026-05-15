import { status } from "minecraft-server-util";

export interface PingResult {
  is_online: boolean;
  online_players: number | null;
  max_players: number | null;
  version: string | null;
  motd: string | null;
  latency_ms: number | null;
  favicon: string | null;
  player_sample: Array<{ name: string; id: string }> | null;
}

export async function pingMinecraftServer(
  host: string,
  port: number,
): Promise<PingResult> {
  try {
    const result = await status(host, port, { timeout: 5000 });
    return {
      is_online: true,
      online_players: result.players.online,
      max_players: result.players.max,
      version: result.version.name,
      motd: result.motd.clean,
      latency_ms: result.roundTripLatency,
      favicon: result.favicon ?? null,
      player_sample: result.players.sample ?? null,
    };
  } catch {
    return {
      is_online: false,
      online_players: null,
      max_players: null,
      version: null,
      motd: null,
      latency_ms: null,
      favicon: null,
      player_sample: null,
    };
  }
}
