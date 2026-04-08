import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLibrary,
  useLibraryDownloads,
  useLibraryEpisodes,
  useLibraryFiles,
  useRefreshLibraryStatus,
  useRemoveFromLibrary,
  useRescanLibraryItem,
  useSearchLibraryEpisode,
  useSearchLibraryMovie,
  useUpdateLibraryQualityProfile,
} from "@/hooks/useLibrary";
import { useQualityProfilesList } from "@/hooks/useQualityProfiles";
import { formatBytes } from "@hously/shared/utils";
import type { LibraryAudioTrack, LibraryFileInfo, LibrarySubtitleTrack } from "@hously/shared/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Download,
  Film,
  Folder,
  HardDrive,
  Music,
  RefreshCw,
  Search,
  Subtitles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Small helpers ────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-[34%] shrink-0 text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className={cn("min-w-0 flex-1 break-all text-neutral-800 dark:text-neutral-200", mono && "font-mono text-[11px] leading-snug")}>
        {String(value)}
      </span>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium tracking-tight", className)}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500 mb-2">
      {children}
    </p>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mt-3 mb-1.5">
      <Icon size={10} />
      {label}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden", className)}>
      {children}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "downloaded") {
    return <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />;
  }
  if (status === "downloading") {
    return <Circle size={11} className="text-sky-400 shrink-0 fill-sky-400/20" />;
  }
  if (status === "skipped") {
    return <AlertCircle size={11} className="text-neutral-400 shrink-0" />;
  }
  // wanted
  return <Circle size={11} className="text-neutral-300 dark:text-neutral-600 shrink-0" />;
}

function formatDuration(secs: number | null): string | null {
  if (!secs) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatResolution(res: number | null, w: number | null, h: number | null): string | null {
  if (w && h) return `${w} × ${h}`;
  if (res) return `${res}p`;
  return null;
}

function frenchLabel(lang: string): string | null {
  const map: Record<string, string> = {
    VFF: "VFF (France)", VFQ: "VFQ (Québec)", VFI: "VFI (International)",
    VF2: "VF2", TRUEFRENCH: "TRUEFRENCH",
  };
  return map[lang.toUpperCase()] ?? null;
}

function qualityBadges(file: Pick<LibraryFileInfo, "resolution" | "source" | "video_codec" | "hdr_format" | "bit_depth">) {
  return [
    file.resolution ? { label: `${file.resolution}p`, cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300" } : null,
    file.source ? { label: file.source, cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300" } : null,
    file.video_codec ? { label: file.video_codec, cls: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300" } : null,
    file.hdr_format ? {
      label: file.hdr_format,
      cls: file.hdr_format.toLowerCase().includes("dolby")
        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300"
        : "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300",
    } : null,
    file.bit_depth === 10 ? { label: "10-bit", cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300" } : null,
  ].filter(Boolean) as { label: string; cls: string }[];
}

// ─── Audio / subtitle rows ────────────────────────────────────────────────────

function AudioTrackRow({ track }: { track: LibraryAudioTrack }) {
  const frFlag = frenchLabel(track.language);
  const langDisplay = frFlag ?? track.language_name ?? track.language;
  const details = [track.codec, track.channel_layout ?? (track.channels ? `${track.channels}ch` : null), track.bitrate_kbps ? `${track.bitrate_kbps} kbps` : null].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-28 shrink-0 truncate">{langDisplay}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-1 truncate">{details || "—"}</span>
      <div className="flex gap-1 shrink-0">
        {track.default && <Badge className="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">Default</Badge>}
        {track.forced && <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300">Forced</Badge>}
      </div>
    </div>
  );
}

function SubtitleTrackRow({ track }: { track: LibrarySubtitleTrack }) {
  const frFlag = frenchLabel(track.language);
  const langDisplay = frFlag ?? track.language_name ?? track.language;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-28 shrink-0 truncate">{langDisplay}</span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-1 truncate">{track.format ?? "—"}{track.title ? ` · ${track.title}` : ""}</span>
      <div className="flex gap-1 shrink-0">
        {track.forced && <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300">Forced</Badge>}
        {track.hearing_impaired && <Badge className="bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">HI</Badge>}
      </div>
    </div>
  );
}

// ─── File detail block ────────────────────────────────────────────────────────

function FileDetailBlock({ file }: { file: LibraryFileInfo }) {
  const audioTracks = (file.audio_tracks ?? []) as LibraryAudioTrack[];
  const subtitleTracks = (file.subtitle_tracks ?? []) as LibrarySubtitleTrack[];

  return (
    <div>
      <SectionTitle icon={HardDrive} label="File" />
      <div className="space-y-1">
        <Row label="Name" value={file.file_name} mono />
        <Row label="Size" value={formatBytes(Number(file.size_bytes))} />
        <Row label="Duration" value={formatDuration(file.duration_secs)} />
        <Row label="Release group" value={file.release_group} />
        <Row label="Path" value={file.file_path} mono />
      </div>

      <SectionTitle icon={Film} label="Video" />
      <div className="space-y-1">
        <Row label="Codec" value={[file.video_codec, file.video_profile].filter(Boolean).join(" · ")} />
        <Row label="Resolution" value={formatResolution(file.resolution, file.width, file.height)} />
        <Row label="Bit depth" value={file.bit_depth ? `${file.bit_depth}-bit` : null} />
        <Row label="HDR" value={file.hdr_format} />
        <Row label="Source" value={file.source} />
        <Row label="Bitrate" value={file.video_bitrate ? `${file.video_bitrate.toLocaleString()} kbps` : null} />
        <Row label="Frame rate" value={file.frame_rate ? `${file.frame_rate} fps` : null} />
      </div>

      {audioTracks.length > 0 && (
        <>
          <SectionTitle icon={Music} label={`Audio (${audioTracks.length} track${audioTracks.length > 1 ? "s" : ""})`} />
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            {audioTracks.map((t) => (
              <div key={t.index} className="px-2.5"><AudioTrackRow track={t} /></div>
            ))}
          </div>
        </>
      )}

      {subtitleTracks.length > 0 && (
        <>
          <SectionTitle icon={Subtitles} label={`Subtitles (${subtitleTracks.length} track${subtitleTracks.length > 1 ? "s" : ""})`} />
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            {subtitleTracks.map((t) => (
              <div key={t.index} className="px-2.5"><SubtitleTrackRow track={t} /></div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 text-[10px] text-neutral-400 dark:text-neutral-500">
        <Clock size={9} className="inline mr-1" />
        Scanned {new Date(file.scanned_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
      </div>
    </div>
  );
}

// ─── Collapsible episode row (files) ─────────────────────────────────────────

function EpisodeRow({ file }: { file: LibraryFileInfo }) {
  const [expanded, setExpanded] = useState(false);
  const epCode = file.episode != null
    ? `E${String(file.episode).padStart(2, "0")}`
    : "?";
  const badges = qualityBadges(file);

  return (
    <div className="border-b last:border-0 border-neutral-100 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
      >
        <span className="font-mono text-[10px] font-medium text-neutral-400 dark:text-neutral-500 w-7 shrink-0">{epCode}</span>
        <span className="text-[11px] text-neutral-700 dark:text-neutral-300 flex-1 min-w-0 truncate leading-tight">
          {file.episode_title ?? "—"}
        </span>
        <div className="flex gap-0.5 shrink-0">
          {badges.slice(0, 2).map((b) => (
            <Badge key={b.label} className={cn(b.cls, "text-[9px] py-0")}>{b.label}</Badge>
          ))}
          {expanded
            ? <ChevronDown size={10} className="text-neutral-300 dark:text-neutral-600 ml-1 self-center" />
            : <ChevronRight size={10} className="text-neutral-300 dark:text-neutral-600 ml-1 self-center" />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20">
          <FileDetailBlock file={file} />
        </div>
      )}
    </div>
  );
}

// ─── Season group (files) ─────────────────────────────────────────────────────

type SeasonFiles = { season: number; files: LibraryFileInfo[] };

function isUniform<T>(vals: (T | null | undefined)[]): T | null {
  const filled = vals.filter((v) => v != null) as T[];
  if (!filled.length) return null;
  return filled.every((v) => v === filled[0]) ? filled[0] : null;
}

function SeasonGroup({ season, files }: SeasonFiles) {
  const [collapsed, setCollapsed] = useState(true);

  const uRes = isUniform(files.map((f) => f.resolution));
  const uSrc = isUniform(files.map((f) => f.source));
  const uCodec = isUniform(files.map((f) => f.video_codec));
  const uHdr = isUniform(files.map((f) => f.hdr_format));
  const uBitDepth = isUniform(files.map((f) => f.bit_depth));

  const seasonBadges = qualityBadges({ resolution: uRes, source: uSrc, video_codec: uCodec, hdr_format: uHdr, bit_depth: uBitDepth });

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors text-left"
      >
        {collapsed
          ? <ChevronRight size={12} className="text-neutral-400 shrink-0" />
          : <ChevronDown size={12} className="text-neutral-400 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">
            Season {season}
          </div>
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-tight mt-0.5">
            {files.length} episode{files.length > 1 ? "s" : ""}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap justify-end shrink-0">
          {seasonBadges.map((b) => (
            <Badge key={b.label} className={b.cls}>{b.label}</Badge>
          ))}
        </div>
      </button>

      {!collapsed && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800">
          {files.map((f) => <EpisodeRow key={f.id} file={f} />)}
        </div>
      )}
    </div>
  );
}

// ─── Mapped folder helper ─────────────────────────────────────────────────────

function getMappedFolder(files: LibraryFileInfo[], isShow: boolean): string | null {
  const firstPath = files[0]?.file_path;
  if (!firstPath) return null;
  const parts = firstPath.split("/").filter(Boolean);
  const idx = isShow ? parts.length - 3 : parts.length - 2;
  return parts[idx] ?? parts[parts.length - 2] ?? null;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface LibraryManagementPanelProps {
  libraryId: number;
  onDeleted?: () => void;
  onSearchEpisode?: (ep: { id: number; season: number; episode: number; title: string | null }) => void;
  onSearchSeason?: (season: number) => void;
}

export function LibraryManagementPanel({
  libraryId,
  onDeleted,
  onSearchEpisode,
  onSearchSeason,
}: LibraryManagementPanelProps) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useLibraryFiles(libraryId);
  const { data: libList } = useLibrary(undefined, { staleTime: 0, gcTime: 0 });
  const { data: profilesData } = useQualityProfilesList({ staleTime: 0, gcTime: 0 });
  const { data: dlData, isLoading: dlLoading } = useLibraryDownloads(libraryId);
  const updateProfile = useUpdateLibraryQualityProfile();
  const rescan = useRescanLibraryItem(libraryId);
  const searchMovieMut = useSearchLibraryMovie();
  const searchEpMut = useSearchLibraryEpisode();
  const removeMutation = useRemoveFromLibrary();
  const refreshStatus = useRefreshLibraryStatus(libraryId);
  const [deleteConfirm, setDeleteConfirm] = useState<"idle" | "confirm">("idle");
  const [deleteFiles, setDeleteFiles] = useState(true);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const files = data?.files ?? [];
  const isShow = data?.media_type === "show";
  const episodesQuery = useLibraryEpisodes(isShow ? libraryId : null);

  const mediaRow = useMemo(
    () => libList?.items.find((i) => i.id === libraryId),
    [libList?.items, libraryId],
  );

  if (isLoading || !data) {
    return (
      <div className="px-5 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
        Loading file info…
      </div>
    );
  }

  const mappedFolder = files.length ? getMappedFolder(files, isShow) : null;
  const profiles = profilesData?.profiles ?? [];
  const dlItems = dlData?.items ?? [];

  const toggleSeason = (season: number) =>
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      next.has(season) ? next.delete(season) : next.add(season);
      return next;
    });

  // ── Quality profile ─────────────────────────────────────────────────────────
  const profileSection = (
    <Card>
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <SectionLabel>{t("library.management.qualityProfile")}</SectionLabel>
            <select
              value={mediaRow?.quality_profile_id ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const qid = v === "" ? null : parseInt(v, 10);
                void updateProfile.mutateAsync({ id: libraryId, body: { quality_profile_id: qid } });
              }}
              disabled={updateProfile.isPending || !mediaRow}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">{t("library.management.qualityProfileNone")}</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {mediaRow?.type === "movie" && mediaRow.status === "wanted" && mediaRow.search_attempts < 5 && (
            <button
              type="button"
              onClick={() => {
                void searchMovieMut
                  .mutateAsync({ id: libraryId })
                  .then((r) => {
                    if (r.grabbed) toast.success(t("library.management.grabbed"));
                    else toast.error(r.reason ?? t("library.management.grabFailed"));
                  })
                  .catch(() => toast.error(t("library.management.grabFailed")));
              }}
              disabled={searchMovieMut.isPending}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors shrink-0"
            >
              <Search size={10} />
              {t("library.management.searchNow")}
            </button>
          )}
        </div>
      </div>
    </Card>
  );

  // ── Episodes tracker (shows) ────────────────────────────────────────────────
  const episodeGrabSection =
    isShow && episodesQuery.data ? (
      <Card>
        <div className="px-4 pt-3 pb-1">
          <SectionLabel>Episodes</SectionLabel>
        </div>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {episodesQuery.data.seasons.map((s) => {
            const isExpanded = expandedSeasons.has(s.season);
            const downloadedCount = s.episodes.filter((e) => e.status === "downloaded").length;
            const progress = s.episodes.length > 0 ? downloadedCount / s.episodes.length : 0;
            const allDone = downloadedCount === s.episodes.length;
            const noneDone = downloadedCount === 0;

            return (
              <div key={s.season}>
                {/* Season header */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleSeason(s.season)}
                    className="flex flex-1 items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors text-left"
                  >
                    <ChevronRight
                      size={12}
                      className={cn(
                        "text-neutral-400 shrink-0 transition-transform duration-150",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-100">
                          Season {s.season}
                        </span>
                        <span className={cn(
                          "text-[10px] tabular-nums",
                          allDone
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-neutral-400 dark:text-neutral-500",
                        )}>
                          {downloadedCount}/{s.episodes.length}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            allDone
                              ? "bg-emerald-500"
                              : noneDone
                                ? "bg-neutral-300 dark:bg-neutral-700"
                                : "bg-indigo-500",
                          )}
                          style={{ width: `${Math.max(progress * 100, noneDone ? 0 : 4)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  {onSearchSeason && (
                    <button
                      type="button"
                      onClick={() => onSearchSeason(s.season)}
                      title={`Search season ${s.season} pack`}
                      className="px-3 py-3 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                    >
                      <Search size={12} />
                    </button>
                  )}
                </div>

                {/* Episode rows */}
                {isExpanded && (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                    {s.episodes.map((ep) => (
                      <div
                        key={ep.id}
                        className="flex items-center gap-2.5 px-4 py-2"
                      >
                        <StatusDot status={ep.status} />
                        <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 w-8">
                          E{String(ep.episode).padStart(2, "0")}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-[11px] text-neutral-700 dark:text-neutral-300">
                          {ep.title ?? "—"}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onSearchEpisode && (
                            <button
                              type="button"
                              onClick={() => onSearchEpisode({ id: ep.id, season: s.season, episode: ep.episode, title: ep.title ?? null })}
                              title="Open interactive search for this episode"
                              className="rounded p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                            >
                              <Search size={11} />
                            </button>
                          )}
                          {ep.status === "wanted" && ep.search_attempts < 5 ? (
                            <button
                              type="button"
                              onClick={() => {
                                void searchEpMut
                                  .mutateAsync({ mediaId: libraryId, episodeId: ep.id })
                                  .then((r) => {
                                    if (r.grabbed) toast.success(t("library.management.grabbed"));
                                    else toast.error(r.reason ?? t("library.management.grabFailed"));
                                  })
                                  .catch(() => toast.error(t("library.management.grabFailed")));
                              }}
                              disabled={searchEpMut.isPending}
                              className="rounded-md bg-indigo-600/90 px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                            >
                              {t("library.management.episodeSearch")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    ) : isShow && episodesQuery.isLoading ? (
      <Card>
        <div className="px-4 py-4 text-xs text-neutral-500 dark:text-neutral-400">Loading episodes…</div>
      </Card>
    ) : null;

  // ── Files ───────────────────────────────────────────────────────────────────
  const filesSection = files.length > 0 ? (
    <Card>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Folder size={11} className="text-neutral-400 shrink-0" />
          {mappedFolder && (
            <span className="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 truncate">{mappedFolder}</span>
          )}
        </div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors shrink-0",
            "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <RefreshCw size={10} className={rescan.isPending ? "animate-spin" : ""} />
          {rescan.isPending ? "Rescanning…" : rescan.isSuccess ? `Done (${rescan.data?.rescanned})` : "Rescan files"}
        </button>
      </div>

      {/* Show: collapsible by season */}
      {isShow ? (
        <div>
          {Array.from(
            files.reduce((map, f) => {
              const s = f.season ?? 0;
              if (!map.has(s)) map.set(s, []);
              map.get(s)!.push(f);
              return map;
            }, new Map<number, LibraryFileInfo[]>()),
          )
            .sort(([a], [b]) => a - b)
            .map(([season, sFiles]) => (
              <SeasonGroup key={season} season={season} files={sFiles} />
            ))}
        </div>
      ) : (
        /* Movie: flat */
        <div className="px-4 py-3 space-y-4">
          {files.map((file, fileIdx) => {
            const badges = qualityBadges(file);
            return (
              <div
                key={file.id}
                className={cn(files.length > 1 && "border-t border-neutral-100 dark:border-neutral-800 pt-4 first:border-none first:pt-0")}
              >
                {files.length > 1 && (
                  <p className="text-xs font-semibold text-neutral-500 mb-2">File {fileIdx + 1}</p>
                )}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {badges.map((b) => <Badge key={b.label} className={b.cls}>{b.label}</Badge>)}
                  </div>
                )}
                <FileDetailBlock file={file} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  ) : null;

  // ── Download history ────────────────────────────────────────────────────────
  const downloadHistorySection = (
    <Card>
      <button
        type="button"
        onClick={() => setDownloadsOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
        style={{ touchAction: "manipulation" }}
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
          <Download size={12} className="text-neutral-400 shrink-0" />
          {t("library.management.downloads")}
          {dlItems.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 px-1 text-[9px] font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">
              {dlItems.length}
            </span>
          )}
        </span>
        <ChevronDown
          size={13}
          className={cn(
            "shrink-0 text-neutral-400 transition-transform duration-200",
            downloadsOpen && "rotate-180",
          )}
        />
      </button>

      {downloadsOpen && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 pb-4 pt-3">
          {dlLoading ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("library.management.searching")}</p>
          ) : dlItems.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("library.management.noDownloads")}</p>
          ) : (
            <div className="space-y-2">
              {dlItems.map((row) => {
                const statusColor = row.failed
                  ? "border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/10"
                  : row.completed_at
                    ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/10"
                    : "border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/10";

                return (
                  <div
                    key={row.id}
                    className={cn("rounded-lg border px-3 py-2.5 space-y-1.5", statusColor)}
                  >
                    {/* Release title + status */}
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-[11px] font-medium text-neutral-800 dark:text-neutral-100 leading-snug min-w-0 truncate"
                        title={row.release_title}
                      >
                        {row.release_title}
                      </p>
                      {row.failed ? (
                        <Badge className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">Failed</Badge>
                      ) : row.completed_at ? (
                        <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">Done</Badge>
                      ) : (
                        <Badge className="bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 shrink-0">Active</Badge>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {row.indexer && <span>{row.indexer}</span>}
                      <span className="flex items-center gap-1">
                        <Clock size={8} />
                        {new Date(row.grabbed_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>

                    {/* Path / error */}
                    {row.post_process_error ? (
                      <p className="text-[10px] text-red-600 dark:text-red-400 leading-snug" title={row.post_process_error}>
                        {row.post_process_error}
                      </p>
                    ) : row.post_process_destination_path ? (
                      <p
                        className="font-mono text-[9px] text-neutral-500 dark:text-neutral-400 truncate"
                        title={row.post_process_destination_path}
                      >
                        {row.post_process_destination_path}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );

  // ── Actions + danger zone ───────────────────────────────────────────────────
  const actionsSection = (
    <div className="flex items-center justify-between gap-2 px-1">
      <button
        onClick={() => void refreshStatus.mutate()}
        disabled={refreshStatus.isPending}
        title={t("library.management.refreshStatusTitle")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
          "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <RefreshCw size={11} className={refreshStatus.isPending ? "animate-spin" : ""} />
        {refreshStatus.isPending
          ? t("library.management.refreshingStatus")
          : t("library.management.refreshStatus")}
      </button>

      <button
        type="button"
        onClick={() => setDeleteConfirm("confirm")}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <Trash2 size={11} />
        {t("library.management.delete")}
      </button>
    </div>
  );

  const deleteConfirmSection = (
    <Card className="border-red-200 dark:border-red-800/60 bg-red-50/50 dark:bg-red-950/10">
      <div className="px-4 py-3 space-y-3">
        <p className="text-xs font-semibold text-red-700 dark:text-red-300">
          {t("library.management.deleteConfirmTitle")}
        </p>
        <label className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteFiles}
            onChange={(e) => setDeleteFiles(e.target.checked)}
            className="rounded border-red-300"
          />
          {t("library.management.deleteFilesLabel")}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={removeMutation.isPending}
            onClick={async () => {
              try {
                await removeMutation.mutateAsync({ id: libraryId, deleteFiles });
                onDeleted?.();
              } catch {
                // mutation error handled by hook
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            <Trash2 size={10} />
            {removeMutation.isPending
              ? t("library.management.deleting")
              : t("library.management.deleteConfirm")}
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm("idle")}
            className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="px-4 pb-5 pt-2 space-y-3">
      {profileSection}
      {episodeGrabSection}
      {filesSection ?? (
        <Card>
          <div className="px-4 py-6 text-center text-sm text-neutral-400 dark:text-neutral-500">
            No file metadata found for this item.
          </div>
        </Card>
      )}
      {downloadHistorySection}
      {deleteConfirm === "confirm" ? deleteConfirmSection : actionsSection}
    </div>
  );
}
