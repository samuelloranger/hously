import { prisma } from "@hously/api/db";
import {
  getJsonCache,
  setJsonCache,
  deleteCache,
} from "@hously/api/services/cache";
import { decrypt } from "@hously/api/services/crypto";
import {
  toRecord,
  toStringOrNull,
  clampInt,
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_MAX_ITEMS,
} from "./client";
import type { QbittorrentIntegrationConfig } from "./client";

export const normalizeQbittorrentConfig = (
  config: unknown,
): QbittorrentIntegrationConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const websiteUrl = toStringOrNull(cfg.website_url);
  const username = toStringOrNull(cfg.username);
  let password = toStringOrNull(cfg.password);
  if (password) {
    try {
      password = decrypt(password);
    } catch {
      // Keep legacy plaintext values working until they are re-saved.
    }
  }
  if (!websiteUrl || !username || !password) return null;

  let webhookSecret = toStringOrNull(cfg.webhook_secret);
  if (webhookSecret) {
    try {
      webhookSecret = decrypt(webhookSecret);
    } catch {
      // Keep legacy plaintext values working until they are re-saved.
    }
  }

  return {
    website_url: websiteUrl.replace(/\/+$/, ""),
    username,
    password,
    poll_interval_seconds: clampInt(
      cfg.poll_interval_seconds,
      1,
      30,
      DEFAULT_POLL_INTERVAL_SECONDS,
    ),
    max_items: clampInt(cfg.max_items, 3, 30, DEFAULT_MAX_ITEMS),
    ...(webhookSecret ? { webhook_secret: webhookSecret } : {}),
  };
};

// --- Integration config cache (Redis, 24h TTL) ---

const INTEGRATION_CONFIG_CACHE_KEY = "qbittorrent:integration_config";
const INTEGRATION_CONFIG_CACHE_TTL_SECONDS = 86400; // 24h -- invalidated on settings save

export const getQbittorrentIntegrationConfig = async (): Promise<{
  enabled: boolean;
  config: QbittorrentIntegrationConfig | null;
}> => {
  const cached = await getJsonCache<{
    enabled: boolean;
    config: QbittorrentIntegrationConfig | null;
  }>(INTEGRATION_CONFIG_CACHE_KEY);
  if (cached) return cached;

  const integration = await prisma.integration.findFirst({
    where: { type: "qbittorrent" },
    select: { enabled: true, config: true },
  });

  const enabled = integration?.enabled ?? false;
  const config = enabled
    ? normalizeQbittorrentConfig(integration?.config)
    : null;
  const result = { enabled, config };
  await setJsonCache(
    INTEGRATION_CONFIG_CACHE_KEY,
    result,
    INTEGRATION_CONFIG_CACHE_TTL_SECONDS,
  );
  return result;
};

export const invalidateQbittorrentIntegrationConfigCache = async () => {
  await deleteCache(INTEGRATION_CONFIG_CACHE_KEY);
};
