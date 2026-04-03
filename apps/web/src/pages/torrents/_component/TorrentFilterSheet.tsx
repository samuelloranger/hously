import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Check, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  QBITTORRENT_STATE_FILTERS,
  type QbittorrentStateFilter,
  type QbittorrentSortKey,
  type QbittorrentSortDir,
} from "@hously/shared";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: {
  key: QbittorrentSortKey;
  labelKey: string;
  fallback: string;
}[] = [
  { key: "added_on", labelKey: "torrents.sortAdded", fallback: "Date added" },
  {
    key: "download_speed",
    labelKey: "torrents.sortDownloadSpeed",
    fallback: "Download speed",
  },
  {
    key: "upload_speed",
    labelKey: "torrents.sortUploadSpeed",
    fallback: "Upload speed",
  },
  { key: "ratio", labelKey: "torrents.sortRatio", fallback: "Ratio" },
  { key: "size", labelKey: "torrents.sortSize", fallback: "Size" },
  { key: "name", labelKey: "torrents.sortName", fallback: "Name" },
];

interface TorrentFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  stateFilter: QbittorrentStateFilter;
  onStateChange: (state: QbittorrentStateFilter) => void;
  counts: Record<string, number>;
  torrentsTotal: number;
  sortBy: QbittorrentSortKey;
  sortDir: QbittorrentSortDir;
  onSort: (key: QbittorrentSortKey) => void;
  availableCategories: string[];
  selectedCategories: string[];
  onCategoryToggle: (cat: string, checked: boolean) => void;
  availableTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string, checked: boolean) => void;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

export function TorrentFilterSheet({
  isOpen,
  onClose,
  stateFilter,
  onStateChange,
  counts,
  torrentsTotal,
  sortBy,
  sortDir,
  onSort,
  availableCategories,
  selectedCategories,
  onCategoryToggle,
  availableTags,
  selectedTags,
  onTagToggle,
  hasActiveFilters,
  onClearAll,
}: TorrentFilterSheetProps) {
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white dark:bg-neutral-900 rounded-t-2xl max-h-[88vh] flex flex-col shadow-2xl [animation:sheet-slide-up_0.28s_ease-out]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
              {t("torrents.filtersTitle", "Filters & Sort")}
            </h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-medium"
              >
                {t("torrents.clearFilters", "Clear all")}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-5 space-y-6">
          {/* Status */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
              {t("torrents.filterSection", "Status")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {QBITTORRENT_STATE_FILTERS.map((filter) => {
                const count =
                  filter.id === "all"
                    ? torrentsTotal
                    : (counts[filter.id] ?? 0);
                if (filter.id !== "all" && count === 0) return null;
                const active = stateFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => onStateChange(filter.id)}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border",
                      active
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
                    )}
                  >
                    <span>{t(filter.labelKey)}</span>
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        active
                          ? "text-white/70"
                          : "text-neutral-400 dark:text-neutral-500",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Sort */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
              {t("torrents.sortSection", "Sort by")}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map(({ key, labelKey, fallback }) => {
                const active = sortBy === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSort(key)}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all border",
                      active
                        ? "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100"
                        : "bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
                    )}
                  >
                    <span>{t(labelKey, fallback)}</span>
                    {active &&
                      (sortDir === "asc" ? (
                        <ArrowUp size={13} className="shrink-0" />
                      ) : (
                        <ArrowDown size={13} className="shrink-0" />
                      ))}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                {t("dashboard.qbittorrent.categories", "Categories")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => {
                  const selected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => onCategoryToggle(cat, !selected)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                        selected
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
                      )}
                    >
                      {selected && <Check size={12} />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tags */}
          {availableTags.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                {t("dashboard.qbittorrent.tags", "Tags")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onTagToggle(tag, !selected)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                        selected
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
                      )}
                    >
                      {selected && <Check size={12} />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-6 pt-3 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
          >
            {t("torrents.applyFilters", "Show results")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
