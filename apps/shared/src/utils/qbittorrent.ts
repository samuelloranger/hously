import type {
  DashboardQbittorrentTorrentsResponse,
  QbittorrentTorrentListItem,
  QbittorrentTorrentTracker,
} from '../types';

export type QbittorrentStateFilter =
  | 'all'
  | 'downloading'
  | 'uploading'
  | 'seeding'
  | 'paused'
  | 'complete'
  | 'stalled'
  | 'error';

export type QbittorrentSortKey = 'name' | 'ratio' | 'added_on' | 'size' | 'download_speed' | 'upload_speed';
export type QbittorrentSortDir = 'asc' | 'desc';

export const QBITTORRENT_STATE_FILTERS: { id: QbittorrentStateFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'torrents.filterAll' },
  { id: 'downloading', labelKey: 'torrents.filterDownloading' },
  { id: 'uploading', labelKey: 'torrents.filterUploading' },
  { id: 'seeding', labelKey: 'torrents.filterSeeding' },
  { id: 'paused', labelKey: 'torrents.filterPaused' },
  { id: 'complete', labelKey: 'torrents.filterComplete' },
  { id: 'stalled', labelKey: 'torrents.filterStalled' },
  { id: 'error', labelKey: 'torrents.filterError' },
];

const QBITTORRENT_PAUSED_STATES = new Set(['pauseddl', 'pausedup', 'stopped', 'stoppeddl', 'stoppedup']);
const QBITTORRENT_SEEDING_STATES = new Set(['uploading', 'stalledup']);
const QBITTORRENT_ERROR_STATES = new Set(['error', 'missingfiles']);
const QBITTORRENT_CHECKING_STATUS = {
  labelKey: 'dashboard.qbittorrent.states.checkingDl',
  dot: 'bg-cyan-400',
  badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
  pulse: true,
} as const;
const QBITTORRENT_UNKNOWN_STATUS = {
  labelKey: 'dashboard.qbittorrent.states.unknown',
  dot: 'bg-neutral-400',
  badge:
    'text-neutral-600 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-400/10 border-neutral-200 dark:border-neutral-500/30',
  pulse: false,
} as const;
const QBITTORRENT_PROGRESS_GRADIENT_DEFAULT =
  'bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500';

const QBITTORRENT_STATUS_CONFIG: Record<
  string,
  { labelKey: string; dot: string; badge: string; pulse: boolean }
> = {
  metadl: {
    labelKey: 'dashboard.qbittorrent.states.metaDl',
    dot: 'bg-teal-400',
    badge: 'text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-400/10 border-teal-200 dark:border-teal-500/30',
    pulse: true,
  },
  downloading: {
    labelKey: 'dashboard.qbittorrent.states.downloading',
    dot: 'bg-sky-400',
    badge: 'text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10 border-sky-200 dark:border-sky-500/30',
    pulse: true,
  },
  uploading: {
    labelKey: 'dashboard.qbittorrent.states.uploading',
    dot: 'bg-emerald-400',
    badge:
      'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-500/30',
    pulse: true,
  },
  stalledup: {
    labelKey: 'dashboard.qbittorrent.states.stalledUp',
    dot: 'bg-emerald-400',
    badge:
      'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-500/30',
    pulse: false,
  },
  pauseddl: {
    labelKey: 'dashboard.qbittorrent.states.pausedDl',
    dot: 'bg-amber-400',
    badge:
      'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
    pulse: false,
  },
  pausedup: {
    labelKey: 'dashboard.qbittorrent.states.pausedUp',
    dot: 'bg-amber-400',
    badge:
      'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
    pulse: false,
  },
  stopped: {
    labelKey: 'dashboard.qbittorrent.states.pausedDl',
    dot: 'bg-amber-400',
    badge:
      'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
    pulse: false,
  },
  stoppeddl: {
    labelKey: 'dashboard.qbittorrent.states.pausedDl',
    dot: 'bg-amber-400',
    badge:
      'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
    pulse: false,
  },
  stoppedup: {
    labelKey: 'dashboard.qbittorrent.states.pausedUp',
    dot: 'bg-amber-400',
    badge:
      'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
    pulse: false,
  },
  stalleddl: {
    labelKey: 'dashboard.qbittorrent.states.stalledDl',
    dot: 'bg-yellow-400',
    badge:
      'text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-500/30',
    pulse: false,
  },
  checkingdl: {
    labelKey: 'dashboard.qbittorrent.states.checkingDl',
    dot: 'bg-cyan-400',
    badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
    pulse: true,
  },
  checkingup: {
    labelKey: 'dashboard.qbittorrent.states.checkingUp',
    dot: 'bg-cyan-400',
    badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
    pulse: true,
  },
  checkingresumedata: {
    labelKey: 'dashboard.qbittorrent.states.checkingResumeData',
    dot: 'bg-cyan-400',
    badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
    pulse: true,
  },
  moving: {
    labelKey: 'dashboard.qbittorrent.states.moving',
    dot: 'bg-cyan-400',
    badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
    pulse: true,
  },
  forceddl: {
    labelKey: 'dashboard.qbittorrent.states.forcedDl',
    dot: 'bg-sky-400',
    badge: 'text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10 border-sky-200 dark:border-sky-500/30',
    pulse: true,
  },
  forcedup: {
    labelKey: 'dashboard.qbittorrent.states.forcedUp',
    dot: 'bg-emerald-400',
    badge:
      'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-500/30',
    pulse: true,
  },
  queueddl: {
    labelKey: 'dashboard.qbittorrent.states.queuedDl',
    dot: 'bg-neutral-400',
    badge:
      'text-neutral-600 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-400/10 border-neutral-200 dark:border-neutral-500/30',
    pulse: false,
  },
  queuedup: {
    labelKey: 'dashboard.qbittorrent.states.queuedUp',
    dot: 'bg-neutral-400',
    badge:
      'text-neutral-600 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-400/10 border-neutral-200 dark:border-neutral-500/30',
    pulse: false,
  },
  error: {
    labelKey: 'dashboard.qbittorrent.states.error',
    dot: 'bg-red-400',
    badge: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10 border-red-200 dark:border-red-500/30',
    pulse: false,
  },
  missingfiles: {
    labelKey: 'dashboard.qbittorrent.states.missingFiles',
    dot: 'bg-red-400',
    badge: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10 border-red-200 dark:border-red-500/30',
    pulse: false,
  },
  completed: {
    labelKey: 'dashboard.qbittorrent.states.completed',
    dot: 'bg-emerald-400',
    badge:
      'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-500/30',
    pulse: false,
  },
};

const QBITTORRENT_PROGRESS_GRADIENTS: Record<string, string> = {
  metadl: QBITTORRENT_PROGRESS_GRADIENT_DEFAULT,
  downloading: QBITTORRENT_PROGRESS_GRADIENT_DEFAULT,
  forceddl: QBITTORRENT_PROGRESS_GRADIENT_DEFAULT,
  uploading: 'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400',
  forcedup: 'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400',
  stalledup:
    'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400 opacity-70',
  stalleddl:
    'bg-gradient-to-r from-yellow-400 to-amber-400 dark:from-yellow-300 dark:to-amber-300 opacity-70',
  pauseddl: 'bg-neutral-300 dark:bg-neutral-600',
  pausedup: 'bg-neutral-300 dark:bg-neutral-600',
  stopped: 'bg-neutral-300 dark:bg-neutral-600',
  stoppeddl: 'bg-neutral-300 dark:bg-neutral-600',
  stoppedup: 'bg-neutral-300 dark:bg-neutral-600',
  completed: 'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400',
  error: 'bg-gradient-to-r from-red-500 to-rose-500 dark:from-red-400 dark:to-rose-400',
  missingfiles: 'bg-gradient-to-r from-red-500 to-rose-500 dark:from-red-400 dark:to-rose-400',
  moving: 'bg-gradient-to-r from-cyan-500 to-sky-500 dark:from-cyan-400 dark:to-sky-400',
};

export function formatQbittorrentEta(seconds: number | null): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds) || seconds > 999 * 3600) return '∞';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getQbittorrentStateFilter(state: string): QbittorrentStateFilter {
  const normalizedState = normalizeQbittorrentState(state);
  if (normalizedState === 'metadl' || normalizedState === 'downloading') return 'downloading';
  if (QBITTORRENT_SEEDING_STATES.has(normalizedState)) return 'seeding';
  if (normalizedState === 'stalleddl') return 'stalled';
  if (QBITTORRENT_PAUSED_STATES.has(normalizedState)) return 'paused';
  if (normalizedState === 'completed') return 'complete';
  if (QBITTORRENT_ERROR_STATES.has(normalizedState)) return 'error';
  return 'all';
}

export function isQbittorrentPausedState(state: string): boolean {
  return QBITTORRENT_PAUSED_STATES.has(normalizeQbittorrentState(state));
}

export function isQbittorrentActivelyUploading(
  torrent: Pick<QbittorrentTorrentListItem, 'state' | 'upload_speed'>
): boolean {
  return getQbittorrentStateFilter(torrent.state) === 'seeding' && torrent.upload_speed > 0;
}

export function matchesQbittorrentStateFilter(
  torrent: Pick<QbittorrentTorrentListItem, 'state' | 'upload_speed'>,
  filter: QbittorrentStateFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'uploading') return isQbittorrentActivelyUploading(torrent);
  return getQbittorrentStateFilter(torrent.state) === filter;
}

export function getQbittorrentStatusConfig(state: string) {
  const normalizedState = normalizeQbittorrentState(state);
  if (normalizedState.includes('checking')) return QBITTORRENT_CHECKING_STATUS;
  return QBITTORRENT_STATUS_CONFIG[normalizedState] ?? QBITTORRENT_UNKNOWN_STATUS;
}

export function getQbittorrentStatusDot(state: string): { dot: string; pulse: boolean } {
  const { dot, pulse } = getQbittorrentStatusConfig(state);
  return { dot, pulse };
}

export function getQbittorrentProgressBarGradient(state: string): string {
  const normalizedState = normalizeQbittorrentState(state);
  if (normalizedState.includes('checking')) {
    return 'bg-gradient-to-r from-cyan-500 to-sky-500 dark:from-cyan-400 dark:to-sky-400';
  }
  return QBITTORRENT_PROGRESS_GRADIENTS[normalizedState] ?? QBITTORRENT_PROGRESS_GRADIENT_DEFAULT;
}

export function getQbittorrentTrackerStatusLabelKey(status: number | null): string {
  switch (status) {
    case 0:
      return 'torrents.trackerStatusDisabled';
    case 1:
      return 'torrents.trackerStatusNotContacted';
    case 2:
      return 'torrents.trackerStatusWorking';
    case 3:
      return 'torrents.trackerStatusUpdating';
    case 4:
      return 'torrents.trackerStatusNotWorking';
    default:
      return 'torrents.trackerStatusUnknown';
  }
}

export function getQbittorrentTrackerStatusColor(status: number | null): string {
  switch (status) {
    case 2:
      return 'text-emerald-600 dark:text-emerald-400';
    case 3:
      return 'text-sky-600 dark:text-sky-400';
    case 4:
      return 'text-red-500 dark:text-red-400';
    case 1:
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-neutral-400';
  }
}

export function formatQbittorrentTrackerNumber(value: number | null): string {
  return value == null ? '--' : value.toLocaleString();
}

export function getUniqueQbittorrentCategories(torrents: QbittorrentTorrentListItem[]): string[] {
  return Array.from(new Set(torrents.map(torrent => torrent.category).filter(Boolean))) as string[];
}

export function getUniqueQbittorrentTags(torrents: QbittorrentTorrentListItem[]): string[] {
  return Array.from(new Set(torrents.flatMap(torrent => torrent.tags).filter(Boolean)));
}

export function filterAndSortQbittorrentTorrents(
  torrents: QbittorrentTorrentListItem[],
  options: {
    search: string;
    stateFilter: QbittorrentStateFilter;
    selectedCategories: string[];
    selectedTags: string[];
    sortBy: QbittorrentSortKey;
    sortDir: QbittorrentSortDir;
  }
): QbittorrentTorrentListItem[] {
  let result = torrents;
  const query = options.search.trim().toLowerCase();

  if (query) {
    result = result.filter(torrent => torrent.name.toLowerCase().includes(query));
  }

  if (options.stateFilter !== 'all') {
    result = result.filter(torrent => matchesQbittorrentStateFilter(torrent, options.stateFilter));
  }

  if (options.selectedCategories.length > 0) {
    result = result.filter(
      torrent => torrent.category !== null && options.selectedCategories.includes(torrent.category)
    );
  }

  if (options.selectedTags.length > 0) {
    result = result.filter(torrent => options.selectedTags.some(tag => torrent.tags.includes(tag)));
  }

  return [...result].sort((left, right) => {
    let comparison = 0;

    if (options.sortBy === 'name') comparison = left.name.localeCompare(right.name);
    else if (options.sortBy === 'ratio') comparison = (left.ratio ?? -1) - (right.ratio ?? -1);
    else if (options.sortBy === 'added_on') comparison = (left.added_on ?? '').localeCompare(right.added_on ?? '');
    else if (options.sortBy === 'size') comparison = left.size_bytes - right.size_bytes;
    else if (options.sortBy === 'download_speed') comparison = left.download_speed - right.download_speed;
    else if (options.sortBy === 'upload_speed') comparison = left.upload_speed - right.upload_speed;

    return options.sortDir === 'asc' ? comparison : -comparison;
  });
}

export function countQbittorrentTorrentsByState(
  torrents: QbittorrentTorrentListItem[]
): Partial<Record<QbittorrentStateFilter, number>> {
  const counts: Partial<Record<QbittorrentStateFilter, number>> = {};

  for (const torrent of torrents) {
    const stateFilter = getQbittorrentStateFilter(torrent.state);
    counts[stateFilter] = (counts[stateFilter] ?? 0) + 1;

    if (matchesQbittorrentStateFilter(torrent, 'uploading')) {
      counts.uploading = (counts.uploading ?? 0) + 1;
    }
  }

  return counts;
}

export function buildQbittorrentTorrentSearchParams(params?: {
  filter?: string;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
}): string {
  const search = new URLSearchParams();
  if (params?.filter) search.set('filter', params.filter);
  if (params?.category) search.set('category', params.category);
  if (params?.tag) search.set('tag', params.tag);
  if (params?.sort) search.set('sort', params.sort);
  if (typeof params?.reverse === 'boolean') search.set('reverse', params.reverse ? 'true' : 'false');
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') search.set('offset', String(params.offset));
  return search.toString();
}

export function createQbittorrentUploadFormData(input: {
  torrents: File | File[];
  category?: string;
  tags?: string[];
}): FormData {
  const formData = new FormData();
  const files = Array.isArray(input.torrents) ? input.torrents : [input.torrents];

  files.forEach(file => {
    formData.append('torrents', file);
  });

  if (input.category) formData.append('category', input.category);
  if (input.tags && input.tags.length > 0) formData.append('tags', input.tags.join(','));

  return formData;
}

export function toggleQbittorrentTagSelection(selectedTags: string[], tag: string): string[] {
  return selectedTags.includes(tag) ? selectedTags.filter(value => value !== tag) : [...selectedTags, tag];
}

export function toOptionalQbittorrentTags(tags: string[]): string[] | undefined {
  return tags.length > 0 ? tags : undefined;
}

export function toOptionalQbittorrentString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasQbittorrentTransferActivity(
  torrent: Pick<QbittorrentTorrentListItem, 'download_speed' | 'upload_speed'>
): boolean {
  return torrent.download_speed > 0 || torrent.upload_speed > 0;
}

export function mergeQbittorrentFiles(existingFiles: File[], incomingFiles: ArrayLike<File>): File[] {
  const knownFiles = new Set(existingFiles.map(file => getQbittorrentFileKey(file)));
  const nextFiles = Array.from<File>(incomingFiles).filter(file => !knownFiles.has(getQbittorrentFileKey(file)));
  return [...existingFiles, ...nextFiles];
}

export function getQbittorrentStreamSnapshot(
  listData: DashboardQbittorrentTorrentsResponse | undefined,
  torrentHash: string
) {
  const torrent = listData?.torrents.find(item => item.id === torrentHash) ?? null;
  if (!torrent || !listData) return null;
  return {
    enabled: listData.enabled,
    connected: listData.connected,
    torrent,
  };
}

export function normalizeQbittorrentUploadTags(tags: unknown): string[] | null {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags !== 'string') return null;

  const normalizedTags = tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

  return normalizedTags.length > 0 ? normalizedTags : null;
}

export function toQbittorrentFileList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export function isValidQbittorrentUploadFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

export function parseQbittorrentRid(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.trunc(parsed));
}

export function getQbittorrentTrackerStats(trackers: QbittorrentTorrentTracker[]) {
  return trackers.map(tracker => [
    { labelKey: 'torrents.trackerSeeds', fallback: 'Seeds', value: formatQbittorrentTrackerNumber(tracker.seeds) },
    { labelKey: 'torrents.trackerPeers', fallback: 'Peers', value: formatQbittorrentTrackerNumber(tracker.peers) },
    {
      labelKey: 'torrents.trackerLeeches',
      fallback: 'Leeches',
      value: formatQbittorrentTrackerNumber(tracker.leeches),
    },
    {
      labelKey: 'torrents.trackerDownloaded',
      fallback: 'Downloaded',
      value: formatQbittorrentTrackerNumber(tracker.downloaded),
    },
  ]);
}

function normalizeQbittorrentState(state: string): string {
  return (state ?? '').toLowerCase();
}

function getQbittorrentFileKey(file: File): string {
  return `${file.name}:${file.size}`;
}
