/**
 * Pure matching engine that evaluates which upload slots best fit
 * a media file based on resolution, codec, source type,
 * HDR, quality tier, and file size.
 */
import type { MediaInfoResponse, C411ReleaseStatusResponse, C411Slot } from '../types/c411';
import {
  formatReleaseSize as formatSize,
  normalizeResolution,
  normalizeVideoCodec,
  detectSourceType,
  detectHdr,
  parseVideoBitrateMbps,
} from './index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotState = 'neutral' | 'occupied' | 'mine' | 'match' | 'candidate';

export type SourceType =
  | 'REMUX'
  | 'BDMV'
  | '4KLIGHT'
  | 'HDLIGHT'
  | 'WEB-DL'
  | 'WEBRIP'
  | 'WEB'
  | 'BDRIP'
  | 'BLURAY'
  | 'HDTV'
  | 'DVDRIP';

export type QualityTier = 'pure' | 'high' | 'lossy' | 'unknown';
export type HdrMode = 'required' | 'forbidden' | 'ignore';

export type LocalMediaProfile = {
  resolution: string | null;
  sourceLabel: string | null;
  sourceType: SourceType | null;
  videoCodec: string | null;
  size: number | null;
  bitrateMbps: number | null;
  hdr: boolean;
  tier: QualityTier;
};

export type SizeRange = {
  min: number | null;
  max: number | null;
};

export type SlotShape = {
  resolution: string | null;
  sourceTypes: SourceType[];
  videoCodec: string | null;
  hdrMode: HdrMode;
  preferredTier: QualityTier;
  sizeRange: SizeRange | null;
};

export type SlotEvaluation = {
  score: number;
  confidence: number;
};

// ---------------------------------------------------------------------------
// Constants — scoring weights & thresholds
// ---------------------------------------------------------------------------

const BYTES_PER_GB = 1_073_741_824;

/** Scoring weights for each dimension match. */
const WEIGHT = {
  resolution: { score: 35, confidence: 25 },
  videoCodec: { score: 25, confidence: 20 },
  sourceType: { score: 35, confidence: 30 },
  hdr: { score: 10, confidence: 10 },
  tierPure: { score: 20, confidence: 20 },
  tierHigh: { score: 18, confidence: 15 },
  tierLossy: { score: 12, confidence: 10 },
  sizeInRange: { score: 12, confidence: 8 },
  sizeNearRange: { score: 6, confidence: 0 },
  bonusSmall: 6,
  bonusMedium: 8,
  bonusLarge: 12,
  bonusMinor: 4,
} as const;

/** Minimum confidence to be considered a best-match or candidate. */
const CONFIDENCE_MATCH = 60;
const CONFIDENCE_CANDIDATE = 50;

/** Size tolerance when inferring range from existing occupants. */
const SIZE_TOLERANCE_SINGLE = { lower: 0.88, upper: 1.12 };
const SIZE_TOLERANCE_MULTI = { lower: 0.95, upper: 1.05 };

/** How far outside the expected range a file can be before being rejected. */
const SIZE_GAP_NEAR = 0.1;
const SIZE_GAP_REJECT = 0.2;

/** Bitrate / size thresholds that separate "high" from "lossy" quality. */
const HIGH_QUALITY_THRESHOLDS: Record<string, { bitrateMbps: number; sizeBytes: number }> = {
  '2160P': { bitrateMbps: 18, sizeBytes: 16 * BYTES_PER_GB },
  '1080P': { bitrateMbps: 9, sizeBytes: 8 * BYTES_PER_GB },
};

const WEB_SOURCE_TYPES: SourceType[] = ['WEB-DL', 'WEBRIP', 'WEB'];
const LOSSY_SOURCE_TYPES: SourceType[] = ['HDLIGHT', 'WEB-DL', 'WEBRIP', 'WEB', 'BDRIP', '4KLIGHT'];

// ---------------------------------------------------------------------------
// Size range helpers
// ---------------------------------------------------------------------------

export function parseSizeRange(value: string | null | undefined): SizeRange | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/,/g, '.');
  const toBytes = (size: string) => Math.round(Number(size) * BYTES_PER_GB);

  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:go|gb|g)\s*(?:-|a|à|to)\s*(\d+(?:\.\d+)?)\s*(?:go|gb|g)?/i);
  if (rangeMatch) return { min: toBytes(rangeMatch[1]), max: toBytes(rangeMatch[2]) };

  const maxMatch = text.match(/(?:<|<=|moins de)\s*(\d+(?:\.\d+)?)\s*(?:go|gb|g)/i);
  if (maxMatch) return { min: null, max: toBytes(maxMatch[1]) };

  const minMatch = text.match(/(?:>|>=|plus de)\s*(\d+(?:\.\d+)?)\s*(?:go|gb|g)|(\d+(?:\.\d+)?)\s*(?:go|gb|g)\s*\+/i);
  if (minMatch) return { min: toBytes(minMatch[1] || minMatch[2]), max: null };

  return null;
}

/**
 * When a slot has no explicit size constraint in its label, estimate an
 * acceptable range from existing occupants.
 */
function inferSizeRangeFromOccupants(slot: C411Slot): SizeRange | null {
  const sizes = slot.occupants
    .map((occupant) => occupant.fileSize)
    .filter((size) => Number.isFinite(size) && size > 0);

  if (sizes.length === 0) return null;

  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const tolerance = sizes.length === 1 ? SIZE_TOLERANCE_SINGLE : SIZE_TOLERANCE_MULTI;

  return {
    min: Math.round(min * tolerance.lower),
    max: Math.round(max * tolerance.upper),
  };
}

function isWithinRange(size: number, range: SizeRange): boolean {
  if (range.min != null && size < range.min) return false;
  if (range.max != null && size > range.max) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Media profile (from local file info)
// ---------------------------------------------------------------------------

function isHighQuality(profile: Omit<LocalMediaProfile, 'tier'>): boolean {
  if (!profile.resolution) return false;
  const threshold = HIGH_QUALITY_THRESHOLDS[profile.resolution];
  if (!threshold) return false;
  return (
    (profile.bitrateMbps != null && profile.bitrateMbps >= threshold.bitrateMbps) ||
    (profile.size != null && profile.size >= threshold.sizeBytes)
  );
}

function inferMediaTier(profile: Omit<LocalMediaProfile, 'tier'>): QualityTier {
  if (profile.sourceType === 'REMUX' || profile.sourceType === 'BDMV') return 'pure';
  if (profile.videoCodec === 'H264') return 'lossy';
  if (profile.videoCodec !== 'H265' && profile.videoCodec !== 'AV1') return 'unknown';

  if (profile.sourceType && LOSSY_SOURCE_TYPES.includes(profile.sourceType)) return 'lossy';

  return isHighQuality(profile) ? 'high' : 'lossy';
}

export function buildMediaProfile(mediaInfo: MediaInfoResponse | null): LocalMediaProfile | null {
  if (!mediaInfo?.media_info) return null;

  const sceneText = mediaInfo.scene_name || '';
  const sourceLabel = mediaInfo.media_info.source !== 'N/A' ? mediaInfo.media_info.source : null;
  const sourceType = (detectSourceType(sceneText) ?? detectSourceType(sourceLabel)) as SourceType | null;
  const videoCodec = normalizeVideoCodec(mediaInfo.media_info.video_codec);
  const bitrateMbps = parseVideoBitrateMbps(mediaInfo.media_info.video_bitrate);

  const baseProfile = {
    resolution: normalizeResolution(mediaInfo.media_info.resolution),
    sourceLabel,
    sourceType,
    videoCodec,
    size: mediaInfo.file_size ?? null,
    bitrateMbps,
    hdr: detectHdr(sceneText),
  };

  return { ...baseProfile, tier: inferMediaTier(baseProfile) };
}

// ---------------------------------------------------------------------------
// Slot shape (from slot label / profile text)
// ---------------------------------------------------------------------------

function inferSlotSourceTypes(text: string): SourceType[] {
  const lower = text.toLowerCase();

  if (lower.includes('hdlight/webrip') || lower.includes('bluray.hdlight/webrip')) return ['HDLIGHT', 'WEBRIP', 'WEB-DL', 'WEB'];
  if (lower.includes('bdmv')) return ['BDMV'];
  if (lower.includes('remux')) return ['REMUX'];
  if (/bluray\s+(sdr|hdr|h\.265|av1|encode)/.test(lower)) return ['BLURAY'];
  if (lower.includes('4klight')) return ['4KLIGHT'];
  if (lower.includes('hdlight')) return ['HDLIGHT'];
  if (lower.includes('webrip') || lower.includes('web-dl') || lower.includes('webdl') || /\bweb\b/.test(lower)) return ['WEBRIP', 'WEB-DL', 'WEB'];
  if (lower.includes('bdrip') || lower.includes('direct play')) return ['BDRIP', 'BLURAY'];
  if (lower.includes('bluray') || lower.includes('blu-ray')) return ['BLURAY'];
  if (lower.includes('hdtv')) return ['HDTV'];
  if (lower.includes('dvd')) return ['DVDRIP'];
  return [];
}

function inferSlotTier(profile: string): QualityTier {
  if (profile === 'pure') return 'pure';
  if (profile === 'hc_optimized') return 'high';
  if (profile === 'compatibility' || profile === 'optimization') return 'lossy';
  return 'unknown';
}

export function inferSlotShape(slot: C411Slot): SlotShape {
  const text = `${slot.profile} ${slot.label}`;
  const lower = text.toLowerCase();

  return {
    resolution: normalizeResolution(text),
    sourceTypes: inferSlotSourceTypes(text),
    videoCodec: normalizeVideoCodec(text),
    hdrMode: /\bhdr10?\b/i.test(lower) ? 'required' : /\bsdr\b/i.test(lower) ? 'forbidden' : 'ignore',
    preferredTier: inferSlotTier(slot.profile),
    sizeRange: parseSizeRange(text) ?? inferSizeRangeFromOccupants(slot),
  };
}

// ---------------------------------------------------------------------------
// Slot evaluation — scores how well a media file fits a slot
// ---------------------------------------------------------------------------

function isWebSource(sourceType: SourceType): boolean {
  return WEB_SOURCE_TYPES.includes(sourceType);
}

export function evaluateSlot(slot: C411Slot, media: LocalMediaProfile | null): SlotEvaluation {
  if (!media) return { score: 0, confidence: 0 };

  const shape = inferSlotShape(slot);
  let score = 0;
  let confidence = 0;

  if (shape.resolution) {
    if (media.resolution !== shape.resolution) return { score: 0, confidence: 0 };
    score += WEIGHT.resolution.score;
    confidence += WEIGHT.resolution.confidence;
  }

  if (shape.videoCodec) {
    if (media.videoCodec !== shape.videoCodec) return { score: 0, confidence: 0 };
    score += WEIGHT.videoCodec.score;
    confidence += WEIGHT.videoCodec.confidence;
  }

  if (shape.sourceTypes.length > 0) {
    if (!media.sourceType || !shape.sourceTypes.includes(media.sourceType)) return { score: 0, confidence: 0 };
    score += WEIGHT.sourceType.score;
    confidence += WEIGHT.sourceType.confidence;
  }

  if (shape.hdrMode === 'required' && !media.hdr) return { score: 0, confidence: 0 };
  if (shape.hdrMode === 'forbidden' && media.hdr) return { score: 0, confidence: 0 };
  if (shape.hdrMode === 'required') {
    score += WEIGHT.hdr.score;
    confidence += WEIGHT.hdr.confidence;
  }

  if (shape.preferredTier === 'pure') {
    if (media.tier !== 'pure') return { score: 0, confidence: 0 };
    score += WEIGHT.tierPure.score;
    confidence += WEIGHT.tierPure.confidence;
  } else if (shape.preferredTier === 'high') {
    if (media.tier === 'lossy') return { score: 0, confidence: 0 };
    if (media.tier === 'high') {
      score += WEIGHT.tierHigh.score;
      confidence += WEIGHT.tierHigh.confidence;
    }
  } else if (shape.preferredTier === 'lossy' && media.tier === 'lossy') {
    score += WEIGHT.tierLossy.score;
    confidence += WEIGHT.tierLossy.confidence;
  }

  if (media.size != null && shape.sizeRange) {
    if (isWithinRange(media.size, shape.sizeRange)) {
      score += WEIGHT.sizeInRange.score;
      confidence += WEIGHT.sizeInRange.confidence;
    } else {
      const lowerGap = shape.sizeRange.min != null ? Math.abs(media.size - shape.sizeRange.min) / media.size : Infinity;
      const upperGap = shape.sizeRange.max != null ? Math.abs(media.size - shape.sizeRange.max) / media.size : Infinity;
      const sizeGap = Math.min(lowerGap, upperGap);

      if (sizeGap <= SIZE_GAP_NEAR) {
        score += WEIGHT.sizeNearRange.score;
      } else if (sizeGap > SIZE_GAP_REJECT) {
        return { score: 0, confidence: 0 };
      }
    }
  }

  if (media.sourceType === 'BLURAY' && (slot.id.includes('COMPAT-01') || /bdrip/i.test(slot.label))) {
    score += WEIGHT.bonusSmall;
  }

  if (media.sourceType === 'HDLIGHT' && slot.id.includes('COMPAT-WR')) {
    score += WEIGHT.bonusSmall;
  }

  if (media.sourceType && isWebSource(media.sourceType) && slot.id.includes('COMPAT-WR')) {
    score += WEIGHT.bonusMedium;
  }

  if (media.sourceType === 'BLURAY' && media.videoCodec === 'H265') {
    if (slot.profile === 'optimization') {
      score += media.tier === 'lossy' ? WEIGHT.bonusLarge : WEIGHT.bonusMinor;
    }
    if (slot.profile === 'hc_optimized' && media.tier === 'high') {
      score += WEIGHT.bonusLarge;
    }
  }

  return { score, confidence };
}

export function buildSlotStates(
  data: C411ReleaseStatusResponse,
  mediaInfo: MediaInfoResponse | null,
): Map<string, SlotState> {
  const states = new Map<string, SlotState>();
  const media = buildMediaProfile(mediaInfo);

  const ranked = data.slotGrid
    .map((slot) => ({ slot, evaluation: evaluateSlot(slot, media) }))
    .filter((entry) => entry.evaluation.score > 0)
    .sort((a, b) => b.evaluation.score - a.evaluation.score || b.evaluation.confidence - a.evaluation.confidence);

  const bestMatch = ranked.find((entry) => entry.evaluation.confidence >= CONFIDENCE_MATCH) ?? null;

  const showCandidate = !bestMatch || bestMatch.slot.occupants.length > 0;
  const candidate = showCandidate
    ? ranked.find(
        (entry) =>
          entry.slot.id !== bestMatch?.slot.id &&
          entry.slot.occupants.length === 0 &&
          entry.evaluation.confidence >= CONFIDENCE_CANDIDATE,
      ) ?? null
    : null;

  for (const slot of data.slotGrid) {
    if (bestMatch?.slot.id === slot.id) {
      states.set(slot.id, 'match');
    } else if (candidate?.slot.id === slot.id) {
      states.set(slot.id, 'candidate');
    } else {
      states.set(
        slot.id,
        slot.occupants.some((occupant) => occupant.isMine) ? 'mine' : slot.occupants.length > 0 ? 'occupied' : 'neutral',
      );
    }
  }

  return states;
}

export function buildMediaSummary(mediaInfo: MediaInfoResponse | null): string | null {
  if (!mediaInfo?.media_info) return null;

  const parts = [
    mediaInfo.media_info.resolution,
    mediaInfo.media_info.source !== 'N/A' ? mediaInfo.media_info.source : null,
    mediaInfo.media_info.video_codec !== 'N/A' ? mediaInfo.media_info.video_codec : null,
    mediaInfo.file_size != null ? formatSize(mediaInfo.file_size) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : null;
}
