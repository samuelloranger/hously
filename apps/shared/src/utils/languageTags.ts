import type { LibraryAudioTrack } from "../types/library";

export type LanguageTag = string;

const EN_CODES = new Set(["en", "eng", "english"]);
const FR_CODES = new Set(["fr", "fre", "fra", "french"]);

const VFQ_KEYWORDS = [
  "vfq",
  "truefrench",
  "quebec",
  "québec",
  "québécois",
  "quebecois",
  "canadian",
  "canada",
  "fr-ca",
  "fr_ca",
  "frca",
];

const VFF_KEYWORDS = [
  "vff",
  "vf2",
  "parisian",
  "parisien",
  "france",
  "fr-fr",
  "fr_fr",
  "frfr",
];

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function classifyFrenchTrack(
  trackTitle: string | null,
  releaseName: string | null,
): "VFQ" | "VFF" | "FR" {
  const trackHaystack = normalize(trackTitle);
  if (trackHaystack) {
    if (containsAny(trackHaystack, VFQ_KEYWORDS)) return "VFQ";
    if (containsAny(trackHaystack, VFF_KEYWORDS)) return "VFF";
  }
  const releaseHaystack = normalize(releaseName);
  if (releaseHaystack) {
    if (containsAny(releaseHaystack, VFQ_KEYWORDS)) return "VFQ";
    if (containsAny(releaseHaystack, VFF_KEYWORDS)) return "VFF";
  }
  return "FR";
}

function classifyTrack(
  track: LibraryAudioTrack,
  releaseName: string | null,
): LanguageTag {
  const code = normalize(track.language);
  if (EN_CODES.has(code)) return "EN";
  if (FR_CODES.has(code)) {
    return classifyFrenchTrack(track.title, releaseName);
  }
  if (!code || code === "und" || code === "zxx") return "UND";
  return code.slice(0, 3).toUpperCase();
}

/**
 * Returns a sorted, de-duplicated list of language tags derived from the
 * file's audio tracks. Uses the release name as a fallback to distinguish
 * VFQ/VFF when the track title is silent.
 */
export function classifyLanguageTags(
  audioTracks: LibraryAudioTrack[] | null | undefined,
  releaseName: string | null = null,
): LanguageTag[] {
  if (!audioTracks || audioTracks.length === 0) return [];
  const tags = new Set<LanguageTag>();
  for (const track of audioTracks) {
    tags.add(classifyTrack(track, releaseName));
  }
  return [...tags].sort(compareTags);
}

const TAG_ORDER: Record<string, number> = {
  EN: 0,
  VFQ: 1,
  VFF: 2,
  FR: 3,
};

export function compareTags(a: LanguageTag, b: LanguageTag): number {
  const ai = TAG_ORDER[a] ?? 100;
  const bi = TAG_ORDER[b] ?? 100;
  if (ai !== bi) return ai - bi;
  return a.localeCompare(b);
}
