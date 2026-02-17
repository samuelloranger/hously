interface QbittorrentTransferInfo {
  dl_info_speed?: number;
  up_info_speed?: number;
  dl_info_data?: number;
  up_info_data?: number;
}

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

const resetSessionIfConfigChanged = (config: QbittorrentPluginConfig) => {
  const key = buildConfigKey(config);
  if (qbSession.key === key) return;
  qbSession.key = key;
  qbSession.sidCookie = null;
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
    if (torrent.state.startsWith('paused')) pausedCount += 1;
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

export const buildQbittorrentDisabledSnapshot = (error?: string): QbittorrentDashboardSnapshot => ({
  enabled: false,
  connected: false,
  updated_at: new Date().toISOString(),
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
    const [transferInfoRaw, torrentsRaw] = await Promise.all([
      qbFetchJson<QbittorrentTransferInfo>(config, '/api/v2/transfer/info'),
      qbFetchJson<QbittorrentTorrentRaw[]>(config, '/api/v2/torrents/info'),
    ]);

    const transferInfo = toRecord(transferInfoRaw) as QbittorrentTransferInfo | null;
    const torrents = Array.isArray(torrentsRaw)
      ? torrentsRaw.map(toTorrent).filter((row): row is QbittorrentDashboardTorrent => !!row)
      : [];
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
      updated_at: new Date().toISOString(),
      poll_interval_seconds: config.poll_interval_seconds,
      summary: {
        ...summaryCounts,
        download_speed: Math.max(0, Math.trunc(toNumberOr(transferInfo?.dl_info_speed, 0))),
        upload_speed: Math.max(0, Math.trunc(toNumberOr(transferInfo?.up_info_speed, 0))),
        downloaded_bytes: Math.max(0, Math.trunc(toNumberOr(transferInfo?.dl_info_data, 0))),
        uploaded_bytes: Math.max(0, Math.trunc(toNumberOr(transferInfo?.up_info_data, 0))),
      },
      torrents: prioritizedTorrents,
    };
  } catch (error) {
    console.error('Error fetching qBittorrent snapshot:', error);
    return {
      enabled: true,
      connected: false,
      updated_at: new Date().toISOString(),
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

  const url = new URL('/api/v2/torrents/info', config.website_url);
  if (params.filter) url.searchParams.set('filter', params.filter);
  if (params.category) url.searchParams.set('category', params.category);
  if (params.tag) url.searchParams.set('tag', params.tag);
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (typeof params.reverse === 'boolean') url.searchParams.set('reverse', params.reverse ? 'true' : 'false');
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    url.searchParams.set('limit', String(Math.max(1, Math.min(200, Math.trunc(params.limit)))));
  }
  if (typeof params.offset === 'number' && Number.isFinite(params.offset)) {
    url.searchParams.set('offset', String(Math.max(0, Math.trunc(params.offset))));
  }

  try {
    const torrentsRaw = await qbFetchJson<QbittorrentTorrentRaw[]>(config, `${url.pathname}${url.search}`);
    const torrents = Array.isArray(torrentsRaw)
      ? torrentsRaw.map(toTorrentListItem).filter((row): row is QbittorrentTorrentListItem => Boolean(row))
      : [];

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

export const fetchQbittorrentTorrentProperties = async (
  config: QbittorrentPluginConfig,
  enabled: boolean,
  hash: string
): Promise<{ enabled: boolean; connected: boolean; properties: QbittorrentTorrentProperties | null; error?: string }> => {
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
  if (payload.tags && payload.tags.length > 0) body.set('tags', payload.tags.map(tag => tag.trim()).filter(Boolean).join(','));

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
  if (payload.tags && payload.tags.length > 0) formData.set('tags', payload.tags.map(tag => tag.trim()).filter(Boolean).join(','));

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
