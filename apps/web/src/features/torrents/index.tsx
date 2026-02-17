import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DASHBOARD_ENDPOINTS,
  useAddQbittorrentMagnet,
  useAddQbittorrentTorrentFile,
  useDashboardQbittorrentCategories,
  useDashboardQbittorrentTags,
  useDashboardQbittorrentTorrents,
  useQbittorrentTorrentFiles,
  useQbittorrentTorrentProperties,
  useQbittorrentTorrentTrackers,
  useRenameQbittorrentTorrent,
  useRenameQbittorrentTorrentFile,
  useSetQbittorrentTorrentCategory,
  useSetQbittorrentTorrentTags,
  usePauseQbittorrentTorrent,
  useResumeQbittorrentTorrent,
  useDeleteQbittorrentTorrent,
  type DashboardQbittorrentTorrentPeersResponse,
} from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/ui/select';

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

export function TorrentsPage() {
  const { t } = useTranslation('common');

  const torrentsQuery = useDashboardQbittorrentTorrents({ sort: 'added_on', reverse: true, limit: 250 });
  const categoriesQuery = useDashboardQbittorrentCategories();
  const tagsQuery = useDashboardQbittorrentTags();
  const addMagnetMutation = useAddQbittorrentMagnet();
  const addFileMutation = useAddQbittorrentTorrentFile();

  const [magnet, setMagnet] = useState('');
  const [search, setSearch] = useState('');
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const selectedTorrent = useMemo(() => {
    const safeHash = selectedHash?.trim() ?? '';
    if (!safeHash) return null;
    return torrentsQuery.data?.torrents?.find(row => row.id === safeHash) ?? null;
  }, [selectedHash, torrentsQuery.data?.torrents]);

  const torrentHash = selectedTorrent?.id ?? null;
  const propertiesQuery = useQbittorrentTorrentProperties(torrentHash);
  const trackersQuery = useQbittorrentTorrentTrackers(torrentHash);
  const filesQuery = useQbittorrentTorrentFiles(torrentHash);

  const renameTorrentMutation = useRenameQbittorrentTorrent(selectedTorrent?.id ?? '');
  const renameFileMutation = useRenameQbittorrentTorrentFile(selectedTorrent?.id ?? '');
  const setCategoryMutation = useSetQbittorrentTorrentCategory(selectedTorrent?.id ?? '');
  const setTagsMutation = useSetQbittorrentTorrentTags(selectedTorrent?.id ?? '');
  const pauseTorrentMutation = usePauseQbittorrentTorrent(selectedTorrent?.id ?? '');
  const resumeTorrentMutation = useResumeQbittorrentTorrent(selectedTorrent?.id ?? '');
  const deleteTorrentMutation = useDeleteQbittorrentTorrent(selectedTorrent?.id ?? '');

  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null);
  const [draftFilePath, setDraftFilePath] = useState('');

  const [peersSnapshot, setPeersSnapshot] = useState<DashboardQbittorrentTorrentPeersResponse | null>(null);
  const peersEventSourceRef = useRef<EventSource | null>(null);

  const torrents = torrentsQuery.data?.torrents ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return torrents;
    return torrents.filter(row => row.name.toLowerCase().includes(q));
  }, [search, torrents]);

  const canInteract = !addMagnetMutation.isPending && !addFileMutation.isPending;
  const isDisabled = torrentsQuery.data?.enabled === false;
  const isDisconnected = torrentsQuery.data?.connected === false;

  const categories = categoriesQuery.data?.categories ?? [];
  const availableTags = tagsQuery.data?.tags ?? [];

  useEffect(() => {
    if (!selectedTorrent) {
      setDraftName('');
      setDraftCategory('');
      setDraftTags('');
      return;
    }
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
    source.onerror = () => {
      // Browser will retry automatically; keep last payload.
    };

    return () => {
      source.close();
      if (peersEventSourceRef.current === source) peersEventSourceRef.current = null;
    };
  }, [torrentHash]);

  const handleAddMagnet = () => {
    const value = magnet.trim();
    if (!value) return;
    addMagnetMutation.mutate(
      { magnet: value },
      {
        onSuccess: () => {
          setMagnet('');
          void torrentsQuery.refetch();
        },
      }
    );
  };

  const handleAddFile = (file: File | null) => {
    if (!file) return;
    addFileMutation.mutate(file, {
      onSuccess: () => {
        void torrentsQuery.refetch();
      },
    });
  };

  const handleSaveName = () => {
    if (!selectedTorrent) return;
    const name = draftName.trim();
    if (!name || name === selectedTorrent.name) return;
    renameTorrentMutation.mutate(
      { name },
      {
        onSuccess: () => {
          void torrentsQuery.refetch();
        },
      }
    );
  };

  const handleSaveCategory = () => {
    if (!selectedTorrent) return;
    const category = draftCategory.trim();
    if ((selectedTorrent.category ?? '') === category) return;
    setCategoryMutation.mutate(
      category ? { category } : {},
      {
        onSuccess: () => {
          void torrentsQuery.refetch();
        },
      }
    );
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
      {
        onSuccess: () => {
          void torrentsQuery.refetch();
        },
      }
    );
  };

  const handleSaveTagsFromSelect = (selected: string[]) => {
    if (!selectedTorrent) return;
    setDraftTags(selected.join(', '));
    setTagsMutation.mutate(
      { tags: selected, previous_tags: selectedTorrent.tags ?? [] },
      {
        onSuccess: () => {
          void torrentsQuery.refetch();
        },
      }
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
    if (!selectedTorrent || !renamingFilePath) return;
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
    if (!selectedTorrent) return;
    pauseTorrentMutation.mutate(undefined, {
      onSuccess: () => {
        void torrentsQuery.refetch();
      },
    });
  };

  const handleResume = () => {
    if (!selectedTorrent) return;
    resumeTorrentMutation.mutate(undefined, {
      onSuccess: () => {
        void torrentsQuery.refetch();
      },
    });
  };

  const handleDelete = (deleteFiles: boolean) => {
    if (!selectedTorrent) return;
    const confirmKey = deleteFiles ? 'torrents.deleteWithFilesConfirm' : 'torrents.deleteConfirm';
    const fallback = deleteFiles
      ? 'Delete this torrent and its files? This cannot be undone.'
      : 'Delete this torrent? This cannot be undone.';
    if (!confirm(t(confirmKey, fallback))) return;
    deleteTorrentMutation.mutate(
      { delete_files: deleteFiles },
      {
        onSuccess: () => {
          setSelectedHash(null);
          void torrentsQuery.refetch();
        },
      }
    );
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🧲"
        iconColor="text-blue-600"
        title={t('torrents.title', 'Torrents')}
        subtitle={t('torrents.subtitle', 'Manage qBittorrent downloads')}
        onRefresh={() => void torrentsQuery.refetch()}
        isRefreshing={torrentsQuery.isFetching}
      />

      {isDisabled ? (
        <EmptyState
          icon="🧲"
          title={t('dashboard.qbittorrent.notConnectedTitle')}
          description={t('dashboard.qbittorrent.notConnectedDescription')}
        />
      ) : isDisconnected ? (
        <EmptyState
          icon="🧲"
          title={t('dashboard.qbittorrent.disconnected')}
          description={torrentsQuery.data?.error ?? t('torrents.disconnectedDescription', 'qBittorrent is unreachable.')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    {t('dashboard.qbittorrent.addMagnet', 'Add by magnet')}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={magnet}
                      onChange={e => setMagnet(e.target.value)}
                      placeholder={t('dashboard.qbittorrent.magnetPlaceholder', 'magnet:?xt=urn:btih:...')}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                      disabled={!canInteract}
                    />
                    <Button onClick={handleAddMagnet} disabled={!canInteract || magnet.trim().length === 0} size="sm">
                      {t('dashboard.qbittorrent.add', 'Add')}
                    </Button>
                  </div>
                  {addMagnetMutation.error ? (
                    <p className="mt-1 text-xs text-rose-600">
                      {String((addMagnetMutation.error as any)?.message ?? addMagnetMutation.error)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    {t('dashboard.qbittorrent.addTorrentFile', 'Add .torrent')}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="file"
                      accept=".torrent,application/x-bittorrent"
                      onChange={e => handleAddFile(e.target.files?.[0] ?? null)}
                      className="w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 dark:file:bg-neutral-700/50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 dark:file:text-neutral-100"
                      disabled={!canInteract}
                    />
                  </div>
                  {addFileMutation.error ? (
                    <p className="mt-1 text-xs text-rose-600">
                      {String((addFileMutation.error as any)?.message ?? addFileMutation.error)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {t('dashboard.qbittorrent.torrents', 'Torrents')}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {filtered.length.toLocaleString()} / {torrents.length.toLocaleString()}
                  </p>
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('dashboard.qbittorrent.searchPlaceholder', 'Search torrents...')}
                  className="w-full max-w-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="max-h-[60dvh] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {torrentsQuery.isLoading ? (
                  <div className="p-5 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</div>
                ) : filtered.length > 0 ? (
                  filtered.map(torrent => (
                    <button
                      key={torrent.id}
                      type="button"
                      onClick={() => setSelectedHash(torrent.id)}
                      className={`w-full text-left px-5 py-4 hover:bg-neutral-50 dark:hover:bg-white/[0.04] ${
                        selectedHash === torrent.id ? 'bg-neutral-50 dark:bg-white/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{torrent.name}</p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {torrent.category ?? '--'} • {Math.round(torrent.progress * 100)}% • ↓ {formatSpeed(torrent.download_speed)} • ↑{' '}
                            {formatSpeed(torrent.upload_speed)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                          {formatBytes(torrent.size_bytes)}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-5 text-sm text-neutral-500 dark:text-neutral-400">
                    {torrentsQuery.data?.error ?? t('dashboard.qbittorrent.emptyTitle', 'No torrents')}
                  </div>
                )}
              </div>
            </div>

            {selectedTorrent ? (
              <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                      {t('torrents.filesTitle', 'Files')}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{selectedTorrent.name}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setSelectedHash(null)}>
                    {t('common.close', 'Close')}
                  </Button>
                </div>
                <div className="max-h-[50dvh] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700/50">
                  {filesQuery.isLoading ? (
                    <div className="p-5 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</div>
                  ) : filesQuery.data?.files?.length ? (
                    filesQuery.data.files.map(file => (
                      <div key={`${file.index}-${file.name}`} className="px-5 py-4">
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
                    <div className="p-5 text-sm text-neutral-500 dark:text-neutral-400">
                      {filesQuery.data?.error ?? t('torrents.noFiles', 'No files')}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                    {t('torrents.detailsTitle', 'Details')}
                  </p>
                  {selectedTorrent ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {selectedTorrent.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">#{selectedTorrent.id}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {t('torrents.selectTorrent', 'Select a torrent to view trackers.')}
                    </p>
                  )}
                </div>
                {selectedTorrent ? (
                  <Button variant="secondary" size="sm" onClick={() => setSelectedHash(null)}>
                    {t('dashboard.qbittorrent.backToList', 'Back')}
                  </Button>
                ) : null}
              </div>

              {selectedTorrent ? (
                <div className="mt-4 space-y-5">
                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/40 p-3">
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.actions', 'Actions')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleResume}
                        disabled={resumeTorrentMutation.isPending}
                      >
                        {t('torrents.start', 'Start')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handlePause}
                        disabled={pauseTorrentMutation.isPending}
                      >
                        {t('torrents.pause', 'Pause')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(false)}
                        disabled={deleteTorrentMutation.isPending}
                      >
                        {t('torrents.delete', 'Delete')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(true)}
                        disabled={deleteTorrentMutation.isPending}
                      >
                        {t('torrents.deleteWithFiles', 'Delete + files')}
                      </Button>
                    </div>
                    {deleteTorrentMutation.error ? (
                      <p className="mt-2 text-xs text-rose-600">
                        {String((deleteTorrentMutation.error as any)?.message ?? deleteTorrentMutation.error)}
                      </p>
                    ) : null}
                  </div>

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

                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/40 p-3">
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.info', 'Info')}</p>
                    <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.size', 'Size')}</span>
                        <span className="font-medium">{formatBytes(selectedTorrent.size_bytes)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.progress', 'Progress')}</span>
                        <span className="font-medium">{Math.round(selectedTorrent.progress * 100)}%</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.download', 'Download')}</span>
                        <span className="font-medium">{formatSpeed(selectedTorrent.download_speed)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.upload', 'Upload')}</span>
                        <span className="font-medium">{formatSpeed(selectedTorrent.upload_speed)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/40 p-3">
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.properties', 'Properties')}</p>
                    {propertiesQuery.isLoading ? (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</p>
                    ) : propertiesQuery.data?.properties ? (
                      <div className="mt-2 space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.savePath', 'Save path')}</span>
                          <span className="font-medium truncate max-w-[220px]" title={propertiesQuery.data.properties.save_path ?? ''}>
                            {propertiesQuery.data.properties.save_path ?? '--'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.totalDownloaded', 'Downloaded')}</span>
                          <span className="font-medium">
                            {propertiesQuery.data.properties.total_downloaded_bytes != null
                              ? formatBytes(propertiesQuery.data.properties.total_downloaded_bytes)
                              : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.totalUploaded', 'Uploaded')}</span>
                          <span className="font-medium">
                            {propertiesQuery.data.properties.total_uploaded_bytes != null
                              ? formatBytes(propertiesQuery.data.properties.total_uploaded_bytes)
                              : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-neutral-500 dark:text-neutral-400">{t('torrents.shareRatio', 'Ratio')}</span>
                          <span className="font-medium">
                            {propertiesQuery.data.properties.share_ratio != null
                              ? propertiesQuery.data.properties.share_ratio.toFixed(2)
                              : selectedTorrent.ratio != null
                                ? selectedTorrent.ratio.toFixed(2)
                                : '--'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {propertiesQuery.data?.error ?? t('torrents.noProperties', 'No properties')}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
                      {t('dashboard.qbittorrent.trackers', 'Trackers')}
                    </p>
                    {trackersQuery.isLoading ? (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</p>
                    ) : trackersQuery.data?.trackers?.length ? (
                      <div className="mt-2 space-y-2">
                        {trackersQuery.data.trackers.map(tracker => (
                          <div
                            key={tracker.url}
                            className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                          >
                            <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 break-all">{tracker.url}</p>
                            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                              {tracker.message ? tracker.message : '--'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {trackersQuery.data?.error ?? t('dashboard.qbittorrent.noTrackers', 'No trackers found.')}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-200">{t('torrents.peers', 'Peers')}</p>
                    {peersSnapshot?.connected === false ? (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                        {peersSnapshot.error ?? t('torrents.disconnectedDescription', 'qBittorrent is unreachable.')}
                      </p>
                    ) : peersSnapshot?.peers?.length ? (
                      <div className="mt-2 space-y-2 max-h-[40dvh] overflow-y-auto">
                        {peersSnapshot.peers.slice(0, 100).map(peer => (
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
                              <span>{t('torrents.peerProgress', 'Progress')}: {peer.progress != null ? `${Math.round(peer.progress * 100)}%` : '--'}</span>
                              <span>{t('torrents.relevance', 'Rel')}: {peer.relevance != null ? peer.relevance.toFixed(2) : '--'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{t('torrents.noPeers', 'No peers')}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
