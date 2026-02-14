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

const DEFAULT_POLL_INTERVAL_SECONDS = 2;
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
    poll_interval_seconds: clampInt(cfg.poll_interval_seconds, 2, 30, DEFAULT_POLL_INTERVAL_SECONDS),
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
    const torrents = Array.isArray(torrentsRaw) ? torrentsRaw.map(toTorrent).filter((row): row is QbittorrentDashboardTorrent => !!row) : [];
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
