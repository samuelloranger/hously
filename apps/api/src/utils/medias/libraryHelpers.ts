/**
 * Shared helpers for TMDB-sourced library data.
 * Used by nativeLibraryFromTmdb, libraryMediaAdmin, and the refresh scripts.
 */

export function sortTitleFromName(name: string): string {
  return name.replace(/^(the |a |an )/i, "").trim();
}

export function pickDigitalRelease(
  results: Array<{
    iso_3166_1: string;
    release_dates: Array<{ type: number; release_date: string }>;
  }>,
): Date | null {
  // Prioritise US; fall back to any other country with a digital release (type 4).
  for (const country of ["US", ...results.map((r) => r.iso_3166_1)]) {
    const entry = results.find((r) => r.iso_3166_1 === country);
    const digital = entry?.release_dates.find((d) => d.type === 4);
    if (digital) return new Date(digital.release_date);
  }
  return null;
}
