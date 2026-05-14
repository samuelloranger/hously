import { Elysia } from "elysia";
import { getQbittorrentIntegrationConfig } from "@hously/api/services/qbittorrent/config";
import { qbFetchJson } from "@hously/api/services/qbittorrent/client";

interface QbTransferInfo {
  dl_info_speed: number;
  ul_info_speed: number;
  connection_status: string;
}

export const dashboardDownloadsRoutes = new Elysia().get(
  "/downloads/speed",
  async () => {
    const { enabled, config } = await getQbittorrentIntegrationConfig();

    if (!enabled || !config) {
      return { enabled: false, connected: false, dl_speed: 0, ul_speed: 0 };
    }

    try {
      const info = await qbFetchJson<QbTransferInfo>(
        config,
        "/api/v2/transfer/info",
      );
      return {
        enabled: true,
        connected: info.connection_status !== "disconnected",
        dl_speed: Math.max(0, info.dl_info_speed ?? 0),
        ul_speed: Math.max(0, info.ul_info_speed ?? 0),
      };
    } catch {
      return { enabled: true, connected: false, dl_speed: 0, ul_speed: 0 };
    }
  },
);
