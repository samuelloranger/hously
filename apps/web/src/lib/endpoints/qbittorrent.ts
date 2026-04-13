export const QBITTORRENT_ENDPOINTS = {
  STATUS: "/api/dashboard/qbittorrent/status",
  STREAM: "/api/dashboard/qbittorrent/stream",
  PINNED: "/api/dashboard/qbittorrent/pinned",
  TORRENTS: "/api/dashboard/qbittorrent/torrents",
  TORRENTS_STREAM: "/api/dashboard/qbittorrent/torrents/stream",
  OPTIONS: "/api/dashboard/qbittorrent/options",
  CATEGORIES: "/api/dashboard/qbittorrent/categories",
  TAGS: "/api/dashboard/qbittorrent/tags",
  ADD_MAGNET: "/api/dashboard/qbittorrent/torrents/add-magnet",
  ADD_FILE: "/api/dashboard/qbittorrent/torrents/add-file",
  TORRENT_STREAM: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/stream`,
  PROPERTIES: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/properties`,
  TRACKERS: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/trackers`,
  FILES: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/files`,
  PEERS: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/peers`,
  PEERS_STREAM: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/peers/stream`,
  RENAME: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/rename`,
  RENAME_FILE: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/rename-file`,
  SET_CATEGORY: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/set-category`,
  SET_TAGS: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/set-tags`,
  PAUSE: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/pause`,
  RESUME: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/resume`,
  REANNOUNCE: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/reannounce`,
  DELETE: (hash: string) =>
    `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/delete`,
} as const;

export const QBITTORRENT_TORRENTS_PAGE_SIZE = 50;

export function buildQbittorrentTorrentsStreamUrl(
  base: string,
  offset: number,
): string {
  return `${base}?offset=${offset}&limit=${QBITTORRENT_TORRENTS_PAGE_SIZE}`;
}
