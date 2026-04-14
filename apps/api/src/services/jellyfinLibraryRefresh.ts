import { getPluginConfigRecord } from "@hously/api/services/pluginConfigCache";
import { normalizeJellyfinConfig } from "@hously/api/utils/plugins/normalizers";

/**
 * Fires a POST /Library/Refresh to Jellyfin so it picks up newly post-processed files.
 * Silently no-ops if the plugin is disabled or not configured.
 */
export async function triggerJellyfinLibraryScan(): Promise<void> {
  try {
    const plugin = await getPluginConfigRecord("jellyfin");
    if (!plugin?.enabled) return;

    const config = normalizeJellyfinConfig(plugin.config);
    if (!config?.website_url || !config?.api_key) return;

    const url = `${config.website_url}/Library/Refresh`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `MediaBrowser Token="${config.api_key}"` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(
        `[jellyfinLibraryRefresh] Scan request returned ${res.status}`,
      );
    }
  } catch (e) {
    // Non-fatal — Jellyfin being down must not break post-processing.
    console.warn("[jellyfinLibraryRefresh] Failed to trigger library scan:", e);
  }
}
