import { prisma } from '../db';
import { getJsonCache, setJsonCache, deleteCache } from './cache';

interface QbittorrentTorrentRaw {
  hash?: string;
  name?: string;
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
}

interface QbittorrentTorrentPropertiesRaw {
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

interface QbittorrentTorrentTrackerRaw {
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

interface QbittorrentTorrentFileRaw {
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

interface QbittorrentCategoryRaw {
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

interface SessionState {
  key: string;
  sidCookie: string | null;
}

const DEFAULT_POLL_INTERVAL_SECONDS = 1;
const DEFAULT_MAX_ITEMS = 8;
const DOWNLOAD_STATES = new Set(['downloading', 'forcedDL', 'metaDL', 'queuedDL', 'checkingDL']);
const STALLED_STATES = new Set(['stalledDL', 'stalledUP']);
const SEEDING_STATES = new Set(['uploading', 'forcedUP', 'queuedUP', 'stalledUP']);

const qbSession: SessionState = {
  key: '',
  sidCookie: null,
};

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNumberOr = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = Math.trunc(toNumberOr(value, fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const buildConfigKey = (config: QbittorrentPluginConfig): string =>
  `${config.website_url}|${config.username}|${config.password}`;

const parseSidCookie = (response: Response): string | null => {
  const raw = response.headers.get('set-cookie');
  if (!raw) return null;
  const sidPart = raw
    .split(',')
    .map(part => part.trim())
    .find(part => part.startsWith('SID='));
  if (!sidPart) return null;
  return sidPart.split(';')[0] || null;
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

export const resetMaindataState = () => {
  maindataState = null;
};

// --- End maindata state ---

const resetSessionIfConfigChanged = (config: QbittorrentPluginConfig) => {
  const key = buildConfigKey(config);
  if (qbSession.key === key) return;
  qbSession.key = key;
  qbSession.sidCookie = null;
  maindataState = null;
};

const login = async (config: QbittorrentPluginConfig): Promise<boolean> => {
  const loginUrl = new URL('/api/v2/auth/login', config.website_url);
  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
  });

  const response = await fetch(loginUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: config.website_url,
    },
    body: body.toString(),
  });

  if (!response.ok) return false;

  const text = (await response.text()).trim();
  if (!/^ok\.?$/i.test(text)) return false;

  qbSession.sidCookie = parseSidCookie(response);
  return Boolean(qbSession.sidCookie);
};

const qbFetchJson = async <T>(config: QbittorrentPluginConfig, path: string): Promise<T> => {
  resetSessionIfConfigChanged(config);

  const request = async (): Promise<Response> => {
    const url = new URL(path, config.website_url);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (qbSession.sidCookie) headers.Cookie = qbSession.sidCookie;
    return fetch(url.toString(), { headers });
  };

  let response = await request();
  if (response.status === 403 || response.status === 401) {
    const loggedIn = await login(config);
    if (!loggedIn) throw new Error('qBittorrent authentication failed');
    response = await request();
  }

  if (!response.ok) {
    throw new Error(`qBittorrent request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

const qbFetchText = async (config: QbittorrentPluginConfig, path: string, init?: RequestInit): Promise<string> => {
  resetSessionIfConfigChanged(config);

  const request = async (): Promise<Response> => {
    const url = new URL(path, config.website_url);
    const baseHeaders: Record<string, string> = {
      Accept: 'text/plain, */*',
      Referer: config.website_url,
    };
    if (qbSession.sidCookie) baseHeaders.Cookie = qbSession.sidCookie;

    const mergedHeaders = new Headers(init?.headers ?? {});
    for (const [key, value] of Object.entries(baseHeaders)) {
      if (!mergedHeaders.has(key)) mergedHeaders.set(key, value);
    }

    return fetch(url.toString(), { ...init, headers: mergedHeaders });
  };

  let response = await request();
  if (response.status === 403 || response.status === 401) {
    const loggedIn = await login(config);
    if (!loggedIn) throw new Error('qBittorrent authentication failed');
    response = await request();
  }

  if (!response.ok) {
    throw new Error(`qBittorrent request failed with status ${response.status}`);
  }

  return await response.text();
};

// --- Maindata fetch & merge ---

const MAINDATA_STATE_FILTER_MAP: Record<string, (state: string) => boolean> = {
  downloading: s => DOWNLOAD_STATES.has(s),
  seeding: s => SEEDING_STATES.has(s),
  completed: s =>
    s === 'uploading' ||
    s === 'pausedUP' ||
    s === 'stoppedUP' ||
    s === 'stalledUP' ||
    s === 'queuedUP' ||
    s === 'forcedUP',
  paused: s => s.startsWith('paused') || s.startsWith('stopped'),
  active: s =>
    DOWNLOAD_STATES.has(s) || SEEDING_STATES.has(s) || s === 'uploading' || s === 'forcedUP' || s === 'forcedDL',
  inactive: s =>
    !DOWNLOAD_STATES.has(s) && !SEEDING_STATES.has(s) && s !== 'uploading' && s !== 'forcedUP' && s !== 'forcedDL',
  stalled: s => STALLED_STATES.has(s),
  errored: s => s === 'error' || s === 'missingFiles',
};

const applyStateFilter = (torrents: Record<string, unknown>[], filter?: string): Record<string, unknown>[] => {
  if (!filter || filter === 'all') return torrents;
  const predicate = MAINDATA_STATE_FILTER_MAP[filter];
  if (!predicate) return torrents;
  return torrents.filter(t => {
    const state = typeof t.state === 'string' ? t.state : '';
    return predicate(state);
  });
};

const applyCategoryFilter = (torrents: Record<string, unknown>[], category?: string): Record<string, unknown>[] => {
  if (category === undefined) return torrents;
  return torrents.filter(t => (typeof t.category === 'string' ? t.category : '') === category);
};

const applyTagFilter = (torrents: Record<string, unknown>[], tag?: string): Record<string, unknown>[] => {
  if (!tag) return torrents;
  return torrents.filter(t => {
    const tags = typeof t.tags === 'string' ? t.tags : '';
    return tags
      .split(',')
      .map(s => s.trim())
      .includes(tag);
  });
};

const applySorting = (
  torrents: Record<string, unknown>[],
  sort?: string,
  reverse?: boolean
): Record<string, unknown>[] => {
  if (!sort) return torrents;
  const sorted = [...torrents].sort((a, b) => {
    const aVal = a[sort];
    const bVal = b[sort];
    if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
    if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal);
    return 0;
  });
  if (reverse) sorted.reverse();
  return sorted;
};

export const fetchMaindata = async (
  config: QbittorrentPluginConfig
): Promise<{
  serverState: Record<string, unknown>;
  torrents: Map<string, Record<string, unknown>>;
}> => {
  const rid = maindataState?.rid ?? 0;
  const raw = await qbFetchJson<MaindataRaw>(config, `/api/v2/sync/maindata?rid=${rid}`);

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid maindata response');
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
      rid: typeof raw.rid === 'number' ? raw.rid : 0,
      serverState: raw.server_state ?? {},
      torrents,
    };
  } else {
    // Delta update - merge changes
    if (typeof raw.rid === 'number') {
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

  return {
    serverState: maindataState.serverState,
    torrents: maindataState.torrents,
  };
};

// --- End maindata ---

const toTorrent = (value: unknown): QbittorrentDashboardTorrent | null => {
  const row = toRecord(value) as QbittorrentTorrentRaw | null;
  if (!row) return null;

  const id = toStringOrNull(row.hash);
  const name = toStringOrNull(row.name);
  if (!id || !name) return null;

  const progressRaw = toNumberOr(row.progress, 0);
  const progress = Math.min(1, Math.max(0, progressRaw));
  const eta = Math.trunc(toNumberOr(row.eta, -1));
  const sizeBytes = Math.max(0, Math.trunc(toNumberOr(row.size, 0)));
  const state = toStringOrNull(row.state) || 'unknown';

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

const toIsoDateOrNull = (value: unknown): string | null => {
  const seconds = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
  if (!seconds || seconds <= 0) return null;
  try {
    return new Date(seconds * 1000).toISOString();
  } catch {
    return null;
  }
};

const toTags = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
};

const toTorrentListItem = (value: unknown): QbittorrentTorrentListItem | null => {
  const base = toTorrent(value);
  if (!base) return null;
  const row = toRecord(value) as QbittorrentTorrentRaw | null;
  if (!row) return null;

  return {
    ...base,
    category: toStringOrNull(row.category),
    tags: toTags(row.tags),
    ratio: typeof row.ratio === 'number' && Number.isFinite(row.ratio) ? row.ratio : null,
    added_on: toIsoDateOrNull(row.added_on),
    completed_on: toIsoDateOrNull(row.completed_on),
  };
};

const toTorrentProperties = (value: unknown): QbittorrentTorrentProperties | null => {
  const row = toRecord(value) as QbittorrentTorrentPropertiesRaw | null;
  if (!row) return null;

  const toIntOrNull = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
  };

  const toFloatOrNull = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
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

const toTorrentTracker = (value: unknown): QbittorrentTorrentTracker | null => {
  const row = toRecord(value) as QbittorrentTorrentTrackerRaw | null;
  if (!row) return null;
  const url = toStringOrNull(row.url);
  if (!url) return null;

  const toIntOrNull = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') {
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

const toTorrentFile = (value: unknown): QbittorrentTorrentFile | null => {
  const row = toRecord(value) as QbittorrentTorrentFileRaw | null;
  if (!row) return null;
  const index = Math.trunc(toNumberOr(row.index, -1));
  const name = toStringOrNull(row.name);
  if (!Number.isFinite(index) || index < 0 || !name) return null;
  const sizeBytes = Math.max(0, Math.trunc(toNumberOr(row.size, 0)));
  const progressRaw = toNumberOr(row.progress, 0);
  const progress = Math.min(1, Math.max(0, progressRaw));
  const priorityRaw =
    typeof row.priority === 'number' && Number.isFinite(row.priority) ? Math.trunc(row.priority) : null;

  return {
    index,
    name,
    size_bytes: sizeBytes,
    progress,
    priority: priorityRaw,
  };
};

const toPeersSnapshot = (
  value: unknown
): { rid: number; full_update: boolean; peers: QbittorrentTorrentPeer[] } | null => {
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
    const port = typeof peer.port === 'number' && Number.isFinite(peer.port) ? Math.trunc(peer.port) : null;
    const progress = typeof peer.progress === 'number' && Number.isFinite(peer.progress) ? peer.progress : null;
    const relevance = typeof peer.relevance === 'number' && Number.isFinite(peer.relevance) ? peer.relevance : null;

    const toBytesOrNull = (v: unknown): number | null => {
      if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
      if (typeof v === 'string') {
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
    if (torrent.state.startsWith('paused') || torrent.state.startsWith('stopped')) pausedCount += 1;
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

export const normalizeQbittorrentConfig = (config: unknown): QbittorrentPluginConfig | null => {
  const cfg = toRecord(config);
  if (!cfg) return null;

  const websiteUrl = toStringOrNull(cfg.website_url);
  const username = toStringOrNull(cfg.username);
  const password = toStringOrNull(cfg.password);
  if (!websiteUrl || !username || !password) return null;

  return {
    website_url: websiteUrl.replace(/\/+$/, ''),
    username,
    password,
    poll_interval_seconds: clampInt(cfg.poll_interval_seconds, 1, 30, DEFAULT_POLL_INTERVAL_SECONDS),
    max_items: clampInt(cfg.max_items, 3, 30, DEFAULT_MAX_ITEMS),
  };
};

// --- Plugin config cache (Redis, 30s TTL) ---

const PLUGIN_CONFIG_CACHE_KEY = 'qbittorrent:plugin_config';
const PLUGIN_CONFIG_CACHE_TTL_SECONDS = 86400; // 24h — invalidated on settings save

export const getQbittorrentPluginConfig = async (): Promise<{
  enabled: boolean;
  config: QbittorrentPluginConfig | null;
}> => {
  const cached = await getJsonCache<{ enabled: boolean; config: QbittorrentPluginConfig | null }>(
    PLUGIN_CONFIG_CACHE_KEY
  );
  if (cached) return cached;

  const plugin = await prisma.plugin.findFirst({
    where: { type: 'qbittorrent' },
    select: { enabled: true, config: true },
  });

  const enabled = plugin?.enabled ?? false;
  const config = enabled ? normalizeQbittorrentConfig(plugin?.config) : null;
  const result = { enabled, config };
  await setJsonCache(PLUGIN_CONFIG_CACHE_KEY, result, PLUGIN_CONFIG_CACHE_TTL_SECONDS);
  return result;
};

export const invalidateQbittorrentPluginConfigCache = async () => {
  await deleteCache(PLUGIN_CONFIG_CACHE_KEY);
};

// --- End plugin config cache ---

export const buildQbittorrentDisabledSnapshot = (error?: string): QbittorrentDashboardSnapshot => ({
  enabled: false,
  connected: false,
  updated_at: '',
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
  enabled: boolean
): Promise<QbittorrentDashboardSnapshot> => {
  if (!enabled) return buildQbittorrentDisabledSnapshot();

  try {
    const { serverState, torrents: torrentMap } = await fetchMaindata(config);

    const allTorrents = Array.from(torrentMap.values());
    const torrents = allTorrents.map(toTorrent).filter((row): row is QbittorrentDashboardTorrent => !!row);
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
      updated_at: '',
      poll_interval_seconds: config.poll_interval_seconds,
      summary: {
        ...summaryCounts,
        download_speed: Math.max(0, Math.trunc(toNumberOr(serverState.dl_info_speed, 0))),
        upload_speed: Math.max(0, Math.trunc(toNumberOr(serverState.up_info_speed, 0))),
        downloaded_bytes: Math.max(0, Math.trunc(toNumberOr(serverState.dl_info_data, 0))),
        uploaded_bytes: Math.max(0, Math.trunc(toNumberOr(serverState.up_info_data, 0))),
      },
      torrents: prioritizedTorrents,
    };
  } catch (error) {
    console.error('Error fetching qBittorrent snapshot:', error);
    return {
      enabled: true,
      connected: false,
      updated_at: '',
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
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export interface QbittorrentListTorrentsParams {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
}

export const fetchQbittorrentTorrents = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  params: QbittorrentListTorrentsParams = {}
): Promise<{ enabled: boolean; connected: boolean; torrents: QbittorrentTorrentListItem[]; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, torrents: [] };

  try {
    const { torrents: torrentMap } = await fetchMaindata(config);
    let rawList = Array.from(torrentMap.values());

    // Apply filters locally since maindata doesn't support filter params
    rawList = applyStateFilter(rawList, params.filter);
    rawList = applyCategoryFilter(rawList, params.category);
    rawList = applyTagFilter(rawList, params.tag);
    rawList = applySorting(rawList, params.sort, params.reverse);

    // Apply pagination
    const offset =
      typeof params.offset === 'number' && Number.isFinite(params.offset) ? Math.max(0, Math.trunc(params.offset)) : 0;
    const limit =
      typeof params.limit === 'number' && Number.isFinite(params.limit)
        ? Math.max(1, Math.min(200, Math.trunc(params.limit)))
        : rawList.length;
    rawList = rawList.slice(offset, offset + limit);

    const torrents = rawList.map(toTorrentListItem).filter((row): row is QbittorrentTorrentListItem => Boolean(row));

    return { enabled: true, connected: true, torrents };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      torrents: [],
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string
): Promise<{ enabled: boolean; connected: boolean; torrent: QbittorrentTorrentListItem | null; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, torrent: null };
  const safeHash = hash.trim();
  if (!safeHash) return { enabled: true, connected: false, torrent: null, error: 'Missing torrent hash' };

  try {
    const { torrents: torrentMap } = await fetchMaindata(config);
    const raw = torrentMap.get(safeHash);
    if (!raw) {
      return { enabled: true, connected: true, torrent: null, error: 'Torrent not found' };
    }

    const torrent = toTorrentListItem(raw);
    return { enabled: true, connected: true, torrent };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      torrent: null,
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentTorrentProperties = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string
): Promise<{
  enabled: boolean;
  connected: boolean;
  properties: QbittorrentTorrentProperties | null;
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, properties: null };
  const safeHash = hash.trim();
  if (!safeHash) return { enabled: true, connected: false, properties: null, error: 'Missing torrent hash' };

  try {
    const path = `/api/v2/torrents/properties?hash=${encodeURIComponent(safeHash)}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const properties = toTorrentProperties(raw);
    if (!properties) {
      return { enabled: true, connected: false, properties: null, error: 'Invalid properties payload' };
    }
    return { enabled: true, connected: true, properties };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      properties: null,
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentTorrentTrackers = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string
): Promise<{ enabled: boolean; connected: boolean; trackers: QbittorrentTorrentTracker[]; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, trackers: [] };
  const safeHash = hash.trim();
  if (!safeHash) return { enabled: true, connected: false, trackers: [], error: 'Missing torrent hash' };

  try {
    const path = `/api/v2/torrents/trackers?hash=${encodeURIComponent(safeHash)}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const trackers = Array.isArray(raw)
      ? raw.map(toTorrentTracker).filter((row): row is QbittorrentTorrentTracker => Boolean(row))
      : [];
    return { enabled: true, connected: true, trackers };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      trackers: [],
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentTorrentFiles = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string
): Promise<{ enabled: boolean; connected: boolean; files: QbittorrentTorrentFile[]; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, files: [] };
  const safeHash = hash.trim();
  if (!safeHash) return { enabled: true, connected: false, files: [], error: 'Missing torrent hash' };

  try {
    const path = `/api/v2/torrents/files?hash=${encodeURIComponent(safeHash)}`;
    const raw = await qbFetchJson<unknown>(config, path);
    const files = Array.isArray(raw)
      ? raw.map(toTorrentFile).filter((row): row is QbittorrentTorrentFile => Boolean(row))
      : [];
    return { enabled: true, connected: true, files };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      files: [],
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentTorrentPeers = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string,
  rid?: number
): Promise<{
  enabled: boolean;
  connected: boolean;
  rid: number;
  full_update: boolean;
  peers: QbittorrentTorrentPeer[];
  error?: string;
}> => {
  if (!enabled) return { enabled: false, connected: false, rid: 0, full_update: true, peers: [] };
  const safeHash = hash.trim();
  if (!safeHash)
    return { enabled: true, connected: false, rid: 0, full_update: true, peers: [], error: 'Missing torrent hash' };

  try {
    const safeRid = typeof rid === 'number' && Number.isFinite(rid) && rid >= 0 ? Math.trunc(rid) : 0;
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
        error: 'Invalid peers payload',
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
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentCategories = async (
  config: QbittorrentPluginConfig,
  enabled: boolean
): Promise<{ enabled: boolean; connected: boolean; categories: QbittorrentCategory[]; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, categories: [] };

  try {
    const raw = await qbFetchJson<unknown>(config, '/api/v2/torrents/categories');
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
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const fetchQbittorrentTags = async (
  config: QbittorrentPluginConfig,
  enabled: boolean
): Promise<{ enabled: boolean; connected: boolean; tags: string[]; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, tags: [] };

  try {
    const raw = await qbFetchJson<unknown>(config, '/api/v2/torrents/tags');
    const tags = Array.isArray(raw)
      ? raw
          .map(value => (typeof value === 'string' ? value.trim() : ''))
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
      error: error instanceof Error ? error.message : 'Unable to connect to qBittorrent',
    };
  }
};

export const renameQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; name: string }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  const name = payload.name.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };
  if (!name) return { enabled: true, connected: false, success: false, error: 'Missing torrent name' };

  const body = new URLSearchParams();
  body.set('hash', safeHash);
  body.set('name', name);

  try {
    await qbFetchText(config, '/api/v2/torrents/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rename torrent',
    };
  }
};

export const renameQbittorrentTorrentFile = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; old_path: string; new_path: string }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  const oldPath = payload.old_path.trim();
  const newPath = payload.new_path.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };
  if (!oldPath || !newPath) return { enabled: true, connected: false, success: false, error: 'Missing file path' };

  const body = new URLSearchParams();
  body.set('hash', safeHash);
  body.set('oldPath', oldPath);
  body.set('newPath', newPath);

  try {
    await qbFetchText(config, '/api/v2/torrents/renameFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rename torrent file',
    };
  }
};

export const setQbittorrentTorrentCategory = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; category: string | null }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };
  const category = payload.category?.trim() ?? '';

  const body = new URLSearchParams();
  body.set('hashes', safeHash);
  body.set('category', category);

  try {
    await qbFetchText(config, '/api/v2/torrents/setCategory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update category',
    };
  }
};

export const setQbittorrentTorrentTags = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; tags: string[]; previous_tags?: string[] | null }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };

  const normalizeList = (list: string[] | null | undefined): string[] =>
    Array.isArray(list)
      ? list
          .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
          .slice(0, 50)
      : [];

  const nextTags = normalizeList(payload.tags);
  const prevTags = normalizeList(payload.previous_tags ?? null);

  try {
    if (prevTags.length > 0) {
      const removeBody = new URLSearchParams();
      removeBody.set('hashes', safeHash);
      removeBody.set('tags', prevTags.join(','));
      await qbFetchText(config, '/api/v2/torrents/removeTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: removeBody.toString(),
      });
    }

    if (nextTags.length > 0) {
      const addBody = new URLSearchParams();
      addBody.set('hashes', safeHash);
      addBody.set('tags', nextTags.join(','));
      await qbFetchText(config, '/api/v2/torrents/addTags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: addBody.toString(),
      });
    }

    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update tags',
    };
  }
};

export const pauseQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };

  const body = new URLSearchParams();
  body.set('hashes', safeHash);

  try {
    await qbFetchText(config, '/api/v2/torrents/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause torrent',
    };
  }
};

export const resumeQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };

  const body = new URLSearchParams();
  body.set('hashes', safeHash);

  try {
    await qbFetchText(config, '/api/v2/torrents/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume torrent',
    };
  }
};

export const reannounceQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };

  const body = new URLSearchParams();
  body.set('hashes', safeHash);

  try {
    await qbFetchText(config, '/api/v2/torrents/reannounce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reannounce torrent',
    };
  }
};

export const deleteQbittorrentTorrent = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { hash: string; delete_files: boolean }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const safeHash = payload.hash.trim();
  if (!safeHash) return { enabled: true, connected: false, success: false, error: 'Missing torrent hash' };

  const body = new URLSearchParams();
  body.set('hashes', safeHash);
  body.set('deleteFiles', payload.delete_files ? 'true' : 'false');

  try {
    await qbFetchText(config, '/api/v2/torrents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete torrent',
    };
  }
};

export const addQbittorrentMagnet = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { magnet: string; save_path?: string | null; category?: string | null; tags?: string[] | null }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  const magnet = payload.magnet.trim();
  if (!magnet.startsWith('magnet:')) {
    return { enabled: true, connected: false, success: false, error: 'Invalid magnet URL' };
  }

  const body = new URLSearchParams();
  body.set('urls', magnet);
  if (payload.save_path) body.set('savepath', payload.save_path);
  if (payload.category) body.set('category', payload.category);
  if (payload.tags && payload.tags.length > 0)
    body.set(
      'tags',
      payload.tags
        .map(tag => tag.trim())
        .filter(Boolean)
        .join(',')
    );

  try {
    await qbFetchText(config, '/api/v2/torrents/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add torrent',
    };
  }
};

export const addQbittorrentTorrentFile = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  payload: { torrent: File; save_path?: string | null; category?: string | null; tags?: string[] | null }
): Promise<{ enabled: boolean; connected: boolean; success: boolean; error?: string }> => {
  if (!enabled) return { enabled: false, connected: false, success: false };
  if (!payload.torrent) return { enabled: true, connected: false, success: false, error: 'Missing torrent file' };

  const formData = new FormData();
  formData.set('torrents', payload.torrent);
  if (payload.save_path) formData.set('savepath', payload.save_path);
  if (payload.category) formData.set('category', payload.category);
  if (payload.tags && payload.tags.length > 0)
    formData.set(
      'tags',
      payload.tags
        .map(tag => tag.trim())
        .filter(Boolean)
        .join(',')
    );

  try {
    await qbFetchText(config, '/api/v2/torrents/add', {
      method: 'POST',
      body: formData,
    });
    return { enabled: true, connected: true, success: true };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add torrent',
    };
  }
};
