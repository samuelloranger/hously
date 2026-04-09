import { logQbittorrentRequest } from "./requestLogs";

export interface QbittorrentTorrentRaw {
  hash?: string;
  name?: string;
  /** Top-level file or folder path for the download (qBittorrent API v2) */
  content_path?: string;
  progress?: number;
  dlspeed?: number;
  upspeed?: number;
  eta?: number;
  size?: number;
  state?: string;
  num_seeds?: number;
  num_leechs?: number;
  category?: string;
  tags?: string;
  ratio?: number;
  added_on?: number;
  completed_on?: number;
}

export interface QbittorrentPluginConfig {
  website_url: string;
  username: string;
  password: string;
  poll_interval_seconds: number;
  max_items: number;
  webhook_secret?: string;
}

export interface QbittorrentDashboardTorrent {
  id: string;
  name: string;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta_seconds: number | null;
  size_bytes: number;
  state: string;
  seeds: number;
  peers: number;
}

export interface QbittorrentTorrentListItem extends QbittorrentDashboardTorrent {
  category: string | null;
  tags: string[];
  ratio: number | null;
  added_on: string | null;
  completed_on: string | null;
  /** Top-level torrent content path when provided by qBittorrent */
  content_path: string | null;
}

export interface QbittorrentTorrentPropertiesRaw {
  save_path?: string;
  total_size?: number;
  piece_size?: number;
  comment?: string;
  creation_date?: number;
  addition_date?: number;
  completion_date?: number;
  total_downloaded?: number;
  total_uploaded?: number;
  share_ratio?: number;
}

export interface QbittorrentTorrentProperties {
  save_path: string | null;
  total_size_bytes: number | null;
  piece_size_bytes: number | null;
  comment: string | null;
  creation_date: string | null;
  addition_date: string | null;
  completion_date: string | null;
  total_downloaded_bytes: number | null;
  total_uploaded_bytes: number | null;
  share_ratio: number | null;
}

export interface QbittorrentTorrentTrackerRaw {
  url?: string;
  status?: number;
  msg?: string;
  tier?: number;
  num_peers?: number;
  num_seeds?: number;
  num_leeches?: number;
  num_downloaded?: number;
}

export interface QbittorrentTorrentTracker {
  url: string;
  status: number | null;
  message: string | null;
  tier: number | null;
  peers: number | null;
  seeds: number | null;
  leeches: number | null;
  downloaded: number | null;
}

export interface QbittorrentTorrentFileRaw {
  index?: number;
  name?: string;
  size?: number;
  progress?: number;
  priority?: number;
}

export interface QbittorrentTorrentFile {
  index: number;
  name: string;
  size_bytes: number;
  progress: number;
  priority: number | null;
}

interface QbittorrentTorrentPeersRaw {
  rid?: number;
  full_update?: boolean;
  peers?: Record<string, unknown>;
}

interface QbittorrentPeerRaw {
  client?: string;
  connection?: string;
  country_code?: string;
  dl_speed?: number;
  downloaded?: number;
  files?: string;
  flags?: string;
  flags_desc?: string;
  ip?: string;
  port?: number;
  progress?: number;
  relevance?: number;
  up_speed?: number;
  uploaded?: number;
}

export interface QbittorrentTorrentPeer {
  id: string;
  ip: string | null;
  port: number | null;
  client: string | null;
  connection: string | null;
  country_code: string | null;
  progress: number | null;
  relevance: number | null;
  downloaded_bytes: number | null;
  uploaded_bytes: number | null;
  download_speed: number | null;
  upload_speed: number | null;
  flags: string | null;
  flags_description: string | null;
  files: string | null;
}

export interface QbittorrentCategoryRaw {
  name?: string;
  savePath?: string;
}

export interface QbittorrentCategory {
  name: string;
  save_path: string | null;
}

export interface QbittorrentDashboardSnapshot {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  poll_interval_seconds: number;
  summary: {
    downloading_count: number;
    stalled_count: number;
    seeding_count: number;
    paused_count: number;
    completed_count: number;
    total_count: number;
    download_speed: number;
    upload_speed: number;
    downloaded_bytes: number;
    uploaded_bytes: number;
  };
  torrents: QbittorrentDashboardTorrent[];
  error?: string;
}

export interface QbittorrentListTorrentsParams {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
}

// --- Session state ---

interface SessionState {
  key: string;
  sidCookie: string | null;
}

const qbSession: SessionState = {
  key: "",
  sidCookie: null,
};

// --- Maindata delta sync state ---

interface MaindataRaw {
  rid?: number;
  full_update?: boolean;
  server_state?: Record<string, unknown>;
  torrents?: Record<string, Record<string, unknown>>;
  torrents_removed?: string[];
}

interface MaindataState {
  rid: number;
  serverState: Record<string, unknown>;
  torrents: Map<string, Record<string, unknown>>;
}

let maindataState: MaindataState | null = null;
let maindataFetchPromise: Promise<{
  serverState: Record<string, unknown>;
  torrents: Map<string, Record<string, unknown>>;
}> | null = null;
let lastMaindataSnapshot: {
  fetchedAt: number;
  serverState: Record<string, unknown>;
  torrents: Map<string, Record<string, unknown>>;
} | null = null;

const MAINDATA_REUSE_WINDOW_MS = 750;

export const resetMaindataState = () => {
  maindataState = null;
  maindataFetchPromise = null;
  lastMaindataSnapshot = null;
};

// --- Shared helpers ---

export const DEFAULT_POLL_INTERVAL_SECONDS = 1;
export const DEFAULT_MAX_ITEMS = 8;
export const DOWNLOAD_STATES = new Set([
  "downloading",
  "forcedDL",
  "metaDL",
  "queuedDL",
  "checkingDL",
]);
export const STALLED_STATES = new Set(["stalledDL", "stalledUP"]);
export const SEEDING_STATES = new Set([
  "uploading",
  "forcedUP",
  "queuedUP",
  "stalledUP",
]);

export const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const toNumberOr = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const clampInt = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number => {
  const parsed = Math.trunc(toNumberOr(value, fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const toIsoDateOrNull = (value: unknown): string | null => {
  const seconds =
    typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : null;
  if (!seconds || seconds <= 0) return null;
  try {
    return new Date(seconds * 1000).toISOString();
  } catch {
    return null;
  }
};

const toTags = (value: unknown): string[] => {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
};

const textEncoder = new TextEncoder();

const getByteLength = (value: string) => textEncoder.encode(value).length;

const getQbittorrentPayloadMetrics = (url: URL, payload: unknown) => {
  const record = toRecord(payload);
  const metrics: {
    rid?: number;
    fullUpdate?: boolean;
    itemCount?: number;
    removedCount?: number;
    meta: Record<string, unknown>;
  } = {
    meta: {
      query: Object.fromEntries(url.searchParams.entries()),
    },
  };

  if (Array.isArray(payload)) {
    metrics.itemCount = payload.length;
    metrics.meta.payloadKind = "array";
    return metrics;
  }

  if (!record) {
    metrics.meta.payloadKind = typeof payload;
    return metrics;
  }

  metrics.meta.payloadKind = "object";

  if (typeof record.rid === "number") metrics.rid = record.rid;
  if (typeof record.full_update === "boolean")
    metrics.fullUpdate = record.full_update;

  if (url.pathname === "/api/v2/sync/maindata") {
    const torrents = toRecord(record.torrents);
    const removed = Array.isArray(record.torrents_removed)
      ? record.torrents_removed
      : [];
    metrics.itemCount = torrents ? Object.keys(torrents).length : 0;
    metrics.removedCount = removed.length;
    metrics.meta.serverStateKeys = toRecord(record.server_state)
      ? Object.keys(toRecord(record.server_state)!).length
      : 0;
    return metrics;
  }

  if (url.pathname === "/api/v2/sync/torrentPeers") {
    const peers = toRecord(record.peers);
    metrics.itemCount = peers ? Object.keys(peers).length : 0;
    return metrics;
  }

  if (url.pathname === "/api/v2/torrents/info") {
    metrics.itemCount = Array.isArray(payload) ? payload.length : undefined;
    return metrics;
  }

  if (url.pathname === "/api/v2/torrents/categories") {
    metrics.itemCount = Object.keys(record).length;
    return metrics;
  }

  return metrics;
};

type QbRequestResult = {
  url: URL;
  bodyText: string;
  statusCode: number;
  authRetried: boolean;
  durationMs: number;
};

// --- HTTP client ---

const buildConfigKey = (config: QbittorrentPluginConfig): string =>
  `${config.website_url}|${config.username}|${config.password}`;

const parseSidCookie = (response: Response): string | null => {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;
  const sidPart = raw
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("SID="));
  if (!sidPart) return null;
  return sidPart.split(";")[0] || null;
};

const resetSessionIfConfigChanged = (config: QbittorrentPluginConfig) => {
  const key = buildConfigKey(config);
  if (qbSession.key === key) return;
  qbSession.key = key;
  qbSession.sidCookie = null;
  maindataState = null;
};

const login = async (config: QbittorrentPluginConfig): Promise<boolean> => {
  const loginUrl = new URL("/api/v2/auth/login", config.website_url);
  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
  });

  const startedAt = Date.now();

  try {
    const response = await fetch(loginUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: config.website_url,
      },
      body: body.toString(),
    });

    const text = (await response.text()).trim();
    const ok = response.ok && /^ok\.?$/i.test(text);

    if (ok) {
      qbSession.sidCookie = parseSidCookie(response);
    }

    logQbittorrentRequest({
      method: "POST",
      endpoint: loginUrl.pathname,
      requestPath: `${loginUrl.pathname}${loginUrl.search}`,
      statusCode: response.status,
      ok: ok && Boolean(qbSession.sidCookie),
      durationMs: Date.now() - startedAt,
      responseBytes: getByteLength(text),
      errorMessage:
        ok && qbSession.sidCookie ? null : "qBittorrent authentication failed",
      meta: {
        hasSidCookie: Boolean(parseSidCookie(response)),
      },
    });

    return ok && Boolean(qbSession.sidCookie);
  } catch (error) {
    logQbittorrentRequest({
      method: "POST",
      endpoint: loginUrl.pathname,
      requestPath: `${loginUrl.pathname}${loginUrl.search}`,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorMessage:
        error instanceof Error
          ? error.message
          : "qBittorrent authentication request failed",
    });
    return false;
  }
};

const qbRequest = async (
  config: QbittorrentPluginConfig,
  path: string,
  init?: RequestInit,
): Promise<QbRequestResult> => {
  resetSessionIfConfigChanged(config);

  const url = new URL(path, config.website_url);
  const startedAt = Date.now();

  const request = async (): Promise<Response> => {
    const mergedHeaders = new Headers(init?.headers ?? {});
    if (qbSession.sidCookie) mergedHeaders.set("Cookie", qbSession.sidCookie);
    return fetch(url.toString(), { ...init, headers: mergedHeaders });
  };

  let authRetried = false;
  let statusCode: number | null = null;

  try {
    if (!qbSession.sidCookie) {
      const loggedIn = await login(config);
      if (!loggedIn) {
        throw new Error("qBittorrent authentication failed");
      }
    }

    let response = await request();
    statusCode = response.status;

    if (response.status === 403 || response.status === 401) {
      authRetried = true;
      const loggedIn = await login(config);
      if (!loggedIn) {
        throw new Error("qBittorrent authentication failed");
      }
      response = await request();
      statusCode = response.status;
    }

    const bodyText = await response.text();
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logQbittorrentRequest({
        method: (init?.method ?? "GET").toUpperCase(),
        endpoint: url.pathname,
        requestPath: `${url.pathname}${url.search}`,
        statusCode: response.status,
        ok: false,
        durationMs,
        responseBytes: getByteLength(bodyText),
        authRetried,
        errorMessage: `qBittorrent request failed with status ${response.status}`,
      });
      throw new Error(
        `qBittorrent request failed with status ${response.status}`,
      );
    }

    return {
      url,
      bodyText,
      statusCode: response.status,
      authRetried,
      durationMs,
    };
  } catch (error) {
    if (statusCode == null || error instanceof TypeError) {
      logQbittorrentRequest({
        method: (init?.method ?? "GET").toUpperCase(),
        endpoint: url.pathname,
        requestPath: `${url.pathname}${url.search}`,
        statusCode,
        ok: false,
        durationMs: Date.now() - startedAt,
        authRetried,
        errorMessage:
          error instanceof Error ? error.message : "qBittorrent request failed",
      });
    }
    throw error;
  }
};

export const qbFetchJson = async <T>(
  config: QbittorrentPluginConfig,
  path: string,
): Promise<T> => {
  const result = await qbRequest(config, path, {
    headers: {
      Accept: "application/json",
    },
  });

  try {
    const parsed = JSON.parse(result.bodyText) as T;
    const metrics = getQbittorrentPayloadMetrics(result.url, parsed);
    logQbittorrentRequest({
      method: "GET",
      endpoint: result.url.pathname,
      requestPath: `${result.url.pathname}${result.url.search}`,
      statusCode: result.statusCode,
      ok: true,
      durationMs: result.durationMs,
      responseBytes: getByteLength(result.bodyText),
      authRetried: result.authRetried,
      rid: metrics.rid,
      fullUpdate: metrics.fullUpdate,
      itemCount: metrics.itemCount,
      removedCount: metrics.removedCount,
      meta: metrics.meta,
    });
    return parsed;
  } catch (error) {
    logQbittorrentRequest({
      method: "GET",
      endpoint: result.url.pathname,
      requestPath: `${result.url.pathname}${result.url.search}`,
      statusCode: result.statusCode,
      ok: false,
      durationMs: result.durationMs,
      responseBytes: getByteLength(result.bodyText),
      authRetried: result.authRetried,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Invalid qBittorrent JSON payload",
    });
    throw error;
  }
};

export const qbFetchText = async (
  config: QbittorrentPluginConfig,
  path: string,
  init?: RequestInit,
): Promise<string> => {
  const result = await qbRequest(config, path, {
    ...init,
    headers: {
      Accept: "text/plain, */*",
      Referer: config.website_url,
      ...(init?.headers ?? {}),
    },
  });

  logQbittorrentRequest({
    method: (init?.method ?? "GET").toUpperCase(),
    endpoint: result.url.pathname,
    requestPath: `${result.url.pathname}${result.url.search}`,
    statusCode: result.statusCode,
    ok: true,
    durationMs: result.durationMs,
    responseBytes: getByteLength(result.bodyText),
    authRetried: result.authRetried,
    meta: {
      payloadKind: "text",
    },
  });

  return result.bodyText;
};

// --- Maindata fetch & merge ---

export const fetchMaindata = async (
  config: QbittorrentPluginConfig,
): Promise<{
  serverState: Record<string, unknown>;
  torrents: Map<string, Record<string, unknown>>;
}> => {
  const now = Date.now();
  if (
    lastMaindataSnapshot &&
    now - lastMaindataSnapshot.fetchedAt <= MAINDATA_REUSE_WINDOW_MS
  ) {
    return {
      serverState: lastMaindataSnapshot.serverState,
      torrents: lastMaindataSnapshot.torrents,
    };
  }

  if (maindataFetchPromise) {
    return maindataFetchPromise;
  }

  maindataFetchPromise = (async () => {
    const rid = maindataState?.rid ?? 0;
    const raw = await qbFetchJson<MaindataRaw>(
      config,
      `/api/v2/sync/maindata?rid=${rid}`,
    );

    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid maindata response");
    }

    if (raw.full_update || !maindataState) {
      // Full sync - replace everything
      const torrents = new Map<string, Record<string, unknown>>();
      if (raw.torrents) {
        for (const [hash, torrent] of Object.entries(raw.torrents)) {
          torrents.set(hash, { ...torrent, hash });
        }
      }
      maindataState = {
        rid: typeof raw.rid === "number" ? raw.rid : 0,
        serverState: raw.server_state ?? {},
        torrents,
      };
    } else {
      // Delta update - merge changes
      if (typeof raw.rid === "number") {
        maindataState.rid = raw.rid;
      }

      if (raw.server_state) {
        Object.assign(maindataState.serverState, raw.server_state);
      }

      if (raw.torrents) {
        for (const [hash, delta] of Object.entries(raw.torrents)) {
          const existing = maindataState.torrents.get(hash);
          if (existing) {
            Object.assign(existing, delta);
          } else {
            maindataState.torrents.set(hash, { ...delta, hash });
          }
        }
      }

      if (raw.torrents_removed) {
        for (const hash of raw.torrents_removed) {
          maindataState.torrents.delete(hash);
        }
      }
    }

    const snapshot = {
      serverState: maindataState.serverState,
      torrents: maindataState.torrents,
    };

    lastMaindataSnapshot = {
      fetchedAt: Date.now(),
      ...snapshot,
    };

    return snapshot;
  })().finally(() => {
    maindataFetchPromise = null;
  });

  try {
    return await maindataFetchPromise;
  } catch (error) {
    lastMaindataSnapshot = null;
    throw error;
  }
};

// --- Torrent normalization helpers ---

export const toTorrent = (
  value: unknown,
): QbittorrentDashboardTorrent | null => {
  const row = toRecord(value) as QbittorrentTorrentRaw | null;
  if (!row) return null;

  const id = toStringOrNull(row.hash);
  const name = toStringOrNull(row.name);
  if (!id || !name) return null;

  const progressRaw = toNumberOr(row.progress, 0);
  const progress = Math.min(1, Math.max(0, progressRaw));
  const eta = Math.trunc(toNumberOr(row.eta, -1));
  const sizeBytes = Math.max(0, Math.trunc(toNumberOr(row.size, 0)));
  const state = toStringOrNull(row.state) || "unknown";

  return {
    id,
    name,
    progress,
    download_speed: Math.max(0, Math.trunc(toNumberOr(row.dlspeed, 0))),
    upload_speed: Math.max(0, Math.trunc(toNumberOr(row.upspeed, 0))),
    eta_seconds: eta >= 0 ? eta : null,
    size_bytes: sizeBytes,
    state,
    seeds: Math.max(0, Math.trunc(toNumberOr(row.num_seeds, 0))),
    peers: Math.max(0, Math.trunc(toNumberOr(row.num_leechs, 0))),
  };
};

export const toTorrentListItem = (
  value: unknown,
): QbittorrentTorrentListItem | null => {
  const base = toTorrent(value);
  if (!base) return null;
  const row = toRecord(value) as QbittorrentTorrentRaw | null;
  if (!row) return null;

  return {
    ...base,
    category: toStringOrNull(row.category),
    tags: toTags(row.tags),
    ratio:
      typeof row.ratio === "number" && Number.isFinite(row.ratio)
        ? row.ratio
        : null,
    added_on: toIsoDateOrNull(row.added_on),
    completed_on: toIsoDateOrNull(row.completed_on),
    content_path: toStringOrNull(row.content_path),
  };
};

export const toTorrentProperties = (
  value: unknown,
): QbittorrentTorrentProperties | null => {
  const row = toRecord(value) as QbittorrentTorrentPropertiesRaw | null;
  if (!row) return null;

  const toIntOrNull = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
  };

  const toFloatOrNull = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  return {
    save_path: toStringOrNull(row.save_path),
    total_size_bytes: toIntOrNull(row.total_size),
    piece_size_bytes: toIntOrNull(row.piece_size),
    comment: toStringOrNull(row.comment),
    creation_date: toIsoDateOrNull(row.creation_date),
    addition_date: toIsoDateOrNull(row.addition_date),
    completion_date: toIsoDateOrNull(row.completion_date),
    total_downloaded_bytes: toIntOrNull(row.total_downloaded),
    total_uploaded_bytes: toIntOrNull(row.total_uploaded),
    share_ratio: toFloatOrNull(row.share_ratio),
  };
};

export const toTorrentTracker = (
  value: unknown,
): QbittorrentTorrentTracker | null => {
  const row = toRecord(value) as QbittorrentTorrentTrackerRaw | null;
  if (!row) return null;
  const url = toStringOrNull(row.url);
  if (!url) return null;

  const toIntOrNull = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
  };

  return {
    url,
    status: toIntOrNull(row.status),
    message: toStringOrNull(row.msg),
    tier: toIntOrNull(row.tier),
    peers: toIntOrNull(row.num_peers),
    seeds: toIntOrNull(row.num_seeds),
    leeches: toIntOrNull(row.num_leeches),
    downloaded: toIntOrNull(row.num_downloaded),
  };
};

export const toTorrentFile = (
  value: unknown,
): QbittorrentTorrentFile | null => {
  const row = toRecord(value) as QbittorrentTorrentFileRaw | null;
  if (!row) return null;
  const index = Math.trunc(toNumberOr(row.index, -1));
  const name = toStringOrNull(row.name);
  if (!Number.isFinite(index) || index < 0 || !name) return null;
  const sizeBytes = Math.max(0, Math.trunc(toNumberOr(row.size, 0)));
  const progressRaw = toNumberOr(row.progress, 0);
  const progress = Math.min(1, Math.max(0, progressRaw));
  const priorityRaw =
    typeof row.priority === "number" && Number.isFinite(row.priority)
      ? Math.trunc(row.priority)
      : null;

  return {
    index,
    name,
    size_bytes: sizeBytes,
    progress,
    priority: priorityRaw,
  };
};

export const toPeersSnapshot = (
  value: unknown,
): {
  rid: number;
  full_update: boolean;
  peers: QbittorrentTorrentPeer[];
} | null => {
  const root = toRecord(value) as QbittorrentTorrentPeersRaw | null;
  if (!root) return null;
  const rid = Math.trunc(toNumberOr(root.rid, -1));
  if (!Number.isFinite(rid) || rid < 0) return null;
  const fullUpdate = Boolean(root.full_update);
  const peersRecord = toRecord(root.peers) ?? {};

  const peers: QbittorrentTorrentPeer[] = [];
  for (const [id, rawPeer] of Object.entries(peersRecord)) {
    const peer = toRecord(rawPeer) as QbittorrentPeerRaw | null;
    if (!peer) continue;
    const ip = toStringOrNull(peer.ip);
    const port =
      typeof peer.port === "number" && Number.isFinite(peer.port)
        ? Math.trunc(peer.port)
        : null;
    const progress =
      typeof peer.progress === "number" && Number.isFinite(peer.progress)
        ? peer.progress
        : null;
    const relevance =
      typeof peer.relevance === "number" && Number.isFinite(peer.relevance)
        ? peer.relevance
        : null;

    const toBytesOrNull = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v))
        return Math.max(0, Math.trunc(v));
      if (typeof v === "string") {
        const parsed = Number(v);
        return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
      }
      return null;
    };

    peers.push({
      id,
      ip,
      port,
      client: toStringOrNull(peer.client),
      connection: toStringOrNull(peer.connection),
      country_code: toStringOrNull(peer.country_code),
      progress,
      relevance,
      downloaded_bytes: toBytesOrNull(peer.downloaded),
      uploaded_bytes: toBytesOrNull(peer.uploaded),
      download_speed: toBytesOrNull(peer.dl_speed),
      upload_speed: toBytesOrNull(peer.up_speed),
      flags: toStringOrNull(peer.flags),
      flags_description: toStringOrNull(peer.flags_desc),
      files: toStringOrNull(peer.files),
    });
  }

  peers.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
  return { rid, full_update: fullUpdate, peers };
};
