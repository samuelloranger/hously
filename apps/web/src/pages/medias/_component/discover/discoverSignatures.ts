import type { DiscoverFilters } from "./discoverTypes";

export type DiscoverScrollFields = Pick<
  DiscoverFilters,
  | "mediaType"
  | "providerId"
  | "genreId"
  | "sortBy"
  | "page"
  | "originalLanguage"
> & { lang: string };

/** Same inputs as `queryKeys.medias.discover` (identity for scroll + cache). */
export function buildDiscoverScrollSignature(f: DiscoverScrollFields): string {
  return `${f.lang}|${f.mediaType}|${f.providerId}|${f.genreId}|${f.sortBy}|${f.page}|${f.originalLanguage ?? ""}`;
}

export function buildDiscoverGridKey(
  f: Pick<
    DiscoverFilters,
    | "mediaType"
    | "providerId"
    | "genreId"
    | "sortBy"
    | "page"
    | "originalLanguage"
  > & { dataPage: number | undefined },
): string {
  const page = f.dataPage ?? f.page;
  return `${f.mediaType}-${f.providerId}-${f.genreId}-${f.sortBy}-${f.originalLanguage}-${page}`;
}
