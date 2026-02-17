import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
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

export function TorrentDetailPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const { hash } = useParams({ strict: false }) as { hash: string };
  const torrentHash = (hash ?? '').trim();

  const categoriesQuery = useDashboardQbittorrentCategories();
  const tagsQuery = useDashboardQbittorrentTags();

  const [torrentSnapshot, setTorrentSnapshot] = useState<DashboardQbittorrentTorrentStreamResponse | null>(null);
  const torrentEventSourceRef = useRef<EventSource | null>(null);

  const selectedTorrent = useMemo(() => torrentSnapshot?.torrent ?? null, [torrentSnapshot?.torrent]);

  const propertiesQuery = useQbittorrentTorrentProperties(torrentHash || null);
  const trackersQuery = useQbittorrentTorrentTrackers(torrentHash || null);
  const filesQuery = useQbittorrentTorrentFiles(torrentHash || null);

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
  const [draftTags, setDraftTags] = useState('');

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

    const source = new EventSource(DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENT_STREAM(torrentHash), { withCredentials: true });
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
    setDraftName(selectedTorrent.name);
    setDraftCategory(selectedTorrent.category ?? '');
    setDraftTags(selectedTorrent.tags?.join(', ') ?? '');
  }, [selectedTorrent]);

  useEffect(() => {
    if (peersEventSourceRef.current) {
      peersEventSourceRef.current.close();
      peersEventSourceRef.current = null;
    }
    setPeersSnapshot(null);

    if (!torrentHash) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(DASHBOARD_ENDPOINTS.QBITTORRENT.PEERS_STREAM(torrentHash), { withCredentials: true });
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

  const handleSaveTags = () => {
    if (!selectedTorrent) return;
    const nextTags = draftTags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 50);
    setTagsMutation.mutate(
      { tags: nextTags, previous_tags: selectedTorrent.tags ?? [] },
      undefined
    );
  };

  const handleSaveTagsFromSelect = (selected: string[]) => {
    if (!selectedTorrent) return;
    setDraftTags(selected.join(', '));
    setTagsMutation.mutate(
      { tags: selected, previous_tags: selectedTorrent.tags ?? [] },
      undefined
    );
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

  const formatTrackerNumber = (value: number | null) => (value == null ? '--' : value.toLocaleString());

  return (
    <PageLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          to="/torrents"
          className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          ← {t('torrents.backToList', 'Back to torrents')}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleResume} disabled={resumeTorrentMutation.isPending}>
            {t('torrents.start', 'Start')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePause} disabled={pauseTorrentMutation.isPending}>
            {t('torrents.pause', 'Pause')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setDeleteFiles(false);
              setDeleteOpen(true);
            }}
          >
            {t('torrents.delete', 'Delete')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
        <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white break-words">
          {selectedTorrent?.name ?? torrentHash}
        </h1>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">#{torrentHash || '--'}</p>

        {selectedTorrent ? (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-700/60 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('torrents.progress', 'Progress')}</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">{Math.round(selectedTorrent.progress * 100)}%</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-700/60 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('torrents.size', 'Size')}</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">{formatBytes(selectedTorrent.size_bytes)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-700/60 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('torrents.download', 'Download')}</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">{formatSpeed(selectedTorrent.download_speed)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-700/60 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('torrents.upload', 'Upload')}</p>
              <p className="text-lg font-semibold text-neutral-900 dark:text-white">{formatSpeed(selectedTorrent.upload_speed)}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6 space-y-5">
          <div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.renameTorrent', 'Rename torrent')}</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              />
              <Button onClick={handleSaveName} disabled={renameTorrentMutation.isPending || draftName.trim().length === 0} size="sm">
                {t('common.save', 'Save')}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.category', 'Category')}</p>
            <div className="mt-2 flex items-center gap-2">
              <Select value={draftCategory} onChange={e => setDraftCategory(e.target.value)} className="w-full">
                <option value="">{t('torrents.noCategory', 'No category')}</option>
                {categories.map(category => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Button onClick={handleSaveCategory} disabled={setCategoryMutation.isPending} size="sm">
                {t('common.save', 'Save')}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.tags', 'Tags')}</p>
            <div className="mt-2 space-y-2">
              <Select
                multiple
                value={draftTags
                  .split(',')
                  .map(tag => tag.trim())
                  .filter(Boolean)}
                onChange={e => {
                  const selected = Array.from(e.currentTarget.selectedOptions).map(option => option.value);
                  handleSaveTagsFromSelect(selected);
                }}
                className="w-full h-32"
              >
                {availableTags.map(tag => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-2">
                <input
                  value={draftTags}
                  onChange={e => setDraftTags(e.target.value)}
                  placeholder={t('torrents.tagsPlaceholder', 'tag1, tag2')}
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                />
                <Button onClick={handleSaveTags} disabled={setTagsMutation.isPending} size="sm">
                  {t('common.save', 'Save')}
                </Button>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {t('torrents.tagsHint', 'Tip: hold Ctrl/Cmd to select multiple tags.')}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('torrents.properties', 'Properties')}</h2>
          {propertiesQuery.isLoading ? (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</p>
          ) : propertiesQuery.data?.properties ? (
            <div className="mt-3 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              <div className="flex flex-wrap justify-between gap-3">
                <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.savePath', 'Save path')}</span>
                <span className="font-medium break-all">{propertiesQuery.data.properties.save_path ?? '--'}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.totalDownloaded', 'Downloaded')}</span>
                <span className="font-medium">
                  {propertiesQuery.data.properties.total_downloaded_bytes != null
                    ? formatBytes(propertiesQuery.data.properties.total_downloaded_bytes)
                    : '--'}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.totalUploaded', 'Uploaded')}</span>
                <span className="font-medium">
                  {propertiesQuery.data.properties.total_uploaded_bytes != null
                    ? formatBytes(propertiesQuery.data.properties.total_uploaded_bytes)
                    : '--'}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.shareRatio', 'Ratio')}</span>
                <span className="font-medium">
                  {propertiesQuery.data.properties.share_ratio != null ? propertiesQuery.data.properties.share_ratio.toFixed(2) : '--'}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {propertiesQuery.data?.error ?? t('torrents.noProperties', 'No properties')}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('dashboard.qbittorrent.trackers', 'Trackers')}</h2>
          {trackersQuery.isLoading ? (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</p>
          ) : trackersQuery.data?.trackers?.length ? (
            <div className="mt-3 space-y-2">
              {trackersQuery.data.trackers.map(tracker => (
                <div key={tracker.url} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 break-all">{tracker.url}</p>
                  <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t('torrents.trackerStatus', 'Status')}: {trackerStatusLabel(tracker.status)} •{' '}
                    {t('torrents.trackerSeeds', 'Seeds')}: {formatTrackerNumber(tracker.seeds)} •{' '}
                    {t('torrents.trackerPeers', 'Peers')}: {formatTrackerNumber(tracker.peers)} •{' '}
                    {t('torrents.trackerLeeches', 'Leeches')}: {formatTrackerNumber(tracker.leeches)} •{' '}
                    {t('torrents.trackerDownloaded', 'Downloaded')}: {formatTrackerNumber(tracker.downloaded)}
                  </p>
                  {tracker.message ? (
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{tracker.message}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {trackersQuery.data?.error ?? t('dashboard.qbittorrent.noTrackers', 'No trackers found.')}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-6">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">{t('torrents.peers', 'Peers')}</h2>
          {peersSnapshot?.connected === false ? (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {peersSnapshot.error ?? t('torrents.disconnectedDescription', 'qBittorrent is unreachable.')}
            </p>
          ) : peersSnapshot?.peers?.length ? (
            <div className="mt-3 space-y-2 max-h-[55dvh] overflow-y-auto">
              {peersSnapshot.peers.slice(0, 150).map(peer => (
                <div key={peer.id} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {peer.ip ?? peer.id}
                        {peer.port != null ? `:${peer.port}` : ''}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {peer.client ?? '--'} {peer.country_code ? `• ${peer.country_code}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        ↓ {peer.download_speed != null ? formatSpeed(peer.download_speed) : '--'}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        ↑ {peer.upload_speed != null ? formatSpeed(peer.upload_speed) : '--'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span>
                      {t('torrents.peerProgress', 'Progress')}: {peer.progress != null ? `${Math.round(peer.progress * 100)}%` : '--'}
                    </span>
                    <span>
                      {t('torrents.relevance', 'Rel')}: {peer.relevance != null ? peer.relevance.toFixed(2) : '--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('torrents.noPeers', 'No peers')}</p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{t('torrents.filesTitle', 'Files')}</h2>
            </div>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {filesQuery.isLoading ? (
              <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</div>
            ) : filesQuery.data?.files?.length ? (
              filesQuery.data.files.map(file => (
                <div key={`${file.index}-${file.name}`} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 break-all">{file.name}</p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {formatBytes(file.size_bytes)} • {Math.round(file.progress * 100)}%
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => beginRenameFile(file.name)}>
                      {t('torrents.rename', 'Rename')}
                    </Button>
                  </div>

                  {renamingFilePath === file.name ? (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        value={draftFilePath}
                        onChange={e => setDraftFilePath(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                      />
                      <div className="flex items-center gap-2">
                        <Button onClick={submitRenameFile} disabled={renameFileMutation.isPending} size="sm">
                          {t('common.save', 'Save')}
                        </Button>
                        <Button onClick={cancelRenameFile} variant="secondary" size="sm">
                          {t('common.cancel', 'Cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">
                {filesQuery.data?.error ?? t('torrents.noFiles', 'No files')}
              </div>
            )}
          </div>
        </div>
      </div>

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

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={e => setDeleteFiles(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
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
