import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import type { ParsedRelease } from "@hously/api/utils/medias/filenameParser";

export type MediaFileRow = {
  resolution: number | null;
  source: string | null;
  videoCodec: string | null;
  hdrFormat: string | null;
  sizeBytes: bigint | null;
  languageTags: string[];
};

/**
 * Returns true if any MediaFile row fails the given quality profile.
 * Empty array → false (nothing downloaded = nothing to upgrade).
 */
export function filesFailProfile(
  files: MediaFileRow[],
  profile: QualityProfileScoreInput,
): boolean {
  if (files.length === 0) return false;

  for (const f of files) {
    const parsed: ParsedRelease = {
      resolution: f.resolution as 480 | 720 | 1080 | 2160 | null,
      source: f.source,
      codec: f.videoCodec,
      hdr: f.hdrFormat,
      audio: null,
      group: null,
      streaming: null,
      isSample: false,
      isProper: false,
    };

    const sizeNum = f.sizeBytes != null ? Number(f.sizeBytes) : null;
    const langString = f.languageTags.join(" ");

    const result = scoreRelease(parsed, profile, sizeNum, langString, null, false);

    if (Array.isArray(result)) return true;
  }

  return false;
}
