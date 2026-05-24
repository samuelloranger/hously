import type {
  QbittorrentIntegrationConfig,
  QbittorrentTorrentListItem,
  QbittorrentTorrentProperties,
} from "./clientTypes";
import {
  toRecord,
  toTorrentListItem,
  toTorrentProperties,
} from "./clientNormalizers";
import { qbFetchJson } from "./clientFetch";

export const fetchQbittorrentTorrent = async (
  config: QbittorrentIntegrationConfig,
  enabled: boolean,
  hash: string,
): Promise<{
  enabled: boolean;
  connected: boolean;
  torrent: QbittorrentTorrentListItem | null;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, torrent: null };
  const safeHash = hash.trim();
  if (!safeHash) {
    return {
      enabled: true,
      connected: false,
      torrent: null,
      error: "Missing torrent hash",
    };
  }

  try {
    const path = `/api/v2/torrents/info?hashes=${encodeURIComponent(safeHash)}`;
    const payload = await qbFetchJson<unknown>(config, path);
    const rawTorrent = Array.isArray(payload) ? payload[0] : null;
    const rawRecord = toRecord(rawTorrent);

    if (!rawRecord) {
      return {
        enabled: true,
        connected: true,
        torrent: null,
        error: "Torrent not found",
      };
    }

    const torrent = toTorrentListItem(rawRecord);
    if (!torrent) {
      return {
        enabled: true,
        connected: false,
        torrent: null,
        error: "Invalid torrent payload",
      };
    }

    return { enabled: true, connected: true, torrent };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      torrent: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

export const fetchQbittorrentTorrentProperties = async (
  config: QbittorrentIntegrationConfig,
  enabled: boolean,
  hash: string,
): Promise<{
  enabled: boolean;
  connected: boolean;
  properties: QbittorrentTorrentProperties | null;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, properties: null };
  const safeHash = hash.trim();
  if (!safeHash) {
    return {
      enabled: true,
      connected: false,
      properties: null,
      error: "Missing torrent hash",
    };
  }

  try {
    const path = `/api/v2/torrents/properties?hash=${encodeURIComponent(safeHash)}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const properties = toTorrentProperties(raw);
    if (!properties) {
      return {
        enabled: true,
        connected: false,
        properties: null,
        error: "Invalid properties payload",
      };
    }
    return { enabled: true, connected: true, properties };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      properties: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};
