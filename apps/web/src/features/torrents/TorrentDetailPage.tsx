import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  Settings2,
  FileText,
  Server,
  Users,
  HardDrive,
  TrendingDown,
  TrendingUp,
  Activity,
  Clock,
  Tag,
  Check,
  Edit2,
  X as XIcon,
} from 'lucide-react';
import {
  DASHBOARD_ENDPOINTS,
  useDashboardQbittorrentCategories,
  useDashboardQbittorrentTags,
  useDeleteQbittorrentTorrent,
  usePauseQbittorrentTorrent,
  useQbittorrentTorrentFiles,
  useQbittorrentTorrentProperties,
  useQbittorrentTorrentTrackers,
  useRenameQbittorrentTorrent,
  useRenameQbittorrentTorrentFile,
  useResumeQbittorrentTorrent,
  useSetQbittorrentTorrentCategory,
  useSetQbittorrentTorrentTags,
  type DashboardQbittorrentTorrentPeersResponse,
  type DashboardQbittorrentTorrentStreamResponse,
} from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Dialog } from '../../components/dialog';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatEta(seconds: number | null): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds) || seconds > 999 * 3600) return '∞';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type TabId = 'properties' | 'files' | 'trackers' | 'peers';

function getStatusConfig(state: string) {
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

export function TorrentDetailPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { hash } = useParams({ strict: false }) as { hash: string };
  const torrentHash = (hash ?? '').trim();

  const [activeTab, setActiveTab] = useState<TabId>('properties');

  const categoriesQuery = useDashboardQbittorrentCategories();
  const tagsQuery = useDashboardQbittorrentTags();

  const [torrentSnapshot, setTorrentSnapshot] = useState<DashboardQbittorrentTorrentStreamResponse | null>(null);
  const torrentEventSourceRef = useRef<EventSource | null>(null);
  const initializedForHash = useRef('');

  const selectedTorrent = useMemo(() => torrentSnapshot?.torrent ?? null, [torrentSnapshot?.torrent]);

  const isTransferring = (selectedTorrent?.download_speed ?? 0) > 0 || (selectedTorrent?.upload_speed ?? 0) > 0;

  const propertiesQuery = useQbittorrentTorrentProperties(torrentHash || null);
  const trackersQuery = useQbittorrentTorrentTrackers(torrentHash || null);
  const filesQuery = useQbittorrentTorrentFiles(
    torrentHash || null,
    activeTab === 'files' && isTransferring ? 2000 : false
  );

  const renameTorrentMutation = useRenameQbittorrentTorrent(torrentHash);
  const renameFileMutation = useRenameQbittorrentTorrentFile(torrentHash);
  const setCategoryMutation = useSetQbittorrentTorrentCategory(torrentHash);
  const setTagsMutation = useSetQbittorrentTorrentTags(torrentHash);
  const pauseTorrentMutation = usePauseQbittorrentTorrent(torrentHash);
  const resumeTorrentMutation = useResumeQbittorrentTorrent(torrentHash);
  const deleteTorrentMutation = useDeleteQbittorrentTorrent(torrentHash);

  const categories = categoriesQuery.data?.categories ?? [];
  const availableTags = tagsQuery.data?.tags ?? [];

  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState('');

  const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null);
  const [draftFilePath, setDraftFilePath] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);

  const [peersSnapshot, setPeersSnapshot] = useState<DashboardQbittorrentTorrentPeersResponse | null>(null);
  const peersEventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (torrentEventSourceRef.current) {
      torrentEventSourceRef.current.close();
      torrentEventSourceRef.current = null;
    }
    setTorrentSnapshot(null);

    if (!torrentHash) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENT_STREAM(torrentHash), {
      withCredentials: true,
    });
    torrentEventSourceRef.current = source;

    source.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data) as DashboardQbittorrentTorrentStreamResponse;
        setTorrentSnapshot(parsed);
      } catch (error) {
        console.error('Failed to parse qBittorrent torrent stream payload', error);
      }
    };

    return () => {
      source.close();
      if (torrentEventSourceRef.current === source) torrentEventSourceRef.current = null;
    };
  }, [torrentHash]);

  useEffect(() => {
    if (!selectedTorrent) return;
    if (initializedForHash.current === torrentHash) return;
    initializedForHash.current = torrentHash;
    setDraftName(selectedTorrent.name);
    setDraftCategory(selectedTorrent.category ?? '');
  }, [selectedTorrent, torrentHash]);

  useEffect(() => {
    if (peersEventSourceRef.current) {
      peersEventSourceRef.current.close();
      peersEventSourceRef.current = null;
    }
    setPeersSnapshot(null);

    if (!torrentHash) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(DASHBOARD_ENDPOINTS.QBITTORRENT.PEERS_STREAM(torrentHash), {
      withCredentials: true,
    });
    peersEventSourceRef.current = source;

    source.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data) as DashboardQbittorrentTorrentPeersResponse;
        setPeersSnapshot(parsed);
      } catch (error) {
        console.error('Failed to parse qBittorrent peers stream payload', error);
      }
    };

    return () => {
      source.close();
      if (peersEventSourceRef.current === source) peersEventSourceRef.current = null;
    };
  }, [torrentHash]);

  const handleSaveName = () => {
    if (!selectedTorrent) return;
    const name = draftName.trim();
    if (!name || name === selectedTorrent.name) return;
    renameTorrentMutation.mutate({ name });
  };

  const handleSaveCategory = () => {
    if (!selectedTorrent) return;
    const category = draftCategory.trim();
    if ((selectedTorrent.category ?? '') === category) return;
    setCategoryMutation.mutate(category ? { category } : {});
  };

  const handleSaveTagsFromSelect = (selected: string[]) => {
    if (!selectedTorrent) return;
    setTagsMutation.mutate({ tags: selected, previous_tags: selectedTorrent.tags ?? [] }, undefined);
  };

  const beginRenameFile = (path: string) => {
    setRenamingFilePath(path);
    setDraftFilePath(path);
  };

  const cancelRenameFile = () => {
    setRenamingFilePath(null);
    setDraftFilePath('');
  };

  const submitRenameFile = () => {
    if (!renamingFilePath) return;
    const oldPath = renamingFilePath;
    const newPath = draftFilePath.trim();
    if (!newPath || newPath === oldPath) return;
    renameFileMutation.mutate(
      { old_path: oldPath, new_path: newPath },
      {
        onSuccess: () => {
          cancelRenameFile();
          void filesQuery.refetch();
        },
      }
    );
  };

  const handlePause = () => {
    pauseTorrentMutation.mutate(undefined);
  };

  const handleResume = () => {
    resumeTorrentMutation.mutate(undefined);
  };

  const confirmDelete = () => {
    deleteTorrentMutation.mutate(
      { delete_files: deleteFiles },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          setDeleteFiles(false);
          navigate({ to: '/torrents' });
        },
      }
    );
  };

  const trackerStatusLabel = (status: number | null) => {
    switch (status) {
      case 0:
        return t('torrents.trackerStatusDisabled', 'Disabled');
      case 1:
        return t('torrents.trackerStatusNotContacted', 'Not contacted yet');
      case 2:
        return t('torrents.trackerStatusWorking', 'Working');
      case 3:
        return t('torrents.trackerStatusUpdating', 'Updating');
      case 4:
        return t('torrents.trackerStatusNotWorking', 'Not working');
      default:
        return t('torrents.trackerStatusUnknown', 'Unknown');
    }
  };

  const trackerStatusColor = (status: number | null) => {
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
  };

  const formatTrackerNumber = (value: number | null) => (value == null ? '--' : value.toLocaleString());

  const progress = selectedTorrent ? Math.round(selectedTorrent.progress * 100) : 0;
  const statusConfig = getStatusConfig(selectedTorrent?.state ?? '');
  const isPaused = ['pauseddl', 'pausedup', 'stopped', 'stoppeddl', 'stoppedup'].includes(
    (selectedTorrent?.state ?? '').toLowerCase()
  );

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'properties', label: t('torrents.properties', 'Properties'), icon: <Settings2 size={13} /> },
    {
      id: 'files',
      label: t('torrents.filesTitle', 'Files'),
      icon: <FileText size={13} />,
      count: filesQuery.data?.files?.length,
    },
    {
      id: 'trackers',
      label: t('dashboard.qbittorrent.trackers', 'Trackers'),
      icon: <Server size={13} />,
      count: trackersQuery.data?.trackers?.length,
    },
    {
      id: 'peers',
      label: t('torrents.peers', 'Peers'),
      icon: <Users size={13} />,
      count: peersSnapshot?.peers?.length,
    },
  ];

  const props = propertiesQuery.data?.properties;

  return (
    <PageLayout>
      {/* ── Top nav ── */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          to="/torrents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          {t('torrents.backToList', 'Back to torrents')}
        </Link>

        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button
              size="sm"
              onClick={handleResume}
              disabled={resumeTorrentMutation.isPending}
              className="inline-flex items-center gap-1.5"
            >
              <Play size={13} />
              {t('torrents.start', 'Resume')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePause}
              disabled={pauseTorrentMutation.isPending}
              className="inline-flex items-center gap-1.5"
            >
              <Pause size={13} />
              {t('torrents.pause', 'Pause')}
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="inline-flex items-center gap-1.5"
            onClick={() => {
              setDeleteFiles(false);
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={13} />
            {t('torrents.delete', 'Delete')}
          </Button>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 p-5 md:p-6 mb-5">
        {/* Status + category + tag badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {selectedTorrent?.state && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.badge}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusConfig.dot} ${statusConfig.pulse ? 'animate-pulse' : ''}`}
              />
              {t(statusConfig.labelKey)}
            </span>
          )}
          {selectedTorrent?.category && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800">
              <Tag size={10} />
              {selectedTorrent.category}
            </span>
          )}
          {selectedTorrent?.tags?.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/50"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Name */}
        <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white break-words leading-snug">
          {selectedTorrent?.name ?? torrentHash}
        </h1>

        {/* Hash */}
        <p className="mt-1.5 font-mono text-[11px] text-neutral-400 dark:text-neutral-500 select-all tracking-wide">
          #{torrentHash || '--'}
        </p>

        {selectedTorrent && (
          <>
            {/* Progress bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {t('torrents.progress', 'Progress')}
                </span>
                <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white tabular-nums">
                  {progress}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="mt-4 grid grid-cols-3 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-neutral-100 dark:divide-neutral-700/60 border border-neutral-100 dark:border-neutral-700/60 rounded-xl overflow-hidden">
              {[
                { label: t('torrents.size', 'Size'), value: formatBytes(selectedTorrent.size_bytes), Icon: HardDrive },
                {
                  label: t('torrents.download', 'Download'),
                  value: formatSpeed(selectedTorrent.download_speed),
                  Icon: TrendingDown,
                  color: 'text-sky-600 dark:text-sky-400',
                },
                {
                  label: t('torrents.upload', 'Upload'),
                  value: formatSpeed(selectedTorrent.upload_speed),
                  Icon: TrendingUp,
                  color: 'text-orange-500 dark:text-orange-400',
                },
                {
                  label: t('dashboard.qbittorrent.seeds', 'Seeds'),
                  value: String(selectedTorrent.seeds),
                  Icon: Activity,
                },
                { label: t('torrents.peers', 'Peers'), value: String(selectedTorrent.peers), Icon: Users },
                { label: 'ETA', value: formatEta(selectedTorrent.eta_seconds), Icon: Clock },
              ].map(({ label, value, Icon, color }) => (
                <div key={label} className="bg-neutral-50/60 dark:bg-neutral-800/30 px-3 py-3">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-neutral-400 dark:text-neutral-400 font-medium mb-1">
                    <Icon size={10} />
                    {label}
                  </div>
                  <p
                    className={`font-mono text-sm font-semibold tabular-nums truncate ${color ?? 'text-neutral-900 dark:text-neutral-100'}`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-neutral-200 dark:border-neutral-700/60 mb-5">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count != null && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none ${
                    activeTab === tab.id
                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Properties ── */}
      {activeTab === 'properties' && (
        <div className="space-y-5">
          {/* Metadata */}
          {propertiesQuery.isLoading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">{t('common.loading', 'Loading...')}</p>
          ) : props ? (
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  {t('torrents.properties', 'Properties')}
                </h2>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {[
                  { label: t('torrents.savePath', 'Save path'), value: props.save_path, mono: true },
                  {
                    label: t('torrents.totalDownloaded', 'Downloaded'),
                    value: props.total_downloaded_bytes != null ? formatBytes(props.total_downloaded_bytes) : null,
                    mono: true,
                  },
                  {
                    label: t('torrents.totalUploaded', 'Uploaded'),
                    value: props.total_uploaded_bytes != null ? formatBytes(props.total_uploaded_bytes) : null,
                    mono: true,
                  },
                  {
                    label: t('torrents.shareRatio', 'Ratio'),
                    value: props.share_ratio != null ? props.share_ratio.toFixed(3) : null,
                    mono: true,
                  },
                  { label: 'Comment', value: props.comment, mono: false },
                  { label: 'Created', value: props.creation_date, mono: false },
                  { label: 'Added', value: props.addition_date, mono: false },
                  { label: 'Completed', value: props.completion_date, mono: false },
                ]
                  .filter(row => row.value)
                  .map(row => (
                    <div key={row.label} className="px-5 py-3 flex flex-wrap items-start justify-between gap-3">
                      <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400 pt-0.5 min-w-[110px]">
                        {row.label}
                      </span>
                      <span
                        className={`text-sm text-neutral-900 dark:text-neutral-100 break-all text-right ${row.mono ? 'font-mono' : ''}`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">
              {propertiesQuery.data?.error ?? t('torrents.noProperties', 'No properties')}
            </p>
          )}

          {/* Edit controls */}
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
              <Settings2 size={13} className="text-neutral-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Edit
              </h2>
            </div>
            <div className="p-5 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  {t('torrents.renameTorrent', 'Name')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 dark:focus:border-sky-500 transition"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={renameTorrentMutation.isPending || draftName.trim().length === 0}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  {t('torrents.category', 'Category')}
                </label>
                <div className="flex items-center gap-2">
                  <Select value={draftCategory} onChange={e => setDraftCategory(e.target.value)} className="flex-1">
                    <option value="">{t('torrents.noCategory', 'No category')}</option>
                    {categories.map(category => (
                      <option key={category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                  <button
                    onClick={handleSaveCategory}
                    disabled={setCategoryMutation.isPending}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  {t('torrents.tags', 'Tags')}
                </label>
                <div className="space-y-2.5">
                  {selectedTorrent?.tags && selectedTorrent.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTorrent.tags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const next = (selectedTorrent.tags ?? []).filter(t2 => t2 !== tag);
                            handleSaveTagsFromSelect(next);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:border-red-500/30 dark:hover:text-red-400 transition-colors"
                        >
                          <Tag size={9} />
                          {tag}
                          <XIcon size={10} />
                        </button>
                      ))}
                    </div>
                  )}
                  {availableTags.length > 0 && (
                    <Select
                      value=""
                      onChange={e => {
                        const selected = e.target.value;
                        if (!selected) return;
                        const currentTags = selectedTorrent?.tags ?? [];
                        if (currentTags.includes(selected)) return;
                        handleSaveTagsFromSelect([...currentTags, selected]);
                      }}
                    >
                      <option value="">+ {t('torrents.tags', 'Tags')}</option>
                      {availableTags
                        .filter(tag => !(selectedTorrent?.tags ?? []).includes(tag))
                        .map(tag => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Files ── */}
      {activeTab === 'files' && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {filesQuery.isLoading ? (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {t('common.loading', 'Loading...')}
              </div>
            ) : filesQuery.data?.files?.length ? (
              filesQuery.data.files.map(file => (
                <div key={`${file.index}-${file.name}`} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-neutral-700 dark:text-neutral-200 break-all leading-relaxed">
                        {file.name}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1 h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500"
                            style={{ width: `${Math.round(file.progress * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                          {Math.round(file.progress * 100)}% · {formatBytes(file.size_bytes)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => beginRenameFile(file.name)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <Edit2 size={11} />
                      {t('torrents.rename', 'Rename')}
                    </button>
                  </div>

                  {renamingFilePath === file.name && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        value={draftFilePath}
                        onChange={e => setDraftFilePath(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitRenameFile();
                          if (e.key === 'Escape') cancelRenameFile();
                        }}
                        className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={submitRenameFile}
                          disabled={renameFileMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                        >
                          <Check size={12} />
                          {t('common.save', 'Save')}
                        </button>
                        <button
                          onClick={cancelRenameFile}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
                        >
                          <XIcon size={12} />
                          {t('common.cancel', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {filesQuery.data?.error ?? t('torrents.noFiles', 'No files')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Trackers ── */}
      {activeTab === 'trackers' && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {trackersQuery.isLoading ? (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {t('common.loading', 'Loading...')}
              </div>
            ) : trackersQuery.data?.trackers?.length ? (
              trackersQuery.data.trackers.map(tracker => (
                <div key={tracker.url} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <p className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all flex-1 min-w-0">
                      {tracker.url}
                    </p>
                    <span className={`shrink-0 text-xs font-medium ${trackerStatusColor(tracker.status)}`}>
                      {trackerStatusLabel(tracker.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {[
                      { label: t('torrents.trackerSeeds', 'Seeds'), value: formatTrackerNumber(tracker.seeds) },
                      { label: t('torrents.trackerPeers', 'Peers'), value: formatTrackerNumber(tracker.peers) },
                      { label: t('torrents.trackerLeeches', 'Leeches'), value: formatTrackerNumber(tracker.leeches) },
                      {
                        label: t('torrents.trackerDownloaded', 'Downloaded'),
                        value: formatTrackerNumber(tracker.downloaded),
                      },
                    ].map(({ label, value }) => (
                      <span
                        key={label}
                        className="text-[11px] text-neutral-400 dark:text-neutral-400 font-mono tabular-nums"
                      >
                        {label}: <span className="text-neutral-600 dark:text-neutral-300">{value}</span>
                      </span>
                    ))}
                  </div>
                  {tracker.message && (
                    <p className="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                      {tracker.message}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {trackersQuery.data?.error ?? t('dashboard.qbittorrent.noTrackers', 'No trackers found.')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Peers ── */}
      {activeTab === 'peers' && (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
          {peersSnapshot?.connected === false ? (
            <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
              {peersSnapshot.error ?? t('torrents.disconnectedDescription', 'qBittorrent is unreachable.')}
            </div>
          ) : peersSnapshot?.peers?.length ? (
            <div className="max-h-[60dvh] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {peersSnapshot.peers.slice(0, 150).map(peer => (
                <div key={peer.id} className="px-5 py-3.5 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {peer.ip ?? peer.id}
                      {peer.port != null ? `:${peer.port}` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-400 truncate">
                      {peer.client ?? '--'}
                      {peer.country_code ? ` · ${peer.country_code}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">
                        ↓ {peer.download_speed != null ? formatSpeed(peer.download_speed) : '--'}
                      </span>
                      <span className="font-mono text-[11px] text-orange-500 dark:text-orange-400 tabular-nums">
                        ↑ {peer.upload_speed != null ? formatSpeed(peer.upload_speed) : '--'}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-neutral-400 dark:text-neutral-400 tabular-nums">
                      {peer.progress != null ? `${Math.round(peer.progress * 100)}%` : '--'}
                      {peer.relevance != null ? ` · ${peer.relevance.toFixed(2)}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
              {t('torrents.noPeers', 'No peers')}
            </div>
          )}
        </div>
      )}

      {/* ── Delete dialog ── */}
      <Dialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteFiles(false);
        }}
        title={t('torrents.deleteTitle', 'Delete torrent')}
      >
        <div className="space-y-5">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {t('torrents.deleteDescription', 'Do you also want to delete the downloaded files?')}
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={e => setDeleteFiles(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-200">
              {t('torrents.alsoDeleteFiles', 'Also delete files')}
            </span>
          </label>

          {deleteTorrentMutation.error ? (
            <p className="text-sm text-rose-600">
              {String((deleteTorrentMutation.error as any)?.message ?? deleteTorrentMutation.error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteTorrentMutation.isPending}>
              {t('torrents.confirmDelete', 'Delete')}
            </Button>
          </div>
        </div>
      </Dialog>
    </PageLayout>
  );
}
