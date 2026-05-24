import { motion, AnimatePresence, type Variants } from "motion/react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import type { LibraryMedia } from "@hously/shared/types";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/utils/libraryUtils";
import { LibraryItemCard } from "./LibraryItemCard";
import { LibraryItemRow } from "./LibraryItemRow";

// ─── Motion variants ──────────────────────────────────────────────────────────

const gridContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

const gridItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

interface LibraryGridProps {
  items: LibraryMedia[];
  isLoading: boolean;
  viewMode: ViewMode;
  safePage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  // Used in the AnimatePresence key so transitions trigger on filter changes.
  animationKeySuffix: string;
  onPageChange: (page: number) => void;
  onMovieSearch: (id: number) => void;
  movieSearchPending: boolean;
  movieSearchId: number | null;
}

export function LibraryGrid({
  items,
  isLoading,
  viewMode,
  safePage,
  totalPages,
  totalItems,
  pageSize,
  animationKeySuffix,
  onPageChange,
  onMovieSearch,
  movieSearchPending,
  movieSearchId,
}: LibraryGridProps) {
  const { t } = useTranslation("common");

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading ? (
          viewMode === "list" ? (
            <div key="skeleton" className="flex flex-col gap-1.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div
              key="skeleton"
              className={cn(
                "grid gap-2",
                viewMode === "compact"
                  ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3",
              )}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                />
              ))}
            </div>
          )
        ) : items.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmptyState
              icon={Clapperboard}
              title={t("medias.library.emptyTitle")}
              description={t("medias.library.emptyDescription")}
            />
          </motion.div>
        ) : viewMode === "list" ? (
          <motion.div
            key={`list-${animationKeySuffix}`}
            className="flex flex-col gap-1"
            variants={gridContainerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {items.map((item) => (
              <motion.div key={item.id} variants={gridItemVariants}>
                <LibraryItemRow
                  item={item}
                  onMovieSearch={onMovieSearch}
                  movieSearchPending={
                    movieSearchPending && movieSearchId === item.id
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={`${viewMode}-${animationKeySuffix}`}
            className={cn(
              "grid gap-2",
              viewMode === "compact"
                ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3",
            )}
            variants={gridContainerVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {items.map((item) => (
              <motion.div key={item.id} variants={gridItemVariants}>
                <LibraryItemCard
                  item={item}
                  viewMode={viewMode}
                  onMovieSearch={onMovieSearch}
                  movieSearchPending={
                    movieSearchPending && movieSearchId === item.id
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("medias.library.paginationRange", {
              start: (safePage - 1) * pageSize + 1,
              end: Math.min(safePage * pageSize, totalItems),
              total: totalItems,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage <= 1}
              className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 min-w-[60px] text-center">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage >= totalPages}
              className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
