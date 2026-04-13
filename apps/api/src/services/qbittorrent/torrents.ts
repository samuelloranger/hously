import { QBITTORRENT_TORRENTS_PAGE_SIZE } from "@hously/shared";
import {
  type QbittorrentPluginConfig,
  type QbittorrentDashboardTorrent,
  type QbittorrentTorrentListItem,
  type QbittorrentTorrentProperties,
  type QbittorrentTorrentFile,
  type QbittorrentTorrentPeer,
  type QbittorrentCategory,
  type QbittorrentCategoryRaw,
  type QbittorrentDashboardSnapshot,
  type QbittorrentListTorrentsParams,
  DOWNLOAD_STATES,
  STALLED_STATES,
  SEEDING_STATES,
  DEFAULT_POLL_INTERVAL_SECONDS,
  toRecord,
  toStringOrNull,
  toNumberOr,
  toTorrent,
  toTorrentListItem,
  toTorrentProperties,
  toTorrentFile,
  toPeersSnapshot,
  qbFetchJson,
  qbFetchText,
  fetchMaindata,
} from "./client";

// --- Filtering & sorting helpers ---

const MAINDATA_STATE_FILTER_MAP: Record<string, (state: string) => boolean> = {
  downloading: (s) => DOWNLOAD_STATES.has(s),
  seeding: (s) => SEEDING_STATES.has(s),
  completed: (s) =>
    s === "uploading" ||
    s === "pausedUP" ||
    s === "stoppedUP" ||
    s === "stalledUP" ||
    s === "queuedUP" ||
    s === "forcedUP",
  paused: (s) => s.startsWith("paused") || s.startsWith("stopped"),
  active: (s) =>
    DOWNLOAD_STATES.has(s) ||
    SEEDING_STATES.has(s) ||
    s === "uploading" ||
    s === "forcedUP" ||
    s === "forcedDL",
  inactive: (s) =>
    !DOWNLOAD_STATES.has(s) &&
    !SEEDING_STATES.has(s) &&
    s !== "uploading" &&
    s !== "forcedUP" &&
    s !== "forcedDL",
  stalled: (s) => STALLED_STATES.has(s),
  errored: (s) => s === "error" || s === "missingFiles",
};

const applyStateFilter = (
  torrents: Record<string, unknown>[],
  filter?: string,
): Record<string, unknown>[] => {
  if (!filter || filter === "all") return torrents;
  const predicate = MAINDATA_STATE_FILTER_MAP[filter];
  if (!predicate) return torrents;
  return torrents.filter((t) => {
    const state = typeof t.state === "string" ? t.state : "";
    return predicate(state);
  });
};

const applyCategoryFilter = (
  torrents: Record<string, unknown>[],
  category?: string,
): Record<string, unknown>[] => {
  if (category === undefined) return torrents;
  return torrents.filter(
    (t) => (typeof t.category === "string" ? t.category : "") === category,
  );
};

const applyTagFilter = (
  torrents: Record<string, unknown>[],
  tag?: string,
): Record<string, unknown>[] => {
  if (!tag) return torrents;
  return torrents.filter((t) => {
    const tags = typeof t.tags === "string" ? t.tags : "";
    return tags
      .split(",")
      .map((s) => s.trim())
      .includes(tag);
  });
};

const applySorting = (
  torrents: Record<string, unknown>[],
  sort?: string,
  reverse?: boolean,
): Record<string, unknown>[] => {
  if (!sort) return torrents;
  const sorted = [...torrents].sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];
    if (typeof aVal === "number" && typeof bVal === "number")
      return aVal - bVal;
    if (typeof aVal === "string" && typeof bVal === "string")
      return aVal.localeCompare(bVal);
    return 0;
  });
  if (reverse) sorted.reverse();
  return sorted;
};

const computeSummary = (torrents: QbittorrentDashboardTorrent[]) => {
  let downloadingCount = 0;
  let stalledCount = 0;
  let seedingCount = 0;
  let pausedCount = 0;
  let completedCount = 0;

  for (const torrent of torrents) {
    if (DOWNLOAD_STATES.has(torrent.state)) downloadingCount += 1;
    if (STALLED_STATES.has(torrent.state)) stalledCount += 1;
    if (SEEDING_STATES.has(torrent.state)) seedingCount += 1;
    if (
      torrent.state.startsWith("paused") ||
      torrent.state.startsWith("stopped")
    )
      pausedCount += 1;
    if (torrent.progress >= 0.999) completedCount += 1;
  }

  return {
    downloading_count: downloadingCount,
    stalled_count: stalledCount,
    seeding_count: seedingCount,
    paused_count: pausedCount,
    completed_count: completedCount,
    total_count: torrents.length,
  };
};

// --- Snapshot ---

export const buildQbittorrentDisabledSnapshot = (
  error?: string,
): QbittorrentDashboardSnapshot => ({
  enabled: false,
  connected: false,
  updated_at: "",
  poll_interval_seconds: DEFAULT_POLL_INTERVAL_SECONDS,
  summary: {
    downloading_count: 0,
    stalled_count: 0,
    seeding_count: 0,
    paused_count: 0,
    completed_count: 0,
    total_count: 0,
    download_speed: 0,
    upload_speed: 0,
    downloaded_bytes: 0,
    uploaded_bytes: 0,
  },
  torrents: [],
  error,
});

export const fetchQbittorrentSnapshot = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
): Promise<QbittorrentDashboardSnapshot> => {
  if (!enabled) return buildQbittorrentDisabledSnapshot();

  try {
    const { serverState, torrents: torrentMap } = await fetchMaindata(config);

    const allTorrents = Array.from(torrentMap.values());
    const torrents = allTorrents
      .map(toTorrent)
      .filter((row): row is QbittorrentDashboardTorrent => !!row);
    const summaryCounts = computeSummary(torrents);
    const prioritizedTorrents = [...torrents]
      .sort((a, b) => {
        const aScore = a.download_speed * 2 + a.upload_speed;
        const bScore = b.download_speed * 2 + b.upload_speed;
        return bScore - aScore;
      })
      .slice(0, config.max_items);

    return {
      enabled: true,
      connected: true,
      updated_at: "",
      poll_interval_seconds: config.poll_interval_seconds,
      summary: {
        ...summaryCounts,
        download_speed: Math.max(
          0,
          Math.trunc(toNumberOr(serverState.dl_info_speed, 0)),
        ),
        upload_speed: Math.max(
          0,
          Math.trunc(toNumberOr(serverState.up_info_speed, 0)),
        ),
        downloaded_bytes: Math.max(
          0,
          Math.trunc(toNumberOr(serverState.dl_info_data, 0)),
        ),
        uploaded_bytes: Math.max(
          0,
          Math.trunc(toNumberOr(serverState.up_info_data, 0)),
        ),
      },
      torrents: prioritizedTorrents,
    };
  } catch (error) {
    console.error("Error fetching qBittorrent snapshot:", error);
    return {
      enabled: true,
      connected: false,
      updated_at: "",
      poll_interval_seconds: config.poll_interval_seconds,
      summary: {
        downloading_count: 0,
        stalled_count: 0,
        seeding_count: 0,
        paused_count: 0,
        completed_count: 0,
        total_count: 0,
        download_speed: 0,
        upload_speed: 0,
        downloaded_bytes: 0,
        uploaded_bytes: 0,
      },
      torrents: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

// --- Torrent list operations ---

export const fetchQbittorrentTorrents = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  params: QbittorrentListTorrentsParams = {},
): Promise<{
  enabled: boolean;
  connected: boolean;
  torrents: QbittorrentTorrentListItem[];
  total_count: number;
  offset: number;
  limit: number;
  download_speed?: number;
  upload_speed?: number;
  error?: string;
}> => {
  const offset =
    typeof params.offset === "number" && Number.isFinite(params.offset)
      ? Math.max(0, Math.trunc(params.offset))
      : 0;
  const limit =
    typeof params.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.min(200, Math.trunc(params.limit)))
      : QBITTORRENT_TORRENTS_PAGE_SIZE;

  if (!enabled) {
    return {
      enabled: false,
      connected: false,
      torrents: [],
      total_count: 0,
      offset,
      limit,
    };
  }

  try {
    const { serverState, torrents: torrentMap } = await fetchMaindata(config);
    let rawList = Array.from(torrentMap.values());

    // Apply filters locally since maindata doesn't support filter params
    rawList = applyStateFilter(rawList, params.filter);
    rawList = applyCategoryFilter(rawList, params.category);
    rawList = applyTagFilter(rawList, params.tag);
    rawList = applySorting(rawList, params.sort, params.reverse);

    const total_count = rawList.length;

    // Apply pagination
    const pageLimit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.max(1, Math.min(200, Math.trunc(params.limit)))
        : rawList.length;
    rawList = rawList.slice(offset, offset + pageLimit);

    const torrents = rawList
      .map(toTorrentListItem)
      .filter((row): row is QbittorrentTorrentListItem => Boolean(row));

    return {
      enabled: true,
      connected: true,
      torrents,
      total_count,
      offset,
      limit: pageLimit,
      download_speed: Math.max(
        0,
        Math.trunc(toNumberOr(serverState.dl_info_speed, 0)),
      ),
      upload_speed: Math.max(
        0,
        Math.trunc(toNumberOr(serverState.up_info_speed, 0)),
      ),
    };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      torrents: [],
      total_count: 0,
      offset,
      limit,
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

export const fetchQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
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
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      torrent: null,
      error: "Missing torrent hash",
    };

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
  config: QbittorrentPluginConfig,
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
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      properties: null,
      error: "Missing torrent hash",
    };

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

export const fetchQbittorrentTorrentFiles = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string,
): Promise<{
  enabled: boolean;
  connected: boolean;
  files: QbittorrentTorrentFile[];
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, files: [] };
  const safeHash = hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      files: [],
      error: "Missing torrent hash",
    };

  try {
    const path = `/api/v2/torrents/files?hash=${encodeURIComponent(safeHash)}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const files = Array.isArray(raw)
      ? raw
          .map(toTorrentFile)
          .filter((row): row is QbittorrentTorrentFile => Boolean(row))
      : [];
    return { enabled: true, connected: true, files };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      files: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

export const fetchQbittorrentTorrentPeers = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string,
  rid?: number,
): Promise<{
  enabled: boolean;
  connected: boolean;
  rid: number;
  full_update: boolean;
  peers: QbittorrentTorrentPeer[];
  error?: string;
}> => {
  if (!enabled)
    return {
      enabled: false,
      connected: false,
      rid: 0,
      full_update: true,
      peers: [],
    };
  const safeHash = hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      rid: 0,
      full_update: true,
      peers: [],
      error: "Missing torrent hash",
    };

  try {
    const safeRid =
      typeof rid === "number" && Number.isFinite(rid) && rid >= 0
        ? Math.trunc(rid)
        : 0;
    const path = `/api/v2/sync/torrentPeers?hash=${encodeURIComponent(safeHash)}&rid=${safeRid}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const parsed = toPeersSnapshot(raw);
    if (!parsed) {
      return {
        enabled: true,
        connected: false,
        rid: safeRid,
        full_update: true,
        peers: [],
        error: "Invalid peers payload",
      };
    }
    return { enabled: true, connected: true, ...parsed };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      rid: 0,
      full_update: true,
      peers: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

export const fetchQbittorrentCategories = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
): Promise<{
  enabled: boolean;
  connected: boolean;
  categories: QbittorrentCategory[];
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, categories: [] };

  try {
    const raw = await qbFetchJson<unknown>(
      config,
      "/api/v2/torrents/categories",
    );
    const record = toRecord(raw) ?? {};
    const categories: QbittorrentCategory[] = [];
    for (const [key, value] of Object.entries(record)) {
      const name = toStringOrNull(key);
      if (!name) continue;
      const category = toRecord(value) as QbittorrentCategoryRaw | null;
      categories.push({
        name,
        save_path: toStringOrNull(category?.savePath),
      });
    }
    categories.sort((a, b) => a.name.localeCompare(b.name));
    return { enabled: true, connected: true, categories };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      categories: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

export const fetchQbittorrentTags = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
): Promise<{
  enabled: boolean;
  connected: boolean;
  tags: string[];
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, tags: [] };

  try {
    const raw = await qbFetchJson<unknown>(config, "/api/v2/torrents/tags");
    const tags = Array.isArray(raw)
      ? raw
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
          .slice(0, 500)
          .sort((a, b) => a.localeCompare(b))
      : [];
    return { enabled: true, connected: true, tags };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      tags: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to connect to qBittorrent",
    };
  }
};

// --- Torrent mutation operations ---

export const renameQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; name: string },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  const name = payload.name.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };
  if (!name)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent name",
    };

  const body = new URLSearchParams();
  body.set("hash", safeHash);
  body.set("name", name);

  try {
    await qbFetchText(config, "/api/v2/torrents/rename", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to rename torrent",
    };
  }
};

export const renameQbittorrentTorrentFile = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; old_path: string; new_path: string },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  const oldPath = payload.old_path.trim();
  const newPath = payload.new_path.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };
  if (!oldPath || !newPath)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing file path",
    };

  const body = new URLSearchParams();
  body.set("hash", safeHash);
  body.set("oldPath", oldPath);
  body.set("newPath", newPath);

  try {
    await qbFetchText(config, "/api/v2/torrents/renameFile", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to rename torrent file",
    };
  }
};

export const setQbittorrentTorrentCategory = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; category: string | null },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };
  const category = payload.category?.trim() ?? "";

  const body = new URLSearchParams();
  body.set("hashes", safeHash);
  body.set("category", category);

  try {
    await qbFetchText(config, "/api/v2/torrents/setCategory", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update category",
    };
  }
};

export const setQbittorrentTorrentTags = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; tags: string[]; previous_tags?: string[] | null },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };

  const normalizeList = (list: string[] | null | undefined): string[] =>
    Array.isArray(list)
      ? list
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(Boolean)
          .slice(0, 50)
      : [];

  const nextTags = normalizeList(payload.tags);
  const prevTags = normalizeList(payload.previous_tags ?? null);

  try {
    if (prevTags.length > 0) {
      const removeBody = new URLSearchParams();
      removeBody.set("hashes", safeHash);
      removeBody.set("tags", prevTags.join(","));
      await qbFetchText(config, "/api/v2/torrents/removeTags", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: removeBody.toString(),
      });
    }

    if (nextTags.length > 0) {
      const addBody = new URLSearchParams();
      addBody.set("hashes", safeHash);
      addBody.set("tags", nextTags.join(","));
      await qbFetchText(config, "/api/v2/torrents/addTags", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: addBody.toString(),
      });
    }

    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : "Failed to update tags",
    };
  }
};

export const pauseQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };

  const body = new URLSearchParams();
  body.set("hashes", safeHash);

  try {
    await qbFetchText(config, "/api/v2/torrents/stop", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : "Failed to pause torrent",
    };
  }
};

export const resumeQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };

  const body = new URLSearchParams();
  body.set("hashes", safeHash);

  try {
    await qbFetchText(config, "/api/v2/torrents/start", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to resume torrent",
    };
  }
};

export const reannounceQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };

  const body = new URLSearchParams();
  body.set("hashes", safeHash);

  try {
    await qbFetchText(config, "/api/v2/torrents/reannounce", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reannounce torrent",
    };
  }
};

export const deleteQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; delete_files: boolean },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent hash",
    };

  const body = new URLSearchParams();
  body.set("hashes", safeHash);
  body.set("deleteFiles", payload.delete_files ? "true" : "false");

  try {
    await qbFetchText(config, "/api/v2/torrents/delete", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete torrent",
    };
  }
};

export const addQbittorrentMagnet = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: {
    magnet: string;
    save_path?: string | null;
    category?: string | null;
    tags?: string[] | null;
  },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const magnet = payload.magnet.trim();
  if (!magnet.startsWith("magnet:")) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Invalid magnet URL",
    };
  }

  const body = new URLSearchParams();
  body.set("urls", magnet);
  if (payload.save_path) body.set("savepath", payload.save_path);
  if (payload.category) body.set("category", payload.category);
  if (payload.tags && payload.tags.length > 0)
    body.set(
      "tags",
      payload.tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(","),
    );

  try {
    const responseText = await qbFetchText(config, "/api/v2/torrents/add", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!/^ok\.?$/i.test(responseText.trim())) {
      return {
        enabled: true,
        connected: true,
        success: false,
        error: `qBittorrent rejected magnet: ${responseText.trim()}`,
      };
    }
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : "Failed to add torrent",
    };
  }
};

export const addQbittorrentTorrentFile = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: {
    torrent: File;
    save_path?: string | null;
    category?: string | null;
    tags?: string[] | null;
  },
): Promise<{
  enabled: boolean;
  connected: boolean;
  success: boolean;
  error?: string;
}> => {
  const logPrefix = "[qbittorrentService:add-file]";
  if (!enabled) return { enabled: false, connected: false, success: false };
  if (!payload.torrent)
    return {
      enabled: true,
      connected: false,
      success: false,
      error: "Missing torrent file",
    };

  const formData = new FormData();
  formData.set("torrents", payload.torrent);
  if (payload.save_path) formData.set("savepath", payload.save_path);
  if (payload.category) formData.set("category", payload.category);
  if (payload.tags && payload.tags.length > 0)
    formData.set(
      "tags",
      payload.tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(","),
    );

  try {
    console.log(
      `${logPrefix} sending torrent name="${payload.torrent.name}" size=${payload.torrent.size} category=${payload.category ?? "none"} tags=${payload.tags?.join(",") || "none"}`,
    );
    const responseText = await qbFetchText(config, "/api/v2/torrents/add", {
      method: "POST",
      body: formData,
    });
    if (!/^ok\.?$/i.test(responseText.trim())) {
      console.error(
        `${logPrefix} qBittorrent rejected torrent name="${payload.torrent.name}" response="${responseText.trim()}"`,
      );
      return {
        enabled: true,
        connected: true,
        success: false,
        error: `qBittorrent rejected torrent: ${responseText.trim()}`,
      };
    }
    console.log(
      `${logPrefix} qBittorrent accepted torrent name="${payload.torrent.name}"`,
    );
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    console.error(
      `${logPrefix} qBittorrent rejected torrent name="${payload.torrent.name}" error=`,
      error,
    );
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : "Failed to add torrent",
    };
  }
};
