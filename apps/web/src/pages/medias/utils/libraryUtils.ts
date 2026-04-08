import type { LibraryMedia, TmdbMediaSearchItem } from "@hously/shared/types";

export type SortKey = "title" | "year" | "added_at" | "status";
export type SortDir = "asc" | "desc";
export type FilterType = "all" | "movie" | "show";
export type FilterStatus =
  | "all"
  | "wanted"
  | "downloading"
  | "downloaded"
  | "skipped";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "added_at", label: "Date added" },
  { key: "title", label: "Title" },
  { key: "year", label: "Year" },
  { key: "status", label: "Status" },
];

export function sortItems(
  items: LibraryMedia[],
  sortBy: SortKey,
  sortDir: SortDir,
): LibraryMedia[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "title") cmp = a.title.localeCompare(b.title);
    else if (sortBy === "year") cmp = (a.year ?? 0) - (b.year ?? 0);
    else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
    else cmp = new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });
}

export function libraryItemToSearchItem(item: LibraryMedia): TmdbMediaSearchItem {
  return {
    id: String(item.id),
    tmdb_id: item.tmdb_id,
    media_type: item.type === "show" ? "tv" : "movie",
    title: item.title,
    release_year: item.year,
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: null,
    service: "library",
    already_exists: true,
    can_add: false,
    source_id: null,
    library_id: item.id,
  };
}
