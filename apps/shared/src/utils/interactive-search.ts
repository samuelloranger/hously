import type { InteractiveReleaseItem } from "../types/media";

export type InteractiveSortKey = "seeders" | "age" | "size" | "title";
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
  } = params;

  const includeTrackers = new Set(includedTrackers);
  const excludeTrackers = new Set(excludedTrackers);
  const includeLanguages = new Set(includedLanguages);
  const normalizedQuery = isProwlarrMode ? "" : normalizeFilterKey(filterQuery);

  const filtered = rawReleases.filter((release) => {
    if (hideRejected && release.rejected) return false;

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
