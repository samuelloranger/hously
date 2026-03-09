export { formatBytes, formatSpeed } from '@hously/shared';

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

export function formatEta(seconds: number | null): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds) || seconds > 999 * 3600) return '∞';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getStateFilter(state: string): StateFilter {
  const s = (state ?? '').toLowerCase();
  if (s === 'metadl' || s === 'downloading') return 'downloading';
  if (s === 'uploading' || s === 'stalledup') return 'seeding';
  if (s === 'stalleddl') return 'stalled';
  if (s === 'pauseddl' || s === 'pausedup' || s === 'stopped' || s === 'stoppeddl' || s === 'stoppedup')
    return 'paused';
  if (s === 'completed') return 'complete';
  if (s === 'error' || s === 'missingfiles') return 'error';
  return 'all';
}

export function getStatusDot(state: string): { dot: string; pulse: boolean } {
  const s = (state ?? '').toLowerCase();
  if (s === 'metadl' || s === 'forceddl') return { dot: 'bg-teal-400', pulse: true };
  if (s === 'downloading') return { dot: 'bg-sky-400', pulse: true };
  if (s === 'uploading' || s === 'forcedup') return { dot: 'bg-orange-400', pulse: true };
  if (s === 'stalledup') return { dot: 'bg-rose-400', pulse: false };
  if (s === 'stalleddl') return { dot: 'bg-yellow-400', pulse: false };
  if (s === 'pauseddl' || s === 'pausedup' || s === 'stopped' || s === 'stoppeddl' || s === 'stoppedup')
    return { dot: 'bg-amber-400', pulse: false };
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
    return 'bg-gradient-to-r from-orange-500 to-red-500 dark:from-orange-400 dark:to-red-400';
  if (s === 'stalledup')
    return 'bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-400 dark:to-pink-400 opacity-70';
  if (s === 'stalleddl')
    return 'bg-gradient-to-r from-yellow-400 to-amber-400 dark:from-yellow-300 dark:to-amber-300 opacity-70';
  if (s === 'pauseddl' || s === 'pausedup' || s === 'stopped' || s === 'stoppeddl' || s === 'stoppedup')
    return 'bg-neutral-300 dark:bg-neutral-600';
  if (s === 'completed')
    return 'bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400';
  if (s === 'error' || s === 'missingfiles')
    return 'bg-gradient-to-r from-red-500 to-rose-500 dark:from-red-400 dark:to-rose-400';
  if (s.includes('checking') || s === 'moving')
    return 'bg-gradient-to-r from-cyan-500 to-sky-500 dark:from-cyan-400 dark:to-sky-400';
  return 'bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500';
}

export function getStatusConfig(state: string) {
  const s = (state ?? '').toLowerCase();
  if (s === 'metadl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.metaDl',
      dot: 'bg-teal-400',
      badge: 'text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-400/10 border-teal-200 dark:border-teal-500/30',
      pulse: true,
    };
  }
  if (s === 'downloading') {
    return {
      labelKey: 'dashboard.qbittorrent.states.downloading',
      dot: 'bg-sky-400',
      badge: 'text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10 border-sky-200 dark:border-sky-500/30',
      pulse: true,
    };
  }
  if (s === 'uploading') {
    return {
      labelKey: 'dashboard.qbittorrent.states.uploading',
      dot: 'bg-orange-400',
      badge:
        'text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-400/10 border-orange-200 dark:border-orange-500/30',
      pulse: true,
    };
  }
  if (s === 'stalledup') {
    return {
      labelKey: 'dashboard.qbittorrent.states.stalledUp',
      dot: 'bg-rose-400',
      badge: 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-400/10 border-rose-200 dark:border-rose-500/30',
      pulse: false,
    };
  }
  if (s === 'pauseddl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.pausedDl',
      dot: 'bg-amber-400',
      badge:
        'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
      pulse: false,
    };
  }
  if (s === 'pausedup') {
    return {
      labelKey: 'dashboard.qbittorrent.states.pausedUp',
      dot: 'bg-amber-400',
      badge:
        'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
      pulse: false,
    };
  }
  if (s === 'stopped' || s === 'stoppeddl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.pausedDl',
      dot: 'bg-amber-400',
      badge:
        'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
      pulse: false,
    };
  }
  if (s === 'stoppedup') {
    return {
      labelKey: 'dashboard.qbittorrent.states.pausedUp',
      dot: 'bg-amber-400',
      badge:
        'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-400/10 border-amber-200 dark:border-amber-500/30',
      pulse: false,
    };
  }
  if (s === 'stalleddl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.stalledDl',
      dot: 'bg-yellow-400',
      badge:
        'text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-500/30',
      pulse: false,
    };
  }
  if (s === 'checkingdl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.checkingDl',
      dot: 'bg-cyan-400',
      badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
      pulse: true,
    };
  }
  if (s === 'checkingup') {
    return {
      labelKey: 'dashboard.qbittorrent.states.checkingUp',
      dot: 'bg-cyan-400',
      badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
      pulse: true,
    };
  }
  if (s === 'checkingresumedata') {
    return {
      labelKey: 'dashboard.qbittorrent.states.checkingResumeData',
      dot: 'bg-cyan-400',
      badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
      pulse: true,
    };
  }
  if (s === 'moving') {
    return {
      labelKey: 'dashboard.qbittorrent.states.moving',
      dot: 'bg-cyan-400',
      badge: 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-400/10 border-cyan-200 dark:border-cyan-500/30',
      pulse: true,
    };
  }
  if (s === 'forceddl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.forcedDl',
      dot: 'bg-sky-400',
      badge: 'text-sky-700 bg-sky-50 dark:text-sky-400 dark:bg-sky-400/10 border-sky-200 dark:border-sky-500/30',
      pulse: true,
    };
  }
  if (s === 'forcedup') {
    return {
      labelKey: 'dashboard.qbittorrent.states.forcedUp',
      dot: 'bg-orange-400',
      badge:
        'text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-400/10 border-orange-200 dark:border-orange-500/30',
      pulse: true,
    };
  }
  if (s === 'queueddl') {
    return {
      labelKey: 'dashboard.qbittorrent.states.queuedDl',
      dot: 'bg-neutral-400',
      badge:
        'text-neutral-600 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-400/10 border-neutral-200 dark:border-neutral-500/30',
      pulse: false,
    };
  }
  if (s === 'queuedup') {
    return {
      labelKey: 'dashboard.qbittorrent.states.queuedUp',
      dot: 'bg-neutral-400',
      badge:
        'text-neutral-600 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-400/10 border-neutral-200 dark:border-neutral-500/30',
      pulse: false,
    };
  }
  if (s === 'error') {
    return {
      labelKey: 'dashboard.qbittorrent.states.error',
      dot: 'bg-red-400',
      badge: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10 border-red-200 dark:border-red-500/30',
      pulse: false,
    };
  }
  if (s === 'missingfiles') {
    return {
      labelKey: 'dashboard.qbittorrent.states.missingFiles',
      dot: 'bg-red-400',
      badge: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-400/10 border-red-200 dark:border-red-500/30',
      pulse: false,
    };
  }
  if (s === 'completed') {
    return {
      labelKey: 'dashboard.qbittorrent.states.completed',
      dot: 'bg-emerald-400',
      badge:
        'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-500/30',
      pulse: false,
    };
  }
  return {
    labelKey: 'dashboard.qbittorrent.states.unknown',
    dot: 'bg-neutral-400',
    badge:
      'text-neutral-600 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-400/10 border-neutral-200 dark:border-neutral-500/30',
    pulse: false,
  };
}
