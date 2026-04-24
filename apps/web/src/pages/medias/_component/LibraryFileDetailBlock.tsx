import { useEffect, useRef, useState } from "react";
import { Clock, Film, HardDrive, Music, Shuffle, Subtitles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type {
  LibraryAudioTrack,
  LibraryFileInfo,
  LibrarySubtitleTrack,
} from "@hously/shared/types";
import { Badge, Row, SectionTitle } from "./LibrarySharedUI";
import {
  formatDuration,
  formatResolution,
  frenchLabel,
} from "@/utils/libraryDisplayUtils";
import { useRemuxFile, useRemuxFileStatus } from "@/features/medias/hooks/useLibrary";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

function AudioTrackRow({ track }: { track: LibraryAudioTrack }) {
  const { t } = useTranslation("common");
  const frFlag = frenchLabel(track.language);
  const langDisplay = frFlag ?? track.language_name ?? track.language;
  const details = [
    track.codec,
    track.channel_layout ?? (track.channels ? `${track.channels}ch` : null),
    track.bitrate_kbps
      ? t("library.fileDetail.bitrateKbps", {
          value: track.bitrate_kbps.toLocaleString(),
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-28 shrink-0 truncate">
        {langDisplay}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-1 truncate">
        {details || "—"}
      </span>
      <div className="flex gap-1 shrink-0">
        {track.default && (
          <Badge className="bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300">
            {t("library.fileDetail.defaultTrack")}
          </Badge>
        )}
        {track.forced && (
          <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300">
            {t("library.fileDetail.forced")}
          </Badge>
        )}
      </div>
    </div>
  );
}

function SubtitleTrackRow({ track }: { track: LibrarySubtitleTrack }) {
  const { t } = useTranslation("common");
  const frFlag = frenchLabel(track.language);
  const langDisplay = frFlag ?? track.language_name ?? track.language;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-28 shrink-0 truncate">
        {langDisplay}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 flex-1 truncate">
        {track.format ?? "—"}
        {track.title ? ` · ${track.title}` : ""}
      </span>
      <div className="flex gap-1 shrink-0">
        {track.forced && (
          <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300">
            {t("library.fileDetail.forced")}
          </Badge>
        )}
        {track.hearing_impaired && (
          <Badge className="bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
            {t("library.fileDetail.hearingImpaired")}
          </Badge>
        )}
      </div>
    </div>
  );
}

function TrackToggleRow({
  kept,
  disabled,
  onToggle,
  lang,
  details,
}: {
  kept: boolean;
  disabled: boolean;
  onToggle: () => void;
  lang: string | null | undefined;
  details: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors",
        kept
          ? "bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600"
          : "bg-transparent border border-dashed border-neutral-300 dark:border-neutral-600 opacity-50",
        disabled && "cursor-not-allowed",
      )}
    >
      <span
        className={cn(
          "w-3 h-3 rounded-sm border shrink-0 flex items-center justify-center transition-colors",
          kept
            ? "bg-neutral-900 border-neutral-900 dark:bg-white dark:border-white"
            : "border-neutral-400 dark:border-neutral-500",
        )}
      >
        {kept && (
          <svg className="w-2 h-2 text-white dark:text-neutral-900" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-24 shrink-0 truncate">
        {lang}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
        {details}
      </span>
    </button>
  );
}

function RemuxPanel({
  file,
  onClose,
}: {
  file: LibraryFileInfo;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");
  const audioTracks = (file.audio_tracks ?? []) as LibraryAudioTrack[];
  const subtitleTracks = (file.subtitle_tracks ?? []) as LibrarySubtitleTrack[];

  const [keptIndices, setKeptIndices] = useState<Set<number>>(
    () => new Set(audioTracks.map((tr) => tr.index)),
  );
  const [keptSubIndices, setKeptSubIndices] = useState<Set<number>>(
    () => new Set(subtitleTracks.map((tr) => tr.index)),
  );

  const queryClient = useQueryClient();
  const remuxMut = useRemuxFile(file.id);
  const { data: status } = useRemuxFileStatus(file.id);
  const isRunning = status?.state === "active" || status?.state === "waiting";
  const wasRunningRef = useRef(false);

  if (isRunning) wasRunningRef.current = true;

  useEffect(() => {
    if (!wasRunningRef.current) return;
    if (status?.state === "completed") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      if (status.result?.status === "remuxed") {
        toast.success(t("library.fileDetail.remux.done"));
      } else if (status.result?.status === "skipped") {
        toast.info(t("library.fileDetail.remux.skipped"));
      } else {
        toast.error(status.result?.message ?? t("library.fileDetail.remux.error"));
      }
      onClose();
    } else if (status?.state === "failed") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      toast.error(status.error ?? t("library.fileDetail.remux.error"));
      onClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.state]);

  const toggleAudio = (index: number) => {
    setKeptIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        if (next.size <= 1) return prev;
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSub = (index: number) => {
    setKeptSubIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const onStart = async () => {
    try {
      await remuxMut.mutateAsync({
        keep_audio_track_indices: [...keptIndices],
        keep_subtitle_track_indices: [...keptSubIndices],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3 space-y-3">
      <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide">
        {t("library.fileDetail.remux.title")}
      </p>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1.5">
            {t("library.fileDetail.remux.keepAudioTracks")}
          </p>
          {audioTracks.map((tr) => {
            const langDisplay = frenchLabel(tr.language) ?? tr.language_name ?? tr.language;
            const details = [
              tr.codec,
              tr.channel_layout ?? (tr.channels ? `${tr.channels}ch` : null),
            ]
              .filter(Boolean)
              .join(" · ");
            const kept = keptIndices.has(tr.index);
            return (
              <TrackToggleRow
                key={tr.index}
                kept={kept}
                disabled={isRunning}
                onToggle={() => toggleAudio(tr.index)}
                lang={langDisplay}
                details={details}
              />
            );
          })}
        </div>

        {subtitleTracks.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-1.5">
              {t("library.fileDetail.remux.keepSubtitleTracks")}
            </p>
            {subtitleTracks.map((tr) => {
              const langDisplay = frenchLabel(tr.language) ?? tr.language_name ?? tr.language;
              const details = [
                tr.format,
                tr.forced ? t("library.fileDetail.forced") : null,
                tr.hearing_impaired ? t("library.fileDetail.hearingImpaired") : null,
              ]
                .filter(Boolean)
                .join(" · ");
              const kept = keptSubIndices.has(tr.index);
              return (
                <TrackToggleRow
                  key={tr.index}
                  kept={kept}
                  disabled={isRunning}
                  onToggle={() => toggleSub(tr.index)}
                  lang={langDisplay}
                  details={details}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {isRunning ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("library.fileDetail.remux.running")}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void onStart()}
              disabled={remuxMut.isPending || keptIndices.size === 0}
              className="rounded px-2.5 py-1 text-xs font-medium bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-50 transition-colors"
            >
              {t("library.fileDetail.remux.startButton")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              {t("common.cancel")}
            </button>
          </>
        )}
      </div>

    </div>
  );
}

export function FileDetailBlock({
  file,
  mediaId: _mediaId,
}: {
  file: LibraryFileInfo;
  mediaId?: number;
}) {
  const { t } = useTranslation("common");
  const [showRemux, setShowRemux] = useState(false);
  const audioTracks = (file.audio_tracks ?? []) as LibraryAudioTrack[];
  const subtitleTracks = (file.subtitle_tracks ?? []) as LibrarySubtitleTrack[];
  const isMkv = file.file_name.toLowerCase().endsWith(".mkv");
  const scannedDate = new Date(file.scanned_at).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

  return (
    <div>
      <SectionTitle
        icon={HardDrive}
        label={t("library.fileDetail.sectionFile")}
      />
      <div className="space-y-1">
        <Row label={t("library.fileDetail.name")} value={file.file_name} mono />
        <Row
          label={t("library.fileDetail.size")}
          value={formatBytes(Number(file.size_bytes))}
        />
        <Row
          label={t("library.fileDetail.duration")}
          value={formatDuration(file.duration_secs)}
        />
        <Row
          label={t("library.fileDetail.releaseGroup")}
          value={file.release_group}
        />
        <Row label={t("library.fileDetail.path")} value={file.file_path} mono />
      </div>

      <SectionTitle icon={Film} label={t("library.fileDetail.sectionVideo")} />
      <div className="space-y-1">
        <Row
          label={t("library.fileDetail.codec")}
          value={[file.video_codec, file.video_profile]
            .filter(Boolean)
            .join(" · ")}
        />
        <Row
          label={t("library.fileDetail.resolution")}
          value={formatResolution(file.resolution, file.width, file.height)}
        />
        <Row
          label={t("library.fileDetail.bitDepth")}
          value={
            file.bit_depth
              ? t("library.fileDetail.bitDepthValue", { bits: file.bit_depth })
              : null
          }
        />
        <Row label={t("library.fileDetail.hdr")} value={file.hdr_format} />
        <Row label={t("library.fileDetail.source")} value={file.source} />
        <Row
          label={t("library.fileDetail.bitrate")}
          value={
            file.video_bitrate
              ? t("library.fileDetail.bitrateKbps", {
                  value: file.video_bitrate.toLocaleString(),
                })
              : null
          }
        />
        <Row
          label={t("library.fileDetail.frameRate")}
          value={
            file.frame_rate
              ? t("library.fileDetail.frameRateFps", {
                  value: String(file.frame_rate),
                })
              : null
          }
        />
      </div>

      {audioTracks.length > 0 && (
        <>
          <SectionTitle
            icon={Music}
            label={t("library.fileDetail.audioTracksHeading", {
              count: audioTracks.length,
            })}
          />
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            {audioTracks.map((tr) => (
              <div key={tr.index} className="px-2.5">
                <AudioTrackRow track={tr} />
              </div>
            ))}
          </div>
        </>
      )}

      {subtitleTracks.length > 0 && (
        <>
          <SectionTitle
            icon={Subtitles}
            label={t("library.fileDetail.subtitlesTracksHeading", {
              count: subtitleTracks.length,
            })}
          />
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            {subtitleTracks.map((tr) => (
              <div key={tr.index} className="px-2.5">
                <SubtitleTrackRow track={tr} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
          <Clock size={9} className="inline mr-1" />
          {t("library.fileDetail.scanned", { date: scannedDate })}
        </span>
        {isMkv && audioTracks.length > 1 && !showRemux && (
          <button
            type="button"
            onClick={() => setShowRemux(true)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <Shuffle size={10} />
            {t("library.fileDetail.remux.openButton")}
          </button>
        )}
      </div>

      {showRemux && (
        <RemuxPanel file={file} onClose={() => setShowRemux(false)} />
      )}
    </div>
  );
}
