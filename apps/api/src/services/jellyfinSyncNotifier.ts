import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeJellyfinSyncConfig } from "@hously/api/utils/integrations/normalizers";
import type { JellyfinUserMapping } from "@hously/api/utils/integrations/types";

interface SyncParams {
  houslyUserId: string;
  tmdbId: number;
  mediaType: string;
  action: "added" | "removed";
}

interface SyncPayload {
  jellyfin_user_id: string;
  tmdb_id: number;
  media_type: string;
  action: "added" | "removed";
}

export function buildSyncPayload(
  params: SyncParams,
  mappings: JellyfinUserMapping[],
): SyncPayload | null {
  const mapping = mappings.find(
    (m) => m.hously_user_id === params.houslyUserId,
  );
  if (!mapping) return null;
  return {
    jellyfin_user_id: mapping.jellyfin_user_id,
    tmdb_id: params.tmdbId,
    media_type: params.mediaType,
    action: params.action,
  };
}

export async function notifyJellyfinWatchlistChange(
  params: SyncParams,
): Promise<void> {
  try {
    const integration = await getIntegrationConfigRecord("jellyfin");
    if (!integration?.enabled) return;

    const syncConfig = normalizeJellyfinSyncConfig(integration.config);
    if (!syncConfig?.website_url || !syncConfig.sync_token) return;

    const payload = buildSyncPayload(params, syncConfig.user_mappings);
    if (!payload) return;

    await fetch(`${syncConfig.website_url}/hously/webhook/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${syncConfig.sync_token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (e) {
    console.warn("[jellyfinSyncNotifier] Failed to notify:", e);
  }
}
