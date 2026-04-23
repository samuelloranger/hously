import { getQbittorrentIntegrationConfig } from "@hously/api/services/qbittorrent/config";
import {
  buildQbittorrentDisabledSnapshot,
  fetchQbittorrentSnapshot,
} from "@hously/api/services/qbittorrent/torrents";
import type { QbittorrentDashboardSnapshot } from "@hously/api/services/qbittorrent/client";

export const getQbittorrentSnapshot =
  async (): Promise<QbittorrentDashboardSnapshot> => {
    const { enabled, config } = await getQbittorrentIntegrationConfig();

    if (!enabled || !config) {
      const snapshot = buildQbittorrentDisabledSnapshot(
        enabled && !config
          ? "qBittorrent integration is enabled but not configured"
          : undefined,
      );
      return enabled ? { ...snapshot, enabled: true } : snapshot;
    }

    return fetchQbittorrentSnapshot(config, true);
  };
