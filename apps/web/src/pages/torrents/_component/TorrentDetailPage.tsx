import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Play,
  Pause,
  Pin,
  PinOff,
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
} from "lucide-react";
import {
  useDashboardQbittorrentCategories,
  useDashboardQbittorrentTags,
  useDeleteQbittorrentTorrent,
  usePauseQbittorrentTorrent,
  usePinnedQbittorrentTorrent,
  useQbittorrentTorrentFiles,
  useQbittorrentTorrentProperties,
  useQbittorrentTorrentTrackers,
  useRenameQbittorrentTorrent,
  useRenameQbittorrentTorrentFile,
  useResumeQbittorrentTorrent,
  useSetPinnedQbittorrentTorrent,
  useSetQbittorrentTorrentCategory,
  useSetQbittorrentTorrentTags,
} from "@/hooks/useDashboard";
import { useJsonEventSource } from "@/hooks/useEventSource";
import { queryKeys } from "@/lib/queryKeys";
import { DASHBOARD_ENDPOINTS } from "@hously/shared/endpoints";
import type {
  DashboardQbittorrentTorrentsResponse,
  DashboardQbittorrentTorrentFilesResponse,
  DashboardQbittorrentTorrentPeersResponse,
  DashboardQbittorrentTorrentStreamResponse,
} from "@hously/shared/types";
import {
  formatBytes,
  formatQbittorrentEta,
  formatSpeed,
  getQbittorrentProgressBarGradient,
  hasQbittorrentTransferActivity,
  getQbittorrentStatusConfig,
  getQbittorrentStreamSnapshot,
  isQbittorrentPausedState,
  toOptionalQbittorrentString,
} from "@hously/shared/utils";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/dialog";
import { cn } from "@/lib/utils";
import { TorrentPropertiesTab } from "@/pages/torrents/_component/TorrentPropertiesTab";
import { TorrentFilesTab } from "@/pages/torrents/_component/TorrentFilesTab";
import { TorrentTrackersTab } from "@/pages/torrents/_component/TorrentTrackersTab";
import { TorrentPeersTab } from "@/pages/torrents/_component/TorrentPeersTab";

type TabId = "properties" | "files" | "trackers" | "peers";

export function TorrentDetailPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hash } = useParams({ strict: false }) as { hash: string };
  const torrentHash = (hash ?? "").trim();

  const [activeTab, setActiveTab] = useState<TabId>("properties");

  const categoriesQuery = useDashboardQbittorrentCategories();
  const tagsQuery = useDashboardQbittorrentTags();
  const { data: pinnedTorrentData } = usePinnedQbittorrentTorrent();
  const setPinnedTorrent = useSetPinnedQbittorrentTorrent();

  const [torrentSnapshot, setTorrentSnapshot] =
    useState<DashboardQbittorrentTorrentStreamResponse | null>(null);
  const initializedForHash = useRef("");

  const selectedTorrent = useMemo(
    () => torrentSnapshot?.torrent ?? null,
    [torrentSnapshot?.torrent],
  );

  const isTransferring = selectedTorrent
    ? hasQbittorrentTransferActivity(selectedTorrent)
    : false;

  const propertiesQuery = useQbittorrentTorrentProperties(torrentHash || null);
  const trackersQuery = useQbittorrentTorrentTrackers(
    activeTab === "trackers" ? torrentHash || null : null,
  );
  const filesQuery = useQbittorrentTorrentFiles(
    activeTab === "files" ? torrentHash || null : null,
    activeTab === "files" && isTransferring ? 2000 : false,
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

  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);

  const [peersSnapshot, setPeersSnapshot] =
    useState<DashboardQbittorrentTorrentPeersResponse | null>(null);

  useJsonEventSource<DashboardQbittorrentTorrentStreamResponse>({
    enabled: Boolean(torrentHash),
    url: torrentHash
      ? DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENT_STREAM(torrentHash)
      : null,
    logLabel: "qBittorrent torrent stream",
    onReset: () => {
      const listData =
        queryClient.getQueryData<DashboardQbittorrentTorrentsResponse>(
          queryKeys.dashboard.qbittorrentTorrents({}),
        );
      setTorrentSnapshot(getQbittorrentStreamSnapshot(listData, torrentHash));
    },
    onMessage: (parsed) => {
      setTorrentSnapshot(parsed);
    },
  });

  useEffect(() => {
    if (!selectedTorrent) return;
    if (initializedForHash.current === torrentHash) return;
    initializedForHash.current = torrentHash;
    setDraftName(selectedTorrent.name);
    setDraftCategory(selectedTorrent.category ?? "");
  }, [selectedTorrent, torrentHash]);

  useJsonEventSource<DashboardQbittorrentTorrentPeersResponse>({
    enabled: Boolean(torrentHash) && activeTab === "peers",
    url:
      torrentHash && activeTab === "peers"
        ? DASHBOARD_ENDPOINTS.QBITTORRENT.PEERS_STREAM(torrentHash)
        : null,
    logLabel: "qBittorrent peers stream",
    onReset: () => setPeersSnapshot(null),
    onMessage: (parsed) => {
      setPeersSnapshot(parsed);
    },
  });

  const handleSaveName = () => {
    if (!selectedTorrent) return;
    const name = draftName.trim();
    if (!name || name === selectedTorrent.name) return;
    const prev = torrentSnapshot;
    setTorrentSnapshot((snap) =>
      snap?.torrent ? { ...snap, torrent: { ...snap.torrent, name } } : snap,
    );
    renameTorrentMutation.mutate(
      { name },
      {
        onError: () => setTorrentSnapshot(prev),
      },
    );
  };

  const handleSaveCategory = () => {
    if (!selectedTorrent) return;
    const category = toOptionalQbittorrentString(draftCategory) ?? "";
    if ((selectedTorrent.category ?? "") === category) return;
    const prev = torrentSnapshot;
    setTorrentSnapshot((snap) =>
      snap?.torrent
        ? { ...snap, torrent: { ...snap.torrent, category } }
        : snap,
    );
    setCategoryMutation.mutate(category ? { category } : {}, {
      onError: () => setTorrentSnapshot(prev),
    });
  };

  const handleSaveTagsFromSelect = (selected: string[]) => {
    if (!selectedTorrent) return;
    const prev = torrentSnapshot;
    setTorrentSnapshot((snap) =>
      snap?.torrent
        ? { ...snap, torrent: { ...snap.torrent, tags: selected } }
        : snap,
    );
    setTagsMutation.mutate(
      { tags: selected, previous_tags: selectedTorrent.tags ?? [] },
      {
        onError: () => setTorrentSnapshot(prev),
      },
    );
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    const filesKey = queryKeys.dashboard.qbittorrentTorrentFiles(torrentHash);
    const prevFiles =
      queryClient.getQueryData<DashboardQbittorrentTorrentFilesResponse>(
        filesKey,
      );
    queryClient.setQueryData<DashboardQbittorrentTorrentFilesResponse>(
      filesKey,
      (old) =>
        old
          ? {
              ...old,
              files: old.files.map((f) =>
                f.name === oldPath ? { ...f, name: newPath } : f,
              ),
            }
          : old,
    );
    renameFileMutation.mutate(
      { old_path: oldPath, new_path: newPath },
      {
        onSuccess: () => void filesQuery.refetch(),
        onError: () => queryClient.setQueryData(filesKey, prevFiles),
      },
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
          navigate({ to: "/torrents" });
        },
      },
    );
  };

  const progress = selectedTorrent
    ? Math.round(selectedTorrent.progress * 100)
    : 0;
  const statusConfig = getQbittorrentStatusConfig(selectedTorrent?.state ?? "");
  const isPaused = isQbittorrentPausedState(selectedTorrent?.state ?? "");
  const progressBarGradient = getQbittorrentProgressBarGradient(
    selectedTorrent?.state ?? "",
  );
  const isSeedingState = Boolean(
    selectedTorrent &&
    /^(uploading|forcedup|stalledup)$/i.test(selectedTorrent.state),
  );
  const isUploading = Boolean(
    selectedTorrent && selectedTorrent.upload_speed > 0 && isSeedingState,
  );
  const progressBarFillClass = isSeedingState
    ? "bg-gradient-to-r from-emerald-500 to-green-500 dark:from-emerald-400 dark:to-green-400"
    : progressBarGradient;
  const progressBarTrackClass = isSeedingState
    ? "bg-emerald-100/80 dark:bg-emerald-950/40"
    : "bg-neutral-100 dark:bg-neutral-800";
  const isPinned = pinnedTorrentData?.pinned_hash === torrentHash;

  const tabs: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: "properties",
      label: t("torrents.properties", "Properties"),
      icon: <Settings2 size={13} />,
    },
    {
      id: "files",
      label: t("torrents.filesTitle", "Files"),
      icon: <FileText size={13} />,
      count: filesQuery.data?.files?.length,
    },
    {
      id: "trackers",
      label: t("dashboard.qbittorrent.trackers", "Trackers"),
      icon: <Server size={13} />,
      count: trackersQuery.data?.trackers?.length,
    },
    {
      id: "peers",
      label: t("torrents.peers", "Peers"),
      icon: <Users size={13} />,
      count: peersSnapshot?.peers?.length,
    },
  ];

  const stats = selectedTorrent
    ? [
        {
          label: t("torrents.size", "Size"),
          value: formatBytes(selectedTorrent.size_bytes),
          Icon: HardDrive,
          color: undefined,
        },
        {
          label: t("torrents.download", "Download"),
          value: formatSpeed(selectedTorrent.download_speed),
          Icon: TrendingDown,
          color: "text-sky-600 dark:text-sky-400",
        },
        {
          label: t("torrents.upload", "Upload"),
          value: formatSpeed(selectedTorrent.upload_speed),
          Icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
        },
        {
          label: t("dashboard.qbittorrent.seeds", "Seeds"),
          value: String(selectedTorrent.seeds),
          Icon: Activity,
          color: undefined,
        },
        {
          label: t("torrents.peers", "Peers"),
          value: String(selectedTorrent.peers),
          Icon: Users,
          color: undefined,
        },
        {
          label: t("torrents.eta", "ETA"),
          value: formatQbittorrentEta(selectedTorrent.eta_seconds),
          Icon: Clock,
          color: undefined,
        },
      ]
    : [];

  return (
    <PageLayout>
      {/* ── Top nav ── */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to="/torrents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">
            {t("torrents.backToList", "Back to torrents")}
          </span>
          <span className="sm:hidden">{t("common.back", "Back")}</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Pin */}
          <button
            onClick={() =>
              setPinnedTorrent.mutate({ hash: isPinned ? null : torrentHash })
            }
            disabled={setPinnedTorrent.isPending || !torrentHash}
            title={
              isPinned
                ? t("torrents.unpin", "Unpin from home")
                : t("torrents.pin", "Pin to home")
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40",
              isPinned
                ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
            )}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            <span className="hidden sm:inline">
              {isPinned
                ? t("torrents.unpin", "Unpin")
                : t("torrents.pin", "Pin")}
            </span>
          </button>

          {/* Pause / Resume */}
          {isPaused ? (
            <button
              onClick={handleResume}
              disabled={resumeTorrentMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-600 transition-colors disabled:opacity-40"
            >
              <Play size={13} />
              <span className="hidden sm:inline">
                {t("torrents.start", "Resume")}
              </span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              disabled={pauseTorrentMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 transition-colors disabled:opacity-40"
            >
              <Pause size={13} />
              <span className="hidden sm:inline">
                {t("torrents.pause", "Pause")}
              </span>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => {
              setDeleteFiles(false);
              setDeleteOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-neutral-900 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 border border-neutral-200 dark:border-neutral-700 hover:border-red-200 dark:hover:border-red-800/60 transition-colors"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">
              {t("torrents.delete", "Delete")}
            </span>
          </button>
        </div>
      </div>

      {/* ── Hero card ── */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden mb-4">
        {/* State accent strip */}
        <div className={cn("h-1 w-full", statusConfig.dot)} />

        <div className="p-4 sm:p-6">
          {/* Status + category + tag badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {selectedTorrent?.state && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                  statusConfig.badge,
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    statusConfig.dot,
                    statusConfig.pulse && "animate-pulse",
                  )}
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
            {selectedTorrent?.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/50"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Name */}
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white break-words leading-snug">
            {selectedTorrent?.name ?? torrentHash}
          </h1>

          {/* Hash */}
          <p className="mt-1 font-mono text-[11px] text-neutral-400 dark:text-neutral-500 select-all tracking-wide break-all">
            {torrentHash || "--"}
          </p>

          {selectedTorrent && (
            <>
              {/* Progress bar */}
              <div className="mt-5">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={cn(
                      "flex-1 h-2 rounded-full overflow-hidden",
                      progressBarTrackClass,
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700 ease-out",
                        progressBarFillClass,
                        isUploading && "torrent-progress-bar-active",
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-bold text-neutral-900 dark:text-white tabular-nums shrink-0 min-w-[3rem] text-right">
                    {progress}%
                  </span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {stats.map(({ label, value, Icon, color }) => (
                  <div
                    key={label}
                    className="bg-neutral-50 dark:bg-neutral-800/60 rounded-xl px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-medium mb-1">
                      <Icon size={9} />
                      {label}
                    </div>
                    <p
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums truncate",
                        color ?? "text-neutral-900 dark:text-neutral-100",
                      )}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Pill tabs ── */}
      <div className="bg-neutral-100 dark:bg-neutral-800/60 rounded-xl p-1 mb-4 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap min-w-0",
              activeTab === tab.id
                ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200",
            )}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
            {tab.count != null && (
              <span
                className={cn(
                  "shrink-0 px-1.5 py-px rounded-full text-[10px] font-bold tabular-nums leading-none",
                  activeTab === tab.id
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      {activeTab === "properties" && (
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

      {activeTab === "files" && (
        <TorrentFilesTab
          isLoading={filesQuery.isLoading}
          files={filesQuery.data?.files}
          error={filesQuery.data?.error}
          onRenameFile={handleRenameFile}
          isRenamePending={renameFileMutation.isPending}
        />
      )}

      {activeTab === "trackers" && (
        <TorrentTrackersTab
          isLoading={trackersQuery.isLoading}
          trackers={trackersQuery.data?.trackers}
          error={trackersQuery.data?.error}
        />
      )}

      {activeTab === "peers" && (
        <TorrentPeersTab peersSnapshot={peersSnapshot} />
      )}

      {/* ── Delete dialog ── */}
      <Dialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteFiles(false);
        }}
        title={t("torrents.deleteTitle", "Delete torrent")}
      >
        <div className="space-y-5">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {t(
              "torrents.deleteDescription",
              "Do you also want to delete the downloaded files?",
            )}
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={(e) => setDeleteFiles(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-200">
              {t("torrents.alsoDeleteFiles", "Also delete files")}
            </span>
          </label>

          {deleteTorrentMutation.error ? (
            <p className="text-sm text-rose-600">
              {deleteTorrentMutation.error.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteTorrentMutation.isPending}
            >
              {t("torrents.confirmDelete", "Delete")}
            </Button>
          </div>
        </div>
      </Dialog>
    </PageLayout>
  );
}
