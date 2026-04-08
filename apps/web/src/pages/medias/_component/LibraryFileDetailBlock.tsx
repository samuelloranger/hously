import { Clock, Film, HardDrive, Music, Subtitles } from "lucide-react";
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
} from "../utils/libraryDisplayUtils";

function AudioTrackRow({ track }: { track: LibraryAudioTrack }) {
  const frFlag = frenchLabel(track.language);
  const langDisplay = frFlag ?? track.language_name ?? track.language;
  const details = [
    track.codec,
    track.channel_layout ?? (track.channels ? `${track.channels}ch` : null),
    track.bitrate_kbps ? `${track.bitrate_kbps} kbps` : null,
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
            Default
          </Badge>
        )}
        {track.forced && (
          <Badge className="bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300">
            Forced
          </Badge>
        )}
      </div>
    </div>
  );
}

function SubtitleTrackRow({ track }: { track: LibrarySubtitleTrack }) {
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
            Forced
          </Badge>
        )}
        {track.hearing_impaired && (
          <Badge className="bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
            HI
          </Badge>
        )}
      </div>
    </div>
  );
}

export function FileDetailBlock({ file }: { file: LibraryFileInfo }) {
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
        <Row
          label="Codec"
          value={[file.video_codec, file.video_profile]
            .filter(Boolean)
            .join(" · ")}
        />
        <Row
          label="Resolution"
          value={formatResolution(file.resolution, file.width, file.height)}
        />
        <Row
          label="Bit depth"
          value={file.bit_depth ? `${file.bit_depth}-bit` : null}
        />
        <Row label="HDR" value={file.hdr_format} />
        <Row label="Source" value={file.source} />
        <Row
          label="Bitrate"
          value={
            file.video_bitrate
              ? `${file.video_bitrate.toLocaleString()} kbps`
              : null
          }
        />
        <Row
          label="Frame rate"
          value={file.frame_rate ? `${file.frame_rate} fps` : null}
        />
      </div>

      {audioTracks.length > 0 && (
        <>
          <SectionTitle
            icon={Music}
            label={`Audio (${audioTracks.length} track${audioTracks.length > 1 ? "s" : ""})`}
          />
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            {audioTracks.map((t) => (
              <div key={t.index} className="px-2.5">
                <AudioTrackRow track={t} />
              </div>
            ))}
          </div>
        </>
      )}

      {subtitleTracks.length > 0 && (
        <>
          <SectionTitle
            icon={Subtitles}
            label={`Subtitles (${subtitleTracks.length} track${subtitleTracks.length > 1 ? "s" : ""})`}
          />
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            {subtitleTracks.map((t) => (
              <div key={t.index} className="px-2.5">
                <SubtitleTrackRow track={t} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 text-[10px] text-neutral-400 dark:text-neutral-500">
        <Clock size={9} className="inline mr-1" />
        Scanned{" "}
        {new Date(file.scanned_at).toLocaleDateString(undefined, {
          dateStyle: "medium",
        })}
      </div>
    </div>
  );
}
