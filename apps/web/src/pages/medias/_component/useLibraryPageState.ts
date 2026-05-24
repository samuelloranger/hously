import { useUrlState } from "@/lib/app/useUrlState";
import type {
  FilterType,
  FilterStatus,
  SortKey,
  SortDir,
  ViewMode,
} from "@/utils/libraryUtils";

export const LIBRARY_DEFAULTS = {
  type: "all" as FilterType,
  status: "all" as FilterStatus,
  language: "all" as string,
  search: "" as string,
  sortBy: "added_at" as SortKey,
  sortDir: "desc" as SortDir,
  page: 1,
  viewMode: "grid" as ViewMode,
};

export type LibraryPageSearchParams = Partial<typeof LIBRARY_DEFAULTS>;

export function useLibraryPageState(
  searchParams: LibraryPageSearchParams,
  totalPages: number,
) {
  const { state, setState } = useUrlState(
    "/library/",
    searchParams,
    LIBRARY_DEFAULTS,
  );

  const safePage = Math.min(state.page, totalPages);

  const activeFilterCount = [
    state.type !== "all",
    state.status !== "all",
    state.language !== "all",
  ].filter(Boolean).length;

  return { state, setState, safePage, activeFilterCount };
}
