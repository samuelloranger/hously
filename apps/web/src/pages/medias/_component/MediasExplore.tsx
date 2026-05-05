import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { TmdbMediaSearchPanel } from "@/pages/medias/_component/TmdbMediaSearchPanel";
import { DiscoverPanel } from "@/pages/medias/_component/DiscoverPanel";

export function MediasExplore() {
  const { t } = useTranslation("common");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  function openSearch() {
    setSearchOpen(true);
    // Must be synchronous within the user gesture — iOS/Android only open
    // the keyboard when focus() is called in the same call stack as the tap.
    searchInputRef.current?.focus();
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  return (
    <div className="pb-10">
      <div className="space-y-6">
        {/* Mobile: dormant search trigger — same visual as TmdbMediaSearchPanel card */}
        <button
          type="button"
          onClick={openSearch}
          className="md:hidden w-full text-left"
        >
          <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {t("medias.tmdb.title")}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t("medias.tmdb.subtitle")}
              </p>
            </div>
            <div className="p-4">
              <div className="relative pointer-events-none">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <div className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-2 text-sm text-neutral-400 dark:text-neutral-500">
                  {t("medias.tmdb.placeholder")}
                </div>
              </div>
            </div>
          </section>
        </button>

        {/* Desktop: real search panel */}
        <div className="hidden md:block">
          <TmdbMediaSearchPanel />
        </div>

        {/* Discover: always visible */}
        <DiscoverPanel />
      </div>

      {/* Mobile search modal — always mounted so the input exists in the DOM
          and focus() can be called synchronously before React re-renders. */}
      {createPortal(
        <div
          className={cn(
            "md:hidden fixed inset-0 z-[var(--z-modal)] transition-opacity duration-200",
            searchOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
          aria-hidden={!searchOpen}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 dark:bg-black/50"
            onClick={closeSearch}
          />

          {/* Panel */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col bg-neutral-50 dark:bg-neutral-950 transition-transform duration-200",
              searchOpen ? "translate-y-0" : "-translate-y-1",
            )}
          >
            {/* Sticky header */}
            <div className="shrink-0 flex items-start justify-between px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {t("medias.tmdb.title")}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t("medias.tmdb.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSearch}
                className="ml-3 mt-0.5 shrink-0 rounded-full p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable search content */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4">
              <TmdbMediaSearchPanel inputRef={searchInputRef} variant="modal" />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
