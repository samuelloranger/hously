import type { InteractiveReleaseItem } from "../types/media";

export type InteractiveSortKey =
  | "seeders"
  | "age"
  | "size"
  | "title"
  | "quality";
export type InteractiveSortDir = "asc" | "desc";

export const UNKNOWN_TRACKER_KEY = "__unknown_tracker__";
export const UNKNOWN_LANGUAGE_KEY = "__unknown_language__";

export const normalizeFilterKey = (value: string): string =>
  value.trim().toLocaleLowerCase();

export interface FilterParams {
  filterQuery: string;
  hideRejected: boolean;
  includedTrackers: string[];
  excludedTrackers: string[];
  includedLanguages: string[];
  sortBy: InteractiveSortKey;
  sortDir: InteractiveSortDir;
  isProwlarrMode?: boolean;
  /** Expected media title — used for client-side title/year rejection in Prowlarr mode */
  mediaTitle?: string | null;
  /** Expected media year — used for client-side year mismatch rejection in Prowlarr mode */
  mediaYear?: number | null;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "all",
  "can",
  "had",
  "her",
  "was",
  "one",
  "our",
  "out",
  "has",
  "him",
  "his",
  "how",
  "its",
  "let",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "did",
  "via",
]);

/**
 * Client-side rejection heuristic for Prowlarr results (no arr service involvement).
 * Rejects a release if:
 *  - The release title contains a 4-digit year that doesn't match the expected year, OR
 *  - The release title is missing too many distinctive words from the expected media title.
 */
function isClientRejected(
  releaseTitle: string,
  mediaTitle: string,
  mediaYear?: number | null,
): boolean {
  const normalizedRelease = releaseTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ");

  // Year check: if release title contains a year and it doesn't match, reject.
  if (mediaYear) {
    const yearMatch = normalizedRelease.match(/\b((?:19|20)\d{2})\b/);
    if (yearMatch && parseInt(yearMatch[1], 10) !== mediaYear) return true;
  }

  // Title check: distinctive words (≥3 chars, not stop words) from the expected
  // title must appear in the release title. Require 70% match.
  const titleWords = mediaTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  if (titleWords.length === 0) return false; // title too short to judge

  const matchCount = titleWords.filter((w) =>
    normalizedRelease.includes(w),
  ).length;
  return matchCount < Math.ceil(titleWords.length * 0.7);
}

/**
 * Filter and sort a list of interactive release items.
 */
export function filterAndSortReleases(
  rawReleases: InteractiveReleaseItem[],
  params: FilterParams,
): InteractiveReleaseItem[] {
  const {
    filterQuery,
    hideRejected,
    includedTrackers,
    excludedTrackers,
    includedLanguages,
    sortBy,
    sortDir,
    isProwlarrMode = false,
    mediaTitle,
    mediaYear,
  } = params;

  const includeTrackers = new Set(includedTrackers);
  const excludeTrackers = new Set(excludedTrackers);
  const includeLanguages = new Set(includedLanguages);
  const normalizedQuery = normalizeFilterKey(filterQuery);

  const filtered = rawReleases.filter((release) => {
    if (hideRejected) {
      if (release.rejected) return false;
      // Prowlarr results have no arr-side rejection — apply client-side title/year matching.
      if (isProwlarrMode && mediaTitle) {
        if (isClientRejected(release.title, mediaTitle, mediaYear))
          return false;
      }
    }

    const trackerKey = release.indexer?.trim()
      ? normalizeFilterKey(release.indexer)
      : UNKNOWN_TRACKER_KEY;
    if (includeTrackers.size > 0 && !includeTrackers.has(trackerKey))
      return false;
    if (excludeTrackers.has(trackerKey)) return false;

    if (includeLanguages.size > 0) {
      const releaseLanguageKeys =
        release.languages.length > 0
          ? release.languages.map((language) => normalizeFilterKey(language))
          : [UNKNOWN_LANGUAGE_KEY];

      if (
        !releaseLanguageKeys.some((languageKey) =>
          includeLanguages.has(languageKey),
        )
      )
        return false;
    }

    if (normalizedQuery) {
      const searchableValue = `${release.title} ${release.indexer ?? ""}`;
      if (!normalizeFilterKey(searchableValue).includes(normalizedQuery))
        return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sortBy === "quality") {
      if (a.rejected !== b.rejected) return a.rejected ? 1 : -1;
      const as = a.quality_score ?? -Number.MAX_SAFE_INTEGER;
      const bs = b.quality_score ?? -Number.MAX_SAFE_INTEGER;
      const c = sortDir === "desc" ? bs - as : as - bs;
      if (c !== 0) return c;
      return a.title.localeCompare(b.title);
    }

    let cmp = 0;
    if (sortBy === "seeders") cmp = (a.seeders ?? -1) - (b.seeders ?? -1);
    else if (sortBy === "age")
      cmp =
        (a.age ?? Number.MAX_SAFE_INTEGER) - (b.age ?? Number.MAX_SAFE_INTEGER);
    else if (sortBy === "size")
      cmp = (a.size_bytes ?? -1) - (b.size_bytes ?? -1);
    else cmp = a.title.localeCompare(b.title);

    if (cmp === 0) return a.title.localeCompare(b.title);
    return sortDir === "asc" ? cmp : -cmp;
  });
}
