export type StateFilter = 'all' | 'downloading' | 'seeding' | 'paused' | 'complete' | 'stalled' | 'error';
export type SortKey = 'name' | 'ratio' | 'added_on' | 'size' | 'download_speed' | 'upload_speed';
export type SortDir = 'asc' | 'desc';

export const STATE_FILTERS: { id: StateFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'torrents.filterAll' },
  { id: 'downloading', labelKey: 'torrents.filterDownloading' },
  { id: 'seeding', labelKey: 'torrents.filterSeeding' },
  { id: 'paused', labelKey: 'torrents.filterPaused' },
  { id: 'complete', labelKey: 'torrents.filterComplete' },
  { id: 'stalled', labelKey: 'torrents.filterStalled' },
  { id: 'error', labelKey: 'torrents.filterError' },
];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds: number | null): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds) || seconds > 999 * 3600) return '∞';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function getStateFilter(state: string): StateFilter {
  const s = (state ?? '').toLowerCase();
  if (s === 'metadl' || s === 'downloading') return 'downloading';
  if (s === 'uploading' || s === 'stalledup') return 'seeding';
  if (s === 'stalleddl') return 'stalled';
  if (s === 'pauseddl' || s === 'pausedup' || s === 'stopped') return 'paused';
  if (s === 'completed') return 'complete';
  if (s === 'error' || s === 'missingfiles') return 'error';
  return 'all';
}

export function getStatusDot(state: string): { dot: string; pulse: boolean } {
  const s = (state ?? '').toLowerCase();
  if (s === 'metadl' || s === 'forceddl') return { dot: 'bg-teal-400', pulse: true };
  if (s === 'downloading') return { dot: 'bg-sky-400', pulse: true };
  if (s === 'uploading' || s === 'forcedup') return { dot: 'bg-violet-400', pulse: true };
  if (s === 'stalledup') return { dot: 'bg-violet-400', pulse: false };
  if (s === 'stalleddl') return { dot: 'bg-orange-400', pulse: false };
  if (s === 'pauseddl' || s === 'pausedup' || s === 'stopped') return { dot: 'bg-amber-400', pulse: false };
  if (s === 'completed') return { dot: 'bg-emerald-400', pulse: false };
  if (s === 'error' || s === 'missingfiles') return { dot: 'bg-red-400', pulse: false };
  if (s === 'moving' || s.includes('checking')) return { dot: 'bg-cyan-400', pulse: true };
  if (s === 'queueddl' || s === 'queuedup') return { dot: 'bg-neutral-400', pulse: false };
  return { dot: 'bg-neutral-400', pulse: false };
}

export function getProgressBarGradient(state: string): string {
  const s = (state ?? '').toLowerCase();
  if (s === 'downloading' || s === 'forceddl' || s === 'metadl')
    return 'bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500';
  if (s === 'uploading' || s === 'forcedup')
    return 'bg-gradient-to-r from-violet-500 to-purple-600 dark:from-violet-400 dark:to-purple-500';
  if (s === 'stalledup')
    return 'bg-gradient-to-r from-violet-400 to-purple-500 dark:from-violet-300 dark:to-purple-400 opacity-60';
  if (s === 'stalleddl') return 'bg-gradient-to-r from-orange-500 to-amber-500 dark:from-orange-400 dark:to-amber-400';
  if (s === 'pauseddl' || s === 'pausedup' || s === 'stopped') return 'bg-neutral-300 dark:bg-neutral-600';
  if (s === 'completed')
    return 'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400';
  if (s === 'error' || s === 'missingfiles')
    return 'bg-gradient-to-r from-red-500 to-rose-500 dark:from-red-400 dark:to-rose-400';
  if (s.includes('checking') || s === 'moving')
    return 'bg-gradient-to-r from-cyan-500 to-sky-500 dark:from-cyan-400 dark:to-sky-400';
  return 'bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500';
}
