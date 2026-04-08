import {
  type ParsedRelease,
  parseAudioFlags,
} from "@hously/api/utils/medias/filenameParser";

export interface QualityProfileScoreInput {
  minResolution: number;
  /** Hard ceiling — releases above this resolution are rejected. null = no ceiling. */
  cutoffResolution: number | null;
  preferredSources: string[];
  preferredCodecs: string[];
  /** e.g. VFF, VF2, en — matched via parseAudioFlags on the release title */
  preferredLanguages: string[];
  maxSizeGb: number | null;
  requireHdr: boolean;
  preferHdr: boolean;
}

const RES_RANK: Record<number, number> = {
  480: 1,
  720: 2,
  1080: 3,
  2160: 4,
};

function resolutionRank(
  r: ParsedRelease["resolution"],
): number | null {
  if (r == null) return null;
  const v = RES_RANK[r];
  return v === undefined ? null : v;
}

function minResolutionRank(minRes: number): number | null {
  const v = RES_RANK[minRes];
  return v === undefined ? null : v;
}

function sourceAliases(source: string): string[] {
  const u = source.trim();
  const lower = u.toLowerCase();
  const set = new Set<string>([u, lower]);
  if (lower === "remux" || lower === "bdremux") {
    set.add("REMUX");
    set.add("BluRay");
    set.add("bluray");
  }
  if (lower === "bluray" || lower === "blu-ray") {
    set.add("BluRay");
    set.add("BDRip");
  }
  if (lower === "web-dl" || lower === "webdl") {
    set.add("WEB-DL");
    set.add("WEBDL");
  }
  if (lower === "webrip") {
    set.add("WEBRip");
  }
  if (lower === "web") {
    set.add("WEB");
    set.add("WEB-DL");
    set.add("WEBRip");
  }
  return [...set];
}

function parsedSourceMatchesPreferred(
  parsed: string | null,
  preferred: string,
): boolean {
  if (!parsed) return false;
  const pAli = sourceAliases(parsed);
  const prefAli = sourceAliases(preferred);
  for (const a of pAli) {
    for (const b of prefAli) {
      if (a.toLowerCase() === b.toLowerCase()) return true;
    }
  }
  return false;
}

function indexScore(index: number, base: number): number {
  if (index < 0) return 0;
  return Math.max(0, base - index * 100);
}

function languagePreferenceScore(title: string, preferred: string[]): number {
  if (!preferred.length) return 0;
  const flags = new Set(
    parseAudioFlags(title).map((f) => f.toLowerCase()),
  );
  const idx = preferred.findIndex((p) =>
    flags.has(p.trim().toLowerCase()),
  );
  return indexScore(idx, 300);
}

/**
 * Score a parsed release against a quality profile.
 * @param releaseTitleForFlags raw indexer title (used for parseAudioFlags / language bonus)
 * @returns null if the release fails hard requirements.
 */
export function scoreRelease(
  parsed: ParsedRelease,
  profile: QualityProfileScoreInput,
  sizeBytes: number | null,
  releaseTitleForFlags?: string | null,
): number | null {
  const pr = resolutionRank(parsed.resolution);
  const minR = minResolutionRank(profile.minResolution);
  if (minR == null || pr == null) return null;
  if (pr < minR) return null;

  if (profile.cutoffResolution != null) {
    const cutoffR = minResolutionRank(profile.cutoffResolution);
    if (cutoffR != null && pr > cutoffR) return null;
  }

  if (profile.requireHdr && !parsed.hdr) return null;

  if (
    profile.maxSizeGb != null &&
    sizeBytes != null &&
    sizeBytes > profile.maxSizeGb * 1e9
  ) {
    return null;
  }

  if (parsed.isSample) return null;

  let score = 0;

  const tierDelta = pr - minR;
  score += tierDelta * 1000;

  const srcIdx = profile.preferredSources.findIndex((pref) =>
    parsedSourceMatchesPreferred(parsed.source, pref),
  );
  score += indexScore(srcIdx, 500);

  const codecIdx = profile.preferredCodecs.findIndex((pref) => {
    if (!parsed.codec) return false;
    return pref.toLowerCase() === parsed.codec.toLowerCase();
  });
  score += indexScore(codecIdx, 200);

  score += languagePreferenceScore(
    releaseTitleForFlags ?? "",
    profile.preferredLanguages,
  );

  if (profile.preferHdr && parsed.hdr) score += 100;

  if (profile.maxSizeGb == null && sizeBytes != null) {
    const gb = sizeBytes / 1e9;
    if (gb > 10) {
      score -= Math.floor(gb - 10) * 50;
    }
  }

  return score;
}
