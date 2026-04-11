// ─── Output type ─────────────────────────────────────────────────────────────

export interface FilenameMetadata {
  resolution: number | null;
  source: string | null;
  hdrFormat: string | null;
  videoCodec: string | null;
  audioFormat: string | null;
  audioChannels: string | null;
  /** French/multilingual audio flags found in the filename */
  audioFlags: string[];
  releaseGroup: string | null;
  edition: string | null;
  streaming: string | null; // AMZN, NF, DSNP, APLE, etc.
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VIDEO_EXT = /\.(mkv|avi|mp4|m4v|wmv|ts|m2ts|mov|flv)$/i;
const TECHNICAL_TOKENS =
  /^(2160p|1080p|1080i|720p|480p|576p|4K|UHD|WEB|WEB[-.]?DL|WEBRip|BluRay|BDRip|BDRemux|HDRip|DVDRip|HDTV|REMUX|HDLight|x264|x265|H264|H265|HEVC|AVC|AV1|VP9|AAC|AC3|EAC3|DTS|FLAC|TrueHD|MULTI|MULTi|VFF|VFQ|VFI|VF2|VF|FRENCH|TRUEFRENCH|VOSTFR|ATMOS|HDR|HDR10|DV)$/i;

// ─── Individual parsers ───────────────────────────────────────────────────────

export function parseResolution(filename: string): number | null {
  if (/\b(4K|UHD|2160[pi])\b/i.test(filename)) return 2160;
  if (/\b1080[pi]\b/i.test(filename)) return 1080;
  if (/\b720p\b/i.test(filename)) return 720;
  if (/\b576p\b/i.test(filename)) return 576;
  if (/\b480p\b/i.test(filename)) return 480;
  return null;
}

export function parseSource(filename: string): string | null {
  const n = filename;
  // Order matters: more specific patterns first
  if (/\bBD[-.]?REMUX\b|\bBDREMUX\b|\bREMUX\b/i.test(n)) return "BDREMUX";
  if (/\bHDLight\b/i.test(n)) return "HDLight";
  if (/\bBlu[-.]?ray\b|\bBLURAY\b|\bBDRip\b/i.test(n)) return "BluRay";
  if (/\bWEB[-.]?DL\b/i.test(n)) return "WEB-DL";
  if (/\bWEB[-.]?Rip\b/i.test(n)) return "WEBRip";
  if (/\bHDTV\b/i.test(n)) return "HDTV";
  if (/\bDVD[-.]?Rip\b|\bDVDRip\b/i.test(n)) return "DVDRip";
  if (/\bHD[-.]?CAM\b/i.test(n)) return "HDCAM";
  if (/\bHDRip\b/i.test(n)) return "HDRip";
  // Generic WEB (must be last to not match WEB-DL/WEBRip)
  if (/\bWEB\b/i.test(n)) return "WEB";
  return null;
}

export function parseStreamingService(filename: string): string | null {
  const n = filename;
  if (/\bAMZN\b|\bAmazon\b/i.test(n)) return "AMZN";
  if (/\bNFLX\b|\bNF\b(?!\w)|\bNetflix\b/i.test(n)) return "NF";
  if (/\bDSNP\b|\bDisney\b/i.test(n)) return "DSNP";
  if (/\bAPLE\b|\bAPTV\b|\bApple\b/i.test(n)) return "APLE";
  if (/\bHMAX\b|\bHBO[-.]?Max\b/i.test(n)) return "HMAX";
  if (/\bHULU\b/i.test(n)) return "HULU";
  if (/\bPCOK\b|\bPeacock\b/i.test(n)) return "PCOK";
  if (/\bPAMC\b|\bParamount\b/i.test(n)) return "PAMC";
  if (/\bCRAV\b|\bCrave\b/i.test(n)) return "CRAV";
  if (/\bTVER\b|\bTVA\b/i.test(n)) return "TVER";
  return null;
}

export function parseHdrFormat(filename: string): string | null {
  const n = filename;
  // Dolby Vision first (most specific)
  if (/\bDolby\.?Vision\b|\bDOVi\b(?!\w)|\bDV\b(?!\w)/i.test(n))
    return "Dolby Vision";
  // HDR10+ before HDR10
  if (/\bHDR10\+\b|\bHDR10Plus\b|\bHDR10\s*Plus\b/i.test(n)) return "HDR10+";
  if (/\bHDR10\b/i.test(n)) return "HDR10";
  if (/\bHDR\b/i.test(n)) return "HDR10";
  if (/\bHLG\b/i.test(n)) return "HLG";
  if (/\b10.?bit\b/i.test(n)) return "HDR10"; // best guess for 10-bit without explicit HDR tag
  return null;
}

export function parseVideoCodec(filename: string): string | null {
  const n = filename;
  if (/\bx?265\b|\bHEVC\b|\bH\.?265\b/i.test(n)) return "HEVC";
  if (/\bx?264\b|\bAVC\b|\bH\.?264\b/i.test(n)) return "AVC";
  if (/\bAV1\b/i.test(n)) return "AV1";
  if (/\bVP9\b/i.test(n)) return "VP9";
  if (/\bXviD\b/i.test(n)) return "XviD";
  if (/\bDivX\b/i.test(n)) return "DivX";
  if (/\bMPEG[-.]?2\b/i.test(n)) return "MPEG-2";
  if (/\bVC[-.]?1\b/i.test(n)) return "VC-1";
  return null;
}

export function parseAudioFormat(filename: string): string | null {
  const n = filename;
  // Most specific first
  if (/\bTrueHD\b.*\bAtmos\b|\bAtmos\b.*\bTrueHD\b/i.test(n))
    return "TrueHD Atmos";
  if (/\bTrueHD\b/i.test(n)) return "TrueHD";
  if (/\bDTS[-.]?HD[-.]?MA\b|\bDTS[-.]?MA\b/i.test(n)) return "DTS-HD MA";
  if (/\bDTS[-.]?X\b/i.test(n)) return "DTS:X";
  if (/\bDTS[-.]?HD\b/i.test(n)) return "DTS-HD";
  if (/\bDTS\b/i.test(n)) return "DTS";
  if (/\bEAC[-.]?3\b|\bDD\s*\+\b|\bDolby\s*Digital\s*Plus\b|\bDDP\b/i.test(n))
    return "EAC3";
  if (/\bDD\b(?!\+)|\bAC[-.]?3\b|\bDolby\s*Digital\b/i.test(n)) return "AC3";
  if (/\bAAC\b/i.test(n)) return "AAC";
  if (/\bFLAC\b/i.test(n)) return "FLAC";
  if (/\bOPUS\b/i.test(n)) return "Opus";
  if (/\bMP3\b/i.test(n)) return "MP3";
  if (/\bPCM\b/i.test(n)) return "PCM";
  return null;
}

export function parseAudioChannels(filename: string): string | null {
  if (/\b7\.1\b/.test(filename)) return "7.1";
  if (/\b5\.1\b/.test(filename)) return "5.1";
  if (/\b2\.0\b|\bstereo\b/i.test(filename)) return "stereo";
  if (/\bmono\b/i.test(filename)) return "mono";
  return null;
}

/**
 * Detect French/multilingual audio flags from filename.
 * Returns ordered list, e.g. ["MULTI", "VFF"] or ["TRUEFRENCH"] or [].
 */
export function parseAudioFlags(filename: string): string[] {
  const n = filename.toUpperCase();
  const flags: string[] = [];

  // MULTI + qualifier
  const hasMulti = /\bMULTI\b/.test(n) || /\bMULTi\b/.test(filename);
  if (hasMulti) flags.push("MULTI");

  // VF2 = VFF + VFQ combo in some releases
  if (/\bMULTI[-.]?VF2\b|\bVF2\b/.test(n)) {
    flags.push("VF2");
    return flags; // signals both VFF+VFQ, don't add separately
  }

  // Specific French variants — only match themselves, not the generic "fr"
  if (/\bTRUEFRENCH\b/.test(n)) flags.push("TRUEFRENCH");
  if (/\bVFF\b/.test(n)) flags.push("VFF");
  if (/\bVFQ\b|\bVQC\b/.test(n)) flags.push("VFQ");
  if (/\bVFI\b/.test(n)) flags.push("VFI");
  // Generic VF / FRENCH — these emit "fr" so the generic "Français" preference catches them
  if (
    /\bVF\b/.test(n) &&
    !flags.some((f) => ["VFF", "VFQ", "VFI", "VF2", "TRUEFRENCH"].includes(f))
  ) {
    flags.push("VF");
    flags.push("fr");
  }
  if (/\bFRENCH\b/.test(n) && !flags.length) { flags.push("FRENCH"); flags.push("fr"); }
  if (/\bVOSTFR\b/.test(n)) flags.push("VOSTFR");
  if (/\bVFSTFR\b/.test(n)) flags.push("VFSTFR");

  // Generic ISO language codes — for releases that label audio tracks explicitly
  if (/\bENGLISH\b|\bENG\b/.test(n)) flags.push("en");
  if (/\bGERMAN\b|\bDEUTSCH\b|\bGER\b/.test(n)) flags.push("de");
  if (/\bSPANISH\b|\bESPANOL\b|\bSPA\b/.test(n)) flags.push("es");
  if (/\bITALIAN\b|\bITA\b/.test(n)) flags.push("it");
  if (/\bJAPANESE\b|\bJPN\b/.test(n)) flags.push("ja");
  if (/\bPORTUGUESE\b|\bPOR\b/.test(n)) flags.push("pt");

  return flags;
}

export function parseEdition(filename: string): string | null {
  const n = filename;
  if (/\bExtended\b/i.test(n)) return "Extended";
  if (/\bDirector'?s?\s*Cut\b/i.test(n)) return "Director's Cut";
  if (/\bTheatrical\b/i.test(n)) return "Theatrical";
  if (/\bUnrated\b/i.test(n)) return "Unrated";
  if (/\bRemastered\b/i.test(n)) return "Remastered";
  if (/\bCriterion\b/i.test(n)) return "Criterion";
  if (/\bIntégrale\b|\bIntegrale\b|\bComplete\b/i.test(n)) return "Intégrale";
  return null;
}

export function parseReleaseGroup(filename: string): string | null {
  const withoutExt = filename.replace(VIDEO_EXT, "").trim();
  // Remove trailing brackets e.g. "[GROUP]"
  const withoutBrackets = withoutExt.replace(/\s*[\[(][^\]]*[\])]$/, "");
  const match = withoutBrackets.match(/-([A-Za-z0-9_]+)$/);
  if (!match) return null;
  // Skip if it's a technical token
  if (TECHNICAL_TOKENS.test(match[1])) return null;
  return match[1];
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseFilenameMetadata(filename: string): FilenameMetadata {
  return {
    resolution: parseResolution(filename),
    source: parseSource(filename),
    hdrFormat: parseHdrFormat(filename),
    videoCodec: parseVideoCodec(filename),
    audioFormat: parseAudioFormat(filename),
    audioChannels: parseAudioChannels(filename),
    audioFlags: parseAudioFlags(filename),
    releaseGroup: parseReleaseGroup(filename),
    edition: parseEdition(filename),
    streaming: parseStreamingService(filename),
  };
}

// ─── Prowlarr / release title (scene names, no file extension) ───────────────

export interface ParsedRelease {
  resolution: 480 | 720 | 1080 | 2160 | null;
  source: string | null;
  codec: string | null;
  hdr: string | null;
  audio: string | null;
  group: string | null;
  streaming: string | null;
  isSample: boolean;
  isProper: boolean;
}

const RES_TITLE_RES = /\b(2160p|4K|UHD|1080p|1080i|720p|480p|576p)\b/i;

export function parseReleaseResolution(
  title: string,
): 480 | 720 | 1080 | 2160 | null {
  const n = title;
  // Explicit pixel-count tokens take priority over generic UHD/4K markers.
  // "UHD BluRay 1080p" is a 1080p encode sourced from a UHD disc — resolution is 1080p.
  if (/\b2160p\b/i.test(n)) return 2160;
  if (/\b1080[pi]\b/i.test(n)) return 1080;
  if (/\b720p\b/i.test(n)) return 720;
  if (/\b480p\b/i.test(n) || /\b576p\b/i.test(n)) return 480;
  // Fall back to generic markers only when no explicit resolution is present
  if (/\b(4K|UHD)\b/i.test(n)) return 2160;
  return null;
}

/** Order matters: REMUX before BluRay, HDLight before BluRay, WEB-DL before WEB */
export function parseReleaseSource(title: string): string | null {
  const n = title;
  if (/\bREMUX\b|\bBDREMUX\b|\bBD[-.]?REMUX\b/i.test(n)) return "REMUX";
  // HDLight: French re-encode from BluRay — check before generic BluRay
  if (/\bHDLight\b/i.test(n)) return "HDLight";
  if (/\bBlu[-.]?ray\b|\bBLURAY\b|\bBDRip\b|\bBRRip\b/i.test(n))
    return "BluRay";
  if (/\bWEB[-.]?DL\b|\bWEBDL\b/i.test(n)) return "WEB-DL";
  if (/\bWEBRip\b|\bWEB[-.]?Rip\b/i.test(n)) return "WEBRip";
  if (/\bHDRip\b/i.test(n)) return "HDRip";
  if (/\bHDTV\b/i.test(n)) return "HDTV";
  if (/\bDVDRip\b|\bDVD\b/i.test(n)) return "DVDRip";
  if (/\bWEB\b/i.test(n)) return "WEB";
  return null;
}

export function parseReleaseCodec(title: string): string | null {
  const n = title;
  if (/\bx265\b|\bH\.?265\b|\bH265\b|\bHEVC\b/i.test(n)) return "x265";
  if (/\bx264\b|\bH\.?264\b|\bH264\b|\bAVC\b/i.test(n)) return "x264";
  if (/\bAV1\b/i.test(n)) return "AV1";
  if (/\bVC[-.]?1\b/i.test(n)) return "VC-1";
  if (/\bXviD\b/i.test(n)) return "XviD";
  if (/\bDivX\b/i.test(n)) return "DivX";
  return null;
}

export function parseReleaseHdr(title: string): string | null {
  const n = title;
  if (/HDR10\+|HDR10Plus/i.test(n)) return "HDR10+";
  // DoVi/DOVI/DV are all Dolby Vision variants used across trackers
  if (/\bDolby\.?Vision\b|\bDoVi\b|\bDOVI\b|\bDV\b/i.test(n)) return "DV";
  if (/\bHDR10\b/i.test(n)) return "HDR10";
  if (/\bHDR\b/i.test(n)) return "HDR10";
  if (/\bHLG\b/i.test(n)) return "HLG";
  return null;
}

export function parseReleaseIsProper(title: string): boolean {
  return /\bPROPER\b|\bREPACK\b|\bREPROP\b|\bREAL\b|\bRERIP\b/i.test(title);
}

export function parseReleaseAudio(title: string): string | null {
  const n = title;
  if (/\bTrueHD\.?Atmos\b|\bAtmos\b.*\bTrueHD\b|\bTrueHD\b.*\bAtmos\b/i.test(n))
    return "TrueHD Atmos";
  if (/\bTrueHD\b/i.test(n)) return "TrueHD";
  if (/\bDTS[-.]?HD\.?MA\b|\bDTS[-.]?MA\b/i.test(n)) return "DTS-HD MA";
  if (/\bDTS[-.]?X\b/i.test(n)) return "DTS-X";
  if (/\bDTS[-.]?HD\b/i.test(n)) return "DTS-HD";
  if (/\bDTS\b/i.test(n)) return "DTS";
  if (/\bDDP\d*\.?\d*\b|\bDD\+\d*\.?\d*\b|\bEAC3\b|\bE[-.]?AC[-.]?3\b/i.test(n))
    return "EAC3";
  if (/\bAC3\b|\bDD\b(?!\+)/i.test(n)) return "AC3";
  if (/\bAAC\b/i.test(n)) return "AAC";
  if (/\bFLAC\b/i.test(n)) return "FLAC";
  if (/\bL?PCM\b/i.test(n)) return "PCM";
  if (/\bMP3\b/i.test(n)) return "MP3";
  if (/\bOPUS\b/i.test(n)) return "Opus";
  return null;
}

/** Last segment after final hyphen (scene / P2P release group). */
export function parseReleaseGroupFromTitle(title: string): string | null {
  const trimmed = title.trim();
  const idx = trimmed.lastIndexOf("-");
  if (idx <= 0 || idx >= trimmed.length - 1) return null;
  const seg = trimmed.slice(idx + 1).trim();
  if (!seg || seg.length > 64) return null;
  if (/\s/.test(seg)) return null;
  if (RES_TITLE_RES.test(seg)) return null;
  return seg;
}

export function parseReleaseIsSample(title: string): boolean {
  return /\bSample\b/i.test(title);
}

/**
 * Parse a raw indexer release title (Prowlarr, etc.) into structured quality fields.
 */
export function parseReleaseTitle(title: string): ParsedRelease {
  return {
    resolution: parseReleaseResolution(title),
    source: parseReleaseSource(title),
    codec: parseReleaseCodec(title),
    hdr: parseReleaseHdr(title),
    audio: parseReleaseAudio(title),
    group: parseReleaseGroupFromTitle(title),
    streaming: parseStreamingService(title),
    isSample: parseReleaseIsSample(title),
    isProper: parseReleaseIsProper(title),
  };
}

/**
 * Refine a French audio track's language label using its MediaInfo Title field
 * and filename flags (VFF, VFQ, TRUEFRENCH, etc.).
 */
export function refineFrenchAudioLabel(
  language: string,
  title: string | null,
  audioFlags: string[],
  trackIndex: number,
): { language: string; language_name: string } {
  const isFrench = /^(fre|fra|fr)$/i.test(language) || /french/i.test(language);
  if (!isFrench)
    return { language, language_name: expandLanguageCode(language) };

  const t = (title ?? "").toLowerCase();

  // Track title is the most reliable source
  if (/vfq|qu[eé]bec|qu[eé]b|canadien|canadian/i.test(t))
    return { language: "VFQ", language_name: "French (Québec)" };
  if (/vff|france|truefrench|europ/i.test(t))
    return { language: "VFF", language_name: "French (France)" };
  if (/vfi|international/i.test(t))
    return { language: "VFI", language_name: "French (International)" };

  // Fall back to filename flags
  if (audioFlags.includes("VF2")) {
    // VF2 = VFF + VFQ; first French track = VFF, second = VFQ
    return trackIndex === 0
      ? { language: "VFF", language_name: "French (France)" }
      : { language: "VFQ", language_name: "French (Québec)" };
  }
  if (audioFlags.includes("TRUEFRENCH"))
    return { language: "VFF", language_name: "French (TRUEFRENCH)" };
  if (audioFlags.includes("VFF"))
    return { language: "VFF", language_name: "French (France)" };
  if (audioFlags.includes("VFQ"))
    return { language: "VFQ", language_name: "French (Québec)" };
  if (audioFlags.includes("VFI"))
    return { language: "VFI", language_name: "French (International)" };

  return { language: "fra", language_name: "French" };
}

const ISO_639_2_NAMES: Record<string, string> = {
  eng: "English",
  fra: "French",
  fre: "French",
  spa: "Spanish",
  deu: "German",
  ger: "German",
  ita: "Italian",
  por: "Portuguese",
  jpn: "Japanese",
  chi: "Chinese",
  zho: "Chinese",
  kor: "Korean",
  rus: "Russian",
  ara: "Arabic",
  hin: "Hindi",
  nld: "Dutch",
  swe: "Swedish",
  nor: "Norwegian",
  dan: "Danish",
  fin: "Finnish",
  pol: "Polish",
  tur: "Turkish",
  heb: "Hebrew",
  tha: "Thai",
  vie: "Vietnamese",
  ind: "Indonesian",
  msa: "Malay",
  ces: "Czech",
  cze: "Czech",
  slk: "Slovak",
  hun: "Hungarian",
  ron: "Romanian",
  rum: "Romanian",
  bul: "Bulgarian",
  hrv: "Croatian",
  srp: "Serbian",
  ukr: "Ukrainian",
  ell: "Greek",
  cat: "Catalan",
  und: "Unknown",
};

export function expandLanguageCode(code: string): string {
  return ISO_639_2_NAMES[code.toLowerCase()] ?? code;
}
