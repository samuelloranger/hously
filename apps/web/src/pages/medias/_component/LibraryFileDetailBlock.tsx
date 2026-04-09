import { Clock, Film, HardDrive, Music, Subtitles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@hously/shared/utils";
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
          <Badge className="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
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

export function FileDetailBlock({ file }: { file: LibraryFileInfo }) {
  const { t } = useTranslation("common");
  const audioTracks = (file.audio_tracks ?? []) as LibraryAudioTrack[];
  const subtitleTracks = (file.subtitle_tracks ?? []) as LibrarySubtitleTrack[];
  const scannedDate = new Date(file.scanned_at).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });

  return (
    <div>
      <SectionTitle icon={HardDrive} label={t("library.fileDetail.sectionFile")} />
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

      <div className="mt-3 text-[10px] text-neutral-400 dark:text-neutral-500">
        <Clock size={9} className="inline mr-1" />
        {t("library.fileDetail.scanned", { date: scannedDate })}
      </div>
    </div>
  );
}
