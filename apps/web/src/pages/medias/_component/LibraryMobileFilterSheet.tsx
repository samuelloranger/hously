import { useEffect, useRef, type ComponentType } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowUpAZ, ArrowDownAZ } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type {
  FilterType,
  FilterStatus,
  SortKey,
  SortDir,
} from "@/utils/libraryUtils";
import { LIBRARY_SORT_KEYS } from "@/utils/libraryUtils";

interface FilterItem {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

interface LibraryMobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  typeFilter: FilterType;
  statusFilter: FilterStatus;
  languageFilter: string;
  sortBy: SortKey;
  sortDir: SortDir;
  languageTags: string[];
  typeItems: FilterItem[];
  statusItems: FilterItem[];
  onTypeChange: (value: FilterType) => void;
  onStatusChange: (value: FilterStatus) => void;
  onLanguageChange: (value: string) => void;
  onSortByChange: (value: SortKey) => void;
  onSortDirChange: (value: SortDir) => void;
  onReset: () => void;
}

export function LibraryMobileFilterSheet({
  open,
  onClose,
  typeFilter,
  statusFilter,
  languageFilter,
  sortBy,
  sortDir,
  languageTags,
  typeItems,
  statusItems,
  onTypeChange,
  onStatusChange,
  onLanguageChange,
  onSortByChange,
  onSortDirChange,
  onReset,
}: LibraryMobileFilterSheetProps) {
  const { t } = useTranslation("common");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.[0]?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  const hasActiveFilters =
    typeFilter !== "all" || statusFilter !== "all" || languageFilter !== "all";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("medias.library.filtersTitle")}
            onKeyDown={handleKeyDown}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 32,
              stiffness: 380,
              mass: 0.9,
            }}
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl shadow-2xl bg-neutral-900"
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-3 border-neutral-800">
              <span className="text-sm font-semibold text-neutral-100">
                {t("medias.library.filtersTitle")}
              </span>
              <button
                onClick={onClose}
                aria-label={t("common.close")}
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
              {/* Type */}
              <section>
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  {t("medias.library.typeSection")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {typeItems.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onTypeChange(id as FilterType)}
                      className={cn(
                        "flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                        typeFilter === id
                          ? "bg-primary-500 text-white shadow-sm"
                          : "bg-neutral-800 text-neutral-300",
                      )}
                    >
                      {Icon && <Icon size={14} />}
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Status */}
              <section>
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  {t("medias.library.statusSection")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {statusItems.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onStatusChange(id as FilterStatus)}
                      className={cn(
                        "flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                        statusFilter === id
                          ? "bg-primary-500 text-white shadow-sm"
                          : "bg-neutral-800 text-neutral-300",
                      )}
                    >
                      {Icon && <Icon size={14} />}
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Language — only shown when tags are present */}
              {languageTags.length > 0 && (
                <section>
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                    {t("medias.library.languageAll")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onLanguageChange("all")}
                      className={cn(
                        "min-h-[40px] rounded-xl px-4 py-2 text-sm font-medium transition-all",
                        languageFilter === "all"
                          ? "bg-primary-500 text-white shadow-sm"
                          : "bg-neutral-800 text-neutral-300",
                      )}
                    >
                      {t("medias.library.languageOptionAll")}
                    </button>
                    {languageTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onLanguageChange(tag)}
                        className={cn(
                          "min-h-[40px] rounded-xl px-4 py-2 text-sm font-medium transition-all",
                          languageFilter === tag
                            ? "bg-primary-500 text-white shadow-sm"
                            : "bg-neutral-800 text-neutral-300",
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Sort */}
              <section>
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  {t("medias.library.sortSection")}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {LIBRARY_SORT_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSortByChange(key)}
                      className={cn(
                        "min-h-[40px] rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                        sortBy === key
                          ? "shadow-sm bg-neutral-100 text-neutral-900"
                          : "bg-neutral-800 text-neutral-300",
                      )}
                    >
                      {t(`medias.library.sort.${key}`)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSortDirChange("asc")}
                    className={cn(
                      "flex min-h-[40px] items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                      sortDir === "asc"
                        ? "shadow-sm bg-neutral-100 text-neutral-900"
                        : "bg-neutral-800 text-neutral-300",
                    )}
                  >
                    <ArrowUpAZ size={14} />
                    {t("medias.sortDirectionAsc")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSortDirChange("desc")}
                    className={cn(
                      "flex min-h-[40px] items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                      sortDir === "desc"
                        ? "shadow-sm bg-neutral-100 text-neutral-900"
                        : "bg-neutral-800 text-neutral-300",
                    )}
                  >
                    <ArrowDownAZ size={14} />
                    {t("medias.sortDirectionDesc")}
                  </button>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div
              className="flex shrink-0 items-center gap-3 border-t px-5 py-4 border-neutral-800"
              style={{
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
              }}
            >
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-sm text-neutral-400 transition-colors hover:text-neutral-300"
                >
                  {t("common.clear")}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
              >
                {t("medias.library.done")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
