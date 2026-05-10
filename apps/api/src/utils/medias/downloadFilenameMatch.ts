import { basename, dirname, join } from "node:path";

const TITLE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "das",
  "del",
  "des",
  "de",
  "du",
  "die",
  "ein",
  "el",
  "et",
  "la",
  "las",
  "le",
  "les",
  "los",
  "of",
  "the",
  "un",
  "une",
  "vs",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalize for loose filename comparison (underscores/hyphens/dots → spaces). */
export function normalizeComparableName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/[_+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Heuristic sibling of `…/Movies` → `…/Downloads/movies` (qBittorrent / *arr layouts). */
export function defaultMoviesDownloadsPath(
  moviesLibraryPath: string | null | undefined,
): string | null {
  const trimmed = moviesLibraryPath?.trim();
  if (!trimmed) return null;
  const baseDir = dirname(trimmed.replace(/\/+$/, ""));
  return join(baseDir, "Downloads", "movies");
}

/** Heuristic sibling of shows root → `…/Downloads/tv`. */
export function defaultShowsDownloadsPath(
  showsLibraryPath: string | null | undefined,
): string | null {
  const trimmed = showsLibraryPath?.trim();
  if (!trimmed) return null;
  const baseDir = dirname(trimmed.replace(/\/+$/, ""));
  return join(baseDir, "Downloads", "tv");
}

function significantTitleWords(normalizedTitle: string): string[] {
  const words = normalizedTitle.split(/\s+/).filter(Boolean);
  const out = words.filter((w) => !TITLE_STOPWORDS.has(w));
  return out.length ? out : words;
}

/** Word-boundary-ish match inside a normalized string (roman numerals, numbers, words). */
function normalizedStemContainsWord(normStem: string, w: string): boolean {
  const escaped = escapeRegExp(w);
  if (/^[ivxlcdm]+$/.test(w))
    return new RegExp(`(^|[^a-zA-Z])${escaped}([^a-zA-Z]|$)`, "i").test(
      normStem,
    );
  if (/^\d{1,3}$/.test(w))
    return new RegExp(`(^|[^0-9])${escaped}([^0-9]|$)`).test(normStem);
  return new RegExp(
    `(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`,
    "i",
  ).test(normStem);
}

/**
 * Whether a loose video filename corresponds to `title` (+ TMDB year when present in filename).
 * If the filename declares a 19xx / 20xx year, all such years must include `year` when set.
 */
export function movieFilenameLikelyMatches(
  filename: string,
  title: string,
  libraryYear: number | null,
): boolean {
  const base = basename(filename);
  const noExt = base.replace(/\.(mkv|mp4|avi|m4v|wmv|ts|m2ts|mov)$/i, "");
  const normStem = normalizeComparableName(noExt);
  const normTitle = normalizeComparableName(title);
  if (!normStem || !normTitle) return false;

  const words = significantTitleWords(normTitle);
  for (const w of words) {
    if (!normalizedStemContainsWord(normStem, w)) return false;
  }

  const yearTokens = [
    ...normStem.matchAll(/\b(?:19|20)\d{2}\b/g),
  ].map((m) => Number.parseInt(m[0]!, 10));
  if (
    libraryYear != null &&
    Number.isFinite(libraryYear) &&
    yearTokens.length > 0
  ) {
    const yInt = Math.trunc(libraryYear as number);
    if (!yearTokens.includes(yInt)) return false;
  }

  return true;
}

/** Whether `fullPath`'s textual content matches serialized title words (for TV paths). */
export function seriesPathMatchesTitle(
  fullPath: string,
  seriesTitle: string,
): boolean {
  const normPath = normalizeComparableName(fullPath.replace(/\\/g, "/"));
  const words = significantTitleWords(normalizeComparableName(seriesTitle));
  if (!words.length) return false;
  return words.every((w) => normalizedStemContainsWord(normPath, w));
}
