import path from "path";
import {
  parseFilenameMetadata,
  refineFrenchAudioLabel,
  expandLanguageCode,
} from "./filenameParser";

// ─── MediaInfo JSON types ─────────────────────────────────────────────────────

type MediaInfoTrack = {
  "@type": string;
  // General
  FileSize?: string;
  Duration?: string;
  Encoded_Library_Name?: string;
  // Video
  Format?: string;
  Format_Profile?: string;
  CodecID?: string;
  Width?: string;
  Height?: string;
  FrameRate?: string;
  BitDepth?: string;
  BitRate?: string;
  BitRate_Nominal?: string;
  HDR_Format?: string;
  HDR_Format_Commercial?: string;
  // Audio/Text
  Language?: string;
  Title?: string;
  Format_Commercial_IfAny?: string;
  Channels?: string;
  ChannelLayout?: string;
  Default?: string;
  Forced?: string;
  HearingImpaired?: string;
};

// ─── Output types ─────────────────────────────────────────────────────────────

export type AudioTrack = {
  index: number;
  language: string; // ISO 639-2
  language_name: string; // human-readable
  title: string | null;
  codec: string | null;
  channels: number | null;
  channel_layout: string | null; // "mono" | "stereo" | "5.1" | "7.1" | ...
  bitrate_kbps: number | null;
  default: boolean;
  forced: boolean;
};

export type SubtitleTrack = {
  index: number;
  language: string;
  language_name: string;
  title: string | null;
  format: string | null; // "PGS" | "ASS" | "SRT" | ...
  forced: boolean;
  hearing_impaired: boolean;
};

export type MediaFileData = {
  filePath: string;
  fileName: string;
  sizeBytes: bigint;
  durationSecs: number | null;
  releaseGroup: string | null;
  videoCodec: string | null;
  videoProfile: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  bitDepth: number | null;
  videoBitrate: number | null;
  hdrFormat: string | null;
  resolution: number | null;
  source: string | null;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
};


function parseChannelLayout(channelStr: string | undefined): string | null {
  if (!channelStr) return null;
  // MediaInfo gives "C L R Ls Rs LFE" style or just a number
  const n = parseInt(channelStr, 10);
  if (!isNaN(n)) {
    if (n === 1) return "mono";
    if (n === 2) return "stereo";
    if (n === 6) return "5.1";
    if (n === 8) return "7.1";
    return `${n}ch`;
  }
  const channels = channelStr.trim().split(/\s+/).length;
  if (channels === 1) return "mono";
  if (channels === 2) return "stereo";
  if (channels === 6) return "5.1";
  if (channels === 8) return "7.1";
  return channelStr;
}

function parseHdrFormat(
  hdrFormat: string | undefined,
  hdrCommercial: string | undefined,
): string | null {
  const src = hdrCommercial ?? hdrFormat ?? "";
  if (!src) return null;
  if (/dolby vision/i.test(src)) return "Dolby Vision";
  if (/hdr10\+|hdr10 plus/i.test(src)) return "HDR10+";
  if (/hdr10\b/i.test(src) || /2084/i.test(src)) return "HDR10";
  if (/hlg/i.test(src)) return "HLG";
  return null;
}

/** Extract release group from filename: last segment after last dash before extension */
function extractReleaseGroup(fileName: string, libraryName?: string): string | null {
  if (libraryName) return libraryName;
  // e.g. "Movie.2023.1080p.BluRay.x264-GROUP.mkv" → "GROUP"
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const match = withoutExt.match(/-([A-Za-z0-9]+)$/);
  return match?.[1] ?? null;
}

/** Parse resolution from filename */
function parseResolutionFromFilename(fileName: string): number | null {
  const match = fileName.match(/\b(480|720|1080|2160)[pi]\b/i);
  if (match) return parseInt(match[1], 10);
  if (/\b4k\b/i.test(fileName)) return 2160;
  return null;
}

/** Parse source from filename */
function parseSourceFromFilename(fileName: string): string | null {
  if (/\bREMUX\b/i.test(fileName)) return "REMUX";
  if (/\bBluRay\b/i.test(fileName)) return "BluRay";
  if (/\bWEB[-.]?DL\b/i.test(fileName)) return "WEB-DL";
  if (/\bWEBRip\b/i.test(fileName)) return "WEBRip";
  if (/\bHDTV\b/i.test(fileName)) return "HDTV";
  if (/\bDVDRip\b/i.test(fileName)) return "DVDRip";
  if (/\bHDCAM\b/i.test(fileName)) return "HDCAM";
  return null;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * Remap an arr-internal path to the actual filesystem path visible in this container.
 * Controlled by MEDIA_PATH_REMAP env var: "from:to" pairs separated by commas.
 * Example: MEDIA_PATH_REMAP="/data:/mnt/storage"
 *
 * Falls back to the MEDIA_PATH_FROM / MEDIA_PATH_TO pair for simple single-mapping.
 */
export function remapPath(filePath: string): string {
  // Single-pair shorthand
  const from = Bun.env.MEDIA_PATH_FROM;
  const to = Bun.env.MEDIA_PATH_TO;
  if (from && to && filePath.startsWith(from)) {
    return to + filePath.slice(from.length);
  }
  // Multi-pair: "MEDIA_PATH_REMAP=/data:/mnt/storage,/media:/mnt/media"
  const remap = Bun.env.MEDIA_PATH_REMAP;
  if (remap) {
    for (const pair of remap.split(",")) {
      const [f, t] = pair.split(":");
      if (f && t && filePath.startsWith(f)) {
        return t + filePath.slice(f.length);
      }
    }
  }
  return filePath;
}

/**
 * Scan a video file using the `mediainfo` CLI and return structured metadata.
 * Returns null if `mediainfo` is not installed or the scan fails — never throws.
 * Applies MEDIA_PATH_FROM/MEDIA_PATH_TO remapping before scanning.
 */
export async function scanMediaInfo(filePath: string): Promise<MediaFileData | null> {
  try {
    const bin = Bun.which("mediainfo");
    if (!bin) {
      console.warn("[mediainfoScanner] mediainfo binary not found — skipping scan");
      return null;
    }

    const resolvedPath = remapPath(filePath);

    const proc = Bun.spawn([bin, "--Output=JSON", resolvedPath], {
      stderr: "ignore",
    });

    // 30-second timeout
    const timeoutId = setTimeout(() => {
      proc.kill();
    }, 30_000);

    const raw = await new Response(proc.stdout).text();
    clearTimeout(timeoutId);

    const exitCode = await proc.exited;
    if (exitCode !== 0 || !raw.trim()) return null;

    const parsed = JSON.parse(raw) as { media?: { track?: MediaInfoTrack[] } };
    const tracks = parsed?.media?.track;
    if (!tracks || !Array.isArray(tracks)) return null;

    const fileName = path.basename(filePath);

    // General track
    const general = tracks.find((t) => t["@type"] === "General");
    const sizeBytes = BigInt(general?.FileSize ?? "0");
    const durationSecs = general?.Duration ? parseFloat(general.Duration) : null;
    const releaseGroup = extractReleaseGroup(fileName, general?.Encoded_Library_Name);

    // Video track
    const video = tracks.find((t) => t["@type"] === "Video");
    const videoCodec = video?.Format ?? null;
    const videoProfile = video?.Format_Profile ?? null;
    const width = video?.Width ? parseInt(video.Width, 10) : null;
    const height = video?.Height ? parseInt(video.Height, 10) : null;
    const frameRate = video?.FrameRate ? parseFloat(video.FrameRate) : null;
    const bitDepth = video?.BitDepth ? parseInt(video.BitDepth, 10) : null;
    const videoBitrate = video?.BitRate ? Math.round(parseInt(video.BitRate, 10) / 1000) : null;
    const hdrFormat = parseHdrFormat(video?.HDR_Format, video?.HDR_Format_Commercial);

    // Derive resolution from width (not height — widescreen films have short heights due to aspect ratio)
    // Fall back to height-based heuristic, then filename.
    let resolution: number | null = null;
    if (width) {
      // 6% slack on each threshold to handle encoders that shave a few pixels
      if (width >= 3600) resolution = 2160;
      else if (width >= 1800) resolution = 1080;
      else if (width >= 1200) resolution = 720;
      else resolution = 480;
    } else if (height) {
      if (height >= 2000) resolution = 2160;
      else if (height >= 1000) resolution = 1080;
      else if (height >= 650) resolution = 720;
      else resolution = 480;
    } else {
      resolution = parseResolutionFromFilename(fileName);
    }
    const source = parseSourceFromFilename(fileName);

    // Audio tracks
    const fnData = parseFilenameMetadata(fileName);
    let frenchTrackIndex = 0;
    const audioTracks: AudioTrack[] = tracks
      .filter((t) => t["@type"] === "Audio")
      .map((t, i) => {
        const rawLang = t.Language ?? "und";
        const isFrench = /^(fre|fra|fr)$/i.test(rawLang) || /french/i.test(rawLang);
        const refined = isFrench
          ? refineFrenchAudioLabel(rawLang, t.Title ?? null, fnData.audioFlags, frenchTrackIndex++)
          : { language: rawLang, language_name: expandLanguageCode(rawLang) };

        // Normalize codec name using commercial name when available
        let codec = t.Format ?? null;
        const commercial = (t.Format_Commercial_IfAny ?? "").toLowerCase();
        if (commercial.includes("truehd")) codec = "TrueHD";
        else if (commercial.includes("dts-hd ma") || commercial.includes("dts-hd master")) codec = "DTS-HD MA";
        else if (commercial.includes("dts-hd")) codec = "DTS-HD";
        else if (commercial.includes("dts:x") || commercial.includes("dts-x")) codec = "DTS:X";
        else if (codec === "AC-3" || codec === "AC3") codec = "AC3";
        else if (codec === "E-AC-3" || codec === "EAC-3") codec = "EAC3";

        const bitrateRaw = t.BitRate ?? t.BitRate_Nominal;
        return {
          index: i,
          language: refined.language,
          language_name: refined.language_name,
          title: t.Title ?? null,
          codec,
          channels: t.Channels ? parseInt(t.Channels, 10) : null,
          channel_layout: parseChannelLayout(t.ChannelLayout ?? t.Channels),
          bitrate_kbps: bitrateRaw ? Math.round(parseInt(bitrateRaw, 10) / 1000) : null,
          default: t.Default?.toLowerCase() === "yes",
          forced: t.Forced?.toLowerCase() === "yes",
        };
      });

    // Subtitle tracks
    const subtitleTracks: SubtitleTrack[] = tracks
      .filter((t) => t["@type"] === "Text")
      .map((t, i) => ({
        index: i,
        language: t.Language ?? "und",
        language_name: expandLanguageCode(t.Language ?? "und"),
        title: t.Title ?? null,
        format: t.Format ?? null,
        forced: t.Forced?.toLowerCase() === "yes",
        hearing_impaired: t.HearingImpaired?.toLowerCase() === "yes",
      }));

    return {
      filePath,
      fileName,
      sizeBytes,
      durationSecs,
      releaseGroup,
      videoCodec,
      videoProfile,
      width,
      height,
      frameRate,
      bitDepth,
      videoBitrate,
      hdrFormat,
      resolution,
      source,
      audioTracks,
      subtitleTracks,
    };
  } catch (err) {
    console.error("[mediainfoScanner] Scan failed:", err);
    return null;
  }
}
