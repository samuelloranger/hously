import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import {
  DASHBOARD_ENDPOINTS,
  queryKeys,
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
  type DashboardQbittorrentTorrentsResponse,
  type DashboardQbittorrentTorrentFilesResponse,
  type DashboardQbittorrentTorrentPeersResponse,
  type DashboardQbittorrentTorrentStreamResponse,
} from '@hously/shared';
import { PageLayout } from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/dialog';
import { formatBytes, formatSpeed, formatEta, getStatusConfig } from './utils';
import { TorrentPropertiesTab } from './TorrentPropertiesTab';
import { TorrentFilesTab } from './TorrentFilesTab';
import { TorrentTrackersTab } from './TorrentTrackersTab';
import { TorrentPeersTab } from './TorrentPeersTab';

type TabId = 'properties' | 'files' | 'trackers' | 'peers';

export function TorrentDetailPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);

  const [peersSnapshot, setPeersSnapshot] = useState<DashboardQbittorrentTorrentPeersResponse | null>(null);
  const peersEventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (torrentEventSourceRef.current) {
      torrentEventSourceRef.current.close();
      torrentEventSourceRef.current = null;
    }

    // Seed immediately from the cached torrent list so the page renders with
    // known data (name, state, progress, speeds) while the SSE stream connects.
    const listData = queryClient.getQueryData<DashboardQbittorrentTorrentsResponse>(
      queryKeys.dashboard.qbittorrentTorrents({})
    );
    const cachedTorrent = listData?.torrents.find(t => t.id === torrentHash) ?? null;
    setTorrentSnapshot(
      cachedTorrent ? { enabled: listData!.enabled, connected: listData!.connected, torrent: cachedTorrent } : null
    );

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
    const prev = torrentSnapshot;
    setTorrentSnapshot(snap => (snap?.torrent ? { ...snap, torrent: { ...snap.torrent, name } } : snap));
    renameTorrentMutation.mutate(
      { name },
      {
        onError: () => setTorrentSnapshot(prev),
      }
    );
  };

  const handleSaveCategory = () => {
    if (!selectedTorrent) return;
    const category = draftCategory.trim();
    if ((selectedTorrent.category ?? '') === category) return;
    const prev = torrentSnapshot;
    setTorrentSnapshot(snap => (snap?.torrent ? { ...snap, torrent: { ...snap.torrent, category } } : snap));
    setCategoryMutation.mutate(category ? { category } : {}, {
      onError: () => setTorrentSnapshot(prev),
    });
  };

  const handleSaveTagsFromSelect = (selected: string[]) => {
    if (!selectedTorrent) return;
    const prev = torrentSnapshot;
    setTorrentSnapshot(snap => (snap?.torrent ? { ...snap, torrent: { ...snap.torrent, tags: selected } } : snap));
    setTagsMutation.mutate(
      { tags: selected, previous_tags: selectedTorrent.tags ?? [] },
      {
        onError: () => setTorrentSnapshot(prev),
      }
    );
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    const filesKey = queryKeys.dashboard.qbittorrentTorrentFiles(torrentHash);
    const prevFiles = queryClient.getQueryData<DashboardQbittorrentTorrentFilesResponse>(filesKey);
    queryClient.setQueryData<DashboardQbittorrentTorrentFilesResponse>(filesKey, old =>
      old ? { ...old, files: old.files.map(f => (f.name === oldPath ? { ...f, name: newPath } : f)) } : old
    );
    renameFileMutation.mutate(
      { old_path: oldPath, new_path: newPath },
      {
        onSuccess: () => void filesQuery.refetch(),
        onError: () => queryClient.setQueryData(filesKey, prevFiles),
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

      {/* ── Tab panels ── */}
      {activeTab === 'properties' && (
        <TorrentPropertiesTab
          propertiesQuery={propertiesQuery}
          selectedTorrent={selectedTorrent}
          categories={categories}
          availableTags={availableTags}
          draftName={draftName}
          onDraftNameChange={setDraftName}
          draftCategory={draftCategory}
          onDraftCategoryChange={setDraftCategory}
          onSaveName={handleSaveName}
          onSaveCategory={handleSaveCategory}
          onSaveTags={handleSaveTagsFromSelect}
          isRenamePending={renameTorrentMutation.isPending}
          isCategoryPending={setCategoryMutation.isPending}
        />
      )}

      {activeTab === 'files' && (
        <TorrentFilesTab
          isLoading={filesQuery.isLoading}
          files={filesQuery.data?.files}
          error={filesQuery.data?.error}
          onRenameFile={handleRenameFile}
          isRenamePending={renameFileMutation.isPending}
        />
      )}

      {activeTab === 'trackers' && (
        <TorrentTrackersTab
          isLoading={trackersQuery.isLoading}
          trackers={trackersQuery.data?.trackers}
          error={trackersQuery.data?.error}
        />
      )}

      {activeTab === 'peers' && <TorrentPeersTab peersSnapshot={peersSnapshot} />}

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
