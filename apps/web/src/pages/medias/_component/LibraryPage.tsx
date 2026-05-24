import { useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearch } from "@tanstack/react-router";
import { Film, Tv, Clock, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { useLibraryNavigation } from "@/features/medias/context/LibraryNavigationContext";
import { PageLayout } from "@/components/PageLayout";
import { type SegmentedTabItem } from "@/components/ui/segmented-tabs";
import { useLibrary } from "@/features/medias/hooks/useLibrary";
import { useLibraryLanguageTags } from "@/features/medias/hooks/useLibraryLanguageTags";
import { useSearchLibraryMovie } from "@/features/medias/hooks/useSearchLibraryMovie";
import { useLibraryEvents } from "@/features/medias/hooks/useLibraryEvents";
import { useAuth } from "@/lib/auth/useAuth";
import {
  type FilterType,
  type FilterStatus,
  type SortDir,
  sortItems,
} from "@/utils/libraryUtils";
import { LibraryPageHeader } from "./LibraryPageHeader";
import { LibraryMobileFilterSheet } from "./LibraryMobileFilterSheet";
import { TmdbSearchModal } from "./TmdbSearchModal";
import { LibraryToolbar } from "./LibraryToolbar";
import { LibraryGrid } from "./LibraryGrid";
import {
  useLibraryPageState,
  type LibraryPageSearchParams,
} from "./useLibraryPageState";

const PAGE_SIZE = 48;

export function LibraryPage() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const { saveLibrarySearch } = useLibraryNavigation();
  const searchParams = useSearch({ from: "/library/" });

  // Keep the context in sync so LibraryItemPage can navigate back with filters intact.
  useEffect(() => {
    saveLibrarySearch(searchParams as Record<string, unknown>);
  }, [searchParams, saveLibrarySearch]);

  useLibraryEvents();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const searchMovie = useSearchLibraryMovie();

  // ─── Filter / sort / pagination state (URL-persisted) ──────────────────────
  // The hook returns `safePage` clamped to `totalPages`; we pass an initial
  // `totalPages` of 1 here and recompute below once we know the sorted length.
  // Reading state first lets us pass server-side filters into `useLibrary`.
  const { state, setState, activeFilterCount } = useLibraryPageState(
    searchParams as LibraryPageSearchParams,
    1,
  );
  const {
    type: typeFilter,
    status: statusFilter,
    language: languageFilter,
    search,
    sortBy,
    sortDir,
    page,
    viewMode,
  } = state;

  // ─── Data fetch (server filters via query params) ──────────────────────────
  const { data, isLoading, refetch } = useLibrary({
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    q: search || undefined,
    language: languageFilter !== "all" ? languageFilter : undefined,
  });

  const { data: languageTagsData } = useLibraryLanguageTags();
  const languageTags = languageTagsData?.tags ?? [];

  useEffect(() => {
    if (languageTags.length === 0 && languageFilter !== "all") {
      setState({ language: "all" });
    }
  }, [languageTags.length, languageFilter]);

  // ─── Pipeline: fetched items → sort → paginate ─────────────────────────────
  // Filtering is server-side (passed as query params to useLibrary above), so
  // the client only sorts and paginates. No client-side filter step exists in
  // the original — preserved here exactly.
  const allItems = data?.items ?? [];

  const sorted = useMemo(
    () => sortItems(allItems, sortBy, sortDir as SortDir),
    [allItems, sortBy, sortDir],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Sync page if it's out of range
  useEffect(() => {
    if (isLoading) return;
    if (page > totalPages && totalPages > 0) {
      setState({ page: totalPages > 1 ? totalPages : 1 });
    }
  }, [page, totalPages, isLoading]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const handleMovieSearch = (id: number) => {
    searchMovie.mutate(
      { id },
      {
        onSuccess: (r) => {
          if (r.grabbed) toast.success(t("library.management.grabbed"));
          else toast.error(r.reason ?? t("library.management.grabFailed"));
        },
        onError: () => toast.error(t("library.management.grabFailed")),
      },
    );
  };

  const movieCount = data?.movie_count ?? 0;
  const showCount = data?.show_count ?? 0;
  const typeItems = [
    { id: "all", label: t("medias.library.typeAll") },
    {
      id: "movie",
      label: t("medias.library.moviesWithCount", { count: movieCount }),
      icon: Film,
    },
    {
      id: "show",
      label: t("medias.library.showsWithCount", { count: showCount }),
      icon: Tv,
    },
  ] satisfies SegmentedTabItem<FilterType>[];
  const statusItems = [
    { id: "all", label: t("medias.library.statusAll") },
    {
      id: "downloaded",
      label: t("medias.library.statusDownloaded"),
      icon: CheckCircle2,
    },
    {
      id: "wanted",
      label: t("medias.library.statusWanted"),
      icon: Clock,
    },
    {
      id: "downloading",
      label: t("medias.library.statusDownloading"),
      icon: Download,
    },
  ] satisfies SegmentedTabItem<FilterStatus>[];

  return (
    <PageLayout>
      <LibraryPageHeader
        movieCount={movieCount}
        showCount={showCount}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onAddClick={() => setAddModalOpen(true)}
        isAdmin={user?.is_admin ?? false}
      />

      <div className="space-y-4">
        <LibraryToolbar
          search={search}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          languageFilter={languageFilter}
          sortBy={sortBy}
          sortDir={sortDir}
          viewMode={viewMode}
          languageTags={languageTags}
          typeItems={typeItems}
          statusItems={statusItems}
          activeFilterCount={activeFilterCount}
          onSearchChange={(value) => setState({ search: value, page: 1 })}
          onTypeChange={(value) => setState({ type: value, page: 1 })}
          onStatusChange={(value) => setState({ status: value, page: 1 })}
          onLanguageChange={(value) => setState({ language: value, page: 1 })}
          onSortByChange={(value) => setState({ sortBy: value, page: 1 })}
          onSortDirToggle={() =>
            setState({
              sortDir: sortDir === "asc" ? "desc" : "asc",
              page: 1,
            })
          }
          onViewModeChange={(value) => setState({ viewMode: value })}
          onOpenMobileSheet={() => setSheetOpen(true)}
        />

        <LibraryGrid
          items={pagedItems}
          isLoading={isLoading}
          viewMode={viewMode}
          safePage={safePage}
          totalPages={totalPages}
          totalItems={sorted.length}
          pageSize={PAGE_SIZE}
          animationKeySuffix={`${typeFilter}-${statusFilter}-${languageFilter}-${sortBy}-${sortDir}-${safePage}`}
          onPageChange={(nextPage) => setState({ page: nextPage })}
          onMovieSearch={handleMovieSearch}
          movieSearchPending={searchMovie.isPending}
          movieSearchId={searchMovie.variables?.id ?? null}
        />
      </div>

      <LibraryMobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        languageFilter={languageFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        languageTags={languageTags}
        typeItems={typeItems}
        statusItems={statusItems}
        onTypeChange={(v) => setState({ type: v, page: 1 })}
        onStatusChange={(v) => setState({ status: v, page: 1 })}
        onLanguageChange={(v) => setState({ language: v, page: 1 })}
        onSortByChange={(v) => setState({ sortBy: v, page: 1 })}
        onSortDirChange={(v) => setState({ sortDir: v, page: 1 })}
        onReset={() =>
          setState({
            type: "all",
            status: "all",
            language: "all",
            sortBy: "added_at",
            sortDir: "desc",
            page: 1,
          })
        }
      />
      <TmdbSearchModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </PageLayout>
  );
}
