import type { Prisma } from "@prisma/client";
import { prisma } from "@hously/api/db";

const TTL_MS = 60_000;

type PluginConfigRow = {
  enabled: boolean;
  config: Prisma.JsonValue | null;
};

const cache = new Map<string, { at: number; row: PluginConfigRow | null }>();

/** Drop cached plugin row(s). Call after admin updates plugin settings if immediate consistency is required. */
export function invalidatePluginConfigCache(pluginType?: string): void {
  if (pluginType) {
    cache.delete(pluginType);
  } else {
    cache.clear();
  }
}

/**
 * Short-lived in-memory cache (60s TTL) for `prisma.plugin.findFirst({ where: { type } })`
 * with `{ enabled, config }`. Reduces duplicate DB hits across services and dashboard utils.
 */
export async function getPluginConfigRecord(
  pluginType: string,
): Promise<PluginConfigRow | null> {
  const now = Date.now();
  const hit = cache.get(pluginType);
  if (hit && now - hit.at < TTL_MS) {
    return hit.row;
  }

  const plugin = await prisma.plugin.findFirst({
    where: { type: pluginType },
    select: { enabled: true, config: true },
  });

  const row: PluginConfigRow | null = plugin
    ? { enabled: plugin.enabled, config: plugin.config ?? null }
    : null;

  cache.set(pluginType, { at: now, row });
  return row;
}
