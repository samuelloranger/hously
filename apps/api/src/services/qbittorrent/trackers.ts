import {
  type QbittorrentPluginConfig,
  type QbittorrentTorrentTracker,
  qbFetchJson,
  toTorrentTracker,
} from "./client";

export const fetchQbittorrentTorrentTrackers = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string,
): Promise<{
  enabled: boolean;
  connected: boolean;
  trackers: QbittorrentTorrentTracker[];
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, trackers: [] };
  const safeHash = hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      trackers: [],
      error: "Missing torrent hash",
    };

  try {
    const path = `/api/v2/torrents/trackers?hash=${encodeURIComponent(safeHash)}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const trackers = Array.isArray(raw)
      ? raw
          .map(toTorrentTracker)
          .filter((row): row is QbittorrentTorrentTracker => Boolean(row))
      : [];
    return { enabled: true, connected: true, trackers };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      trackers: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};
