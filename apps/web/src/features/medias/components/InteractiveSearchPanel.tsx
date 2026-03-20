import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Download, RefreshCw, Search, TriangleAlert, X } from 'lucide-react';
import {
  formatBytes,
  useMediaInteractiveDownload,
  useMediaInteractiveSearch,
  useProwlarrInteractiveDownload,
  useProwlarrInteractiveSearch,
  filterAndSortReleases,
  normalizeFilterKey,
  UNKNOWN_TRACKER_KEY,
  UNKNOWN_LANGUAGE_KEY,
  type InteractiveReleaseItem,
  type MediaItem,
  type InteractiveSortKey,
  type InteractiveSortDir,
} from '@hously/shared';

export interface InteractiveSearchPanelProps {
  isActive: boolean;
  media?: MediaItem | null;
  mode?: 'arr' | 'prowlarr';
  onDownloadSuccess?: () => void;
}

type FilterOption = { key: string; label: string };

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-full px-1 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
      style={{ touchAction: 'manipulation' }}
    >
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          checked ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
    </button>
  );
}

function ChipMultiSelect({
  options,
  selected,
  onChange,
  emptyText,
}: {
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  emptyText: string;
}) {
  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
  };

  if (options.length === 0) {
    return <span className="text-[11px] italic text-neutral-400 dark:text-neutral-500">{emptyText}</span>;
  }

  return (
    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1 pb-2">
      {options.map(option => {
        const active = selected.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => toggle(option.key)}
            style={{ touchAction: 'manipulation' }}
            className={`inline-flex appearance-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
              active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
            }`}
          >
            {option.label}
            {active && <X size={9} strokeWidth={2.5} />}
          </button>
        );
      })}
    </div>
  );
}

function FilterSection({ title, children, badge }: { title: string; children: React.ReactNode; badge?: number }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="group flex w-full items-center justify-between py-1"
        style={{ touchAction: 'manipulation' }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {title}
          {badge != null && badge > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          size={12}
          className={`text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

export function InteractiveSearchPanel({ isActive, media = null, mode = 'arr', onDownloadSuccess }: InteractiveSearchPanelProps) {
  const { t } = useTranslation('common');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isProwlarrMode = mode === 'prowlarr';
  const sourceId = media?.source_id ?? null;
  const service = media?.service ?? 'radarr';
  const [filterQuery, setFilterQuery] = useState('');
  const [prowlarrQuery, setProwlarrQuery] = useState('');
  const [debouncedProwlarrQuery, setDebouncedProwlarrQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [hideRejected, setHideRejected] = useState(true);
  const [sortBy, setSortBy] = useState<InteractiveSortKey>('seeders');
  const [sortDir, setSortDir] = useState<InteractiveSortDir>('desc');
  const [includedTrackers, setIncludedTrackers] = useState<string[]>([]);
  const [excludedTrackers, setExcludedTrackers] = useState<string[]>([]);
  const [includedLanguages, setIncludedLanguages] = useState<string[]>([]);
  const [pendingReleaseKey, setPendingReleaseKey] = useState<string | null>(null);

  const arrQuery = useMediaInteractiveSearch(
    { service, source_id: sourceId },
    {
      enabled: isActive && !isProwlarrMode && Boolean(media),
    }
  );
  const prowlarrSearchQuery = useProwlarrInteractiveSearch(debouncedProwlarrQuery, {
    enabled: isActive && isProwlarrMode,
  });
  const arrDownloadMutation = useMediaInteractiveDownload();
  const prowlarrDownloadMutation = useProwlarrInteractiveDownload();
  const activeQuery = isProwlarrMode ? prowlarrSearchQuery : arrQuery;
  const activeDownloadMutation = isProwlarrMode ? prowlarrDownloadMutation : arrDownloadMutation;

  useEffect(() => {
    if (!isActive) return;

    setFilterQuery('');
    setProwlarrQuery('');
    setDebouncedProwlarrQuery('');
    setShowFilters(false);
    setHideRejected(true);
    setIncludedTrackers([]);
    setExcludedTrackers([]);
    setIncludedLanguages([]);
    setPendingReleaseKey(null);

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isActive, isProwlarrMode, media?.id]);

  useEffect(() => {
    if (!isProwlarrMode) return;

    const timeout = window.setTimeout(() => {
      setDebouncedProwlarrQuery(prowlarrQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [isProwlarrMode, prowlarrQuery]);

  const trackerOptions = useMemo<FilterOption[]>(() => {
    const options = new Map<string, string>();

    for (const release of activeQuery.data?.releases ?? []) {
      const trackerLabel = release.indexer?.trim() || t('medias.interactive.unknownIndexer');
      const trackerKey = release.indexer?.trim() ? normalizeFilterKey(release.indexer) : UNKNOWN_TRACKER_KEY;
      if (!options.has(trackerKey)) options.set(trackerKey, trackerLabel);
    }

    return [...options.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [activeQuery.data?.releases, t]);

  const languageOptions = useMemo<FilterOption[]>(() => {
    const options = new Map<string, string>();

    for (const release of activeQuery.data?.releases ?? []) {
      const languages = release.languages.length > 0 ? release.languages : [t('medias.interactive.unknownLanguage')];
      for (const language of languages) {
        const trimmed = language.trim();
        if (!trimmed) continue;
        const languageKey = release.languages.length > 0 ? normalizeFilterKey(trimmed) : UNKNOWN_LANGUAGE_KEY;
        if (!options.has(languageKey)) options.set(languageKey, trimmed);
      }
    }

    return [...options.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [activeQuery.data?.releases, t]);

  const releases = useMemo(() => {
    return filterAndSortReleases(activeQuery.data?.releases ?? [], {
      filterQuery,
      hideRejected,
      includedTrackers,
      excludedTrackers,
      includedLanguages,
      sortBy,
      sortDir,
      isProwlarrMode,
    });
  }, [
    activeQuery.data?.releases,
    excludedTrackers,
    filterQuery,
    hideRejected,
    includedLanguages,
    includedTrackers,
    isProwlarrMode,
    sortBy,
    sortDir,
  ]);

  const downloadRelease = async (release: InteractiveReleaseItem) => {
    const releaseKey = `${release.guid}-${release.indexer_id ?? 'x'}`;
    setPendingReleaseKey(releaseKey);

    try {
      if (isProwlarrMode) {
        if (!release.download_token || prowlarrDownloadMutation.isPending) return;
        await prowlarrDownloadMutation.mutateAsync({
          token: release.download_token,
        });
      } else {
        if (!media || !sourceId || !release.indexer_id || arrDownloadMutation.isPending) return;
        await arrDownloadMutation.mutateAsync({
          service,
          source_id: sourceId,
          guid: release.guid,
          indexer_id: release.indexer_id,
        });
      }

      toast.success(t('medias.interactive.downloadStarted'));
      onDownloadSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('medias.interactive.downloadFailed');
      toast.error(message);
    } finally {
      setPendingReleaseKey(null);
    }
  };

  const totalReleases = activeQuery.data?.releases.length ?? 0;
  const hasAdvancedFilters = includedTrackers.length > 0 || excludedTrackers.length > 0 || includedLanguages.length > 0;
  const totalActiveFilters = includedTrackers.length + excludedTrackers.length + includedLanguages.length;
  const hasViewOverrides =
    (!isProwlarrMode && filterQuery.trim().length > 0) || totalActiveFilters > 0 || !hideRejected;
  const visibleCount = releases.length;
  const hiddenCount = Math.max(0, totalReleases - visibleCount);
  const errorMessage = activeQuery.error instanceof Error ? activeQuery.error.message : null;
  const needsProwlarrQuery = isProwlarrMode && debouncedProwlarrQuery.length < 2;
  const canRenderBody = isProwlarrMode || Boolean(media);

  const resetView = () => {
    setFilterQuery('');
    setHideRejected(false);
    setIncludedTrackers([]);
    setExcludedTrackers([]);
    setIncludedLanguages([]);
  };

  const handleIncludedTrackersChange = (values: string[]) => {
    setIncludedTrackers(values);
    setExcludedTrackers(previous => previous.filter(key => !values.includes(key)));
  };

  const handleExcludedTrackersChange = (values: string[]) => {
    setExcludedTrackers(values);
    setIncludedTrackers(previous => previous.filter(key => !values.includes(key)));
  };

  if (!canRenderBody) return null;

  return (
    <div className="flex flex-col overflow-hidden" style={{ maxHeight: 'calc(90dvh - 12rem)' }}>
      <div className="border-b border-neutral-200 pb-4 dark:border-neutral-700">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                ref={searchInputRef}
                value={isProwlarrMode ? prowlarrQuery : filterQuery}
                onChange={event =>
                  isProwlarrMode ? setProwlarrQuery(event.target.value) : setFilterQuery(event.target.value)
                }
                placeholder={
                  isProwlarrMode
                    ? t('medias.interactive.prowlarrSearchPlaceholder')
                    : t('medias.interactive.searchPlaceholder')
                }
                className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              {(isProwlarrMode ? prowlarrQuery : filterQuery) && (
                <button
                  type="button"
                  onClick={() => (isProwlarrMode ? setProwlarrQuery('') : setFilterQuery(''))}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                  aria-label={t('medias.interactive.clearSearch')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(value => !value)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  showFilters || hasAdvancedFilters
                    ? 'border-indigo-500/40 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800'
                }`}
              >
                {t('medias.interactive.filtersButton')}
                {totalActiveFilters > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">
                    {totalActiveFilters}
                  </span>
                )}
              </button>

              <Toggle
                checked={hideRejected}
                onChange={setHideRejected}
                label={t('medias.interactive.hideRejected')}
              />

              <button
                type="button"
                onClick={() => void activeQuery.refetch()}
                disabled={activeQuery.isFetching || needsProwlarrQuery}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <RefreshCw size={13} className={activeQuery.isFetching ? 'animate-spin' : ''} />
                {t('medias.interactive.refresh')}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              {!needsProwlarrQuery && (
                <span className="font-medium text-neutral-700 dark:text-neutral-200">
                  {t('medias.interactive.resultsVisible', { visible: visibleCount, total: totalReleases })}
                </span>
              )}
              {!needsProwlarrQuery && hiddenCount > 0 && (
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] dark:bg-neutral-800">
                  {t('medias.interactive.hiddenCount', { count: hiddenCount })}
                </span>
              )}
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] capitalize dark:bg-neutral-800">
                {isProwlarrMode ? 'prowlarr' : service}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasViewOverrides && (
                <button
                  type="button"
                  onClick={resetView}
                  className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                >
                  {t('medias.interactive.resetView')}
                </button>
              )}

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t('medias.interactive.sortLabel')}
                </label>
                <select
                  value={sortBy}
                  onChange={event => setSortBy(event.target.value as InteractiveSortKey)}
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="seeders">{t('medias.interactive.sortOptions.seeders')}</option>
                  <option value="age">{t('medias.interactive.sortOptions.age')}</option>
                  <option value="size">{t('medias.interactive.sortOptions.size')}</option>
                  <option value="title">{t('medias.interactive.sortOptions.title')}</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
                >
                  {sortDir === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
                </button>
              </div>
            </div>
          </div>

          {(showFilters || hasAdvancedFilters) && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-700/80 dark:bg-neutral-900/50">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                  {t('medias.interactive.filtersTitle')}
                  {totalActiveFilters > 0 && (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                      {totalActiveFilters}
                    </span>
                  )}
                </p>
                {hasAdvancedFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setIncludedTrackers([]);
                      setExcludedTrackers([]);
                      setIncludedLanguages([]);
                    }}
                    className="text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                  >
                    {t('medias.interactive.clearFilters')}
                  </button>
                )}
              </div>

              <div className="space-y-3 divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
                <FilterSection title={t('medias.interactive.trackersInclude')} badge={includedTrackers.length}>
                  <ChipMultiSelect
                    options={trackerOptions}
                    selected={includedTrackers}
                    onChange={handleIncludedTrackersChange}
                    emptyText={t('medias.interactive.noTrackers')}
                  />
                </FilterSection>

                <div className="pt-1.5">
                  <FilterSection title={t('medias.interactive.trackersExclude')} badge={excludedTrackers.length}>
                    <ChipMultiSelect
                      options={trackerOptions}
                      selected={excludedTrackers}
                      onChange={handleExcludedTrackersChange}
                      emptyText={t('medias.interactive.noTrackers')}
                    />
                  </FilterSection>
                </div>

                <div className="pt-1.5">
                  <FilterSection title={t('medias.interactive.languagesInclude')} badge={includedLanguages.length}>
                    <ChipMultiSelect
                      options={languageOptions}
                      selected={includedLanguages}
                      onChange={setIncludedLanguages}
                      emptyText={t('medias.interactive.noLanguages')}
                    />
                  </FilterSection>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-scroll overflow-x-hidden pt-4">
        {needsProwlarrQuery ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="max-w-md text-center text-sm text-neutral-500 dark:text-neutral-400">
              {t('medias.interactive.minQuery')}
            </div>
          </div>
        ) : activeQuery.isLoading ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.loading')}</div>
          </div>
        ) : activeQuery.isError ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-700/40 dark:bg-amber-950/20">
              <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <TriangleAlert size={18} />
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('medias.interactive.errorTitle')}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {errorMessage ?? t('medias.interactive.errorDescription')}
              </p>
              <button
                type="button"
                onClick={() => void activeQuery.refetch()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                <RefreshCw size={14} />
                {t('medias.interactive.retry')}
              </button>
            </div>
          </div>
        ) : releases.length === 0 ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {totalReleases > 0 ? t('medias.interactive.noMatches') : t('medias.interactive.empty')}
              </p>
              {totalReleases > 0 && (
                <button
                  type="button"
                  onClick={resetView}
                  className="mt-3 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                >
                  {t('medias.interactive.resetView')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="pr-1">
            <div className="space-y-2">
              {releases.map(release => {
                const releaseKey = `${release.guid}-${release.indexer_id ?? 'x'}`;
                return (
                  <ReleaseCard
                    key={releaseKey}
                    release={release}
                    onDownload={() => void downloadRelease(release)}
                    isDownloading={pendingReleaseKey === releaseKey}
                    isBusy={activeDownloadMutation.isPending}
                    t={t}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReleaseCard({
  release,
  onDownload,
  isDownloading,
  isBusy,
  t,
}: {
  release: InteractiveReleaseItem;
  onDownload: () => void;
  isDownloading: boolean;
  isBusy: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        release.rejected
          ? 'border-amber-200/60 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-950/20'
          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-700/80 dark:bg-neutral-900/60 dark:hover:bg-neutral-900'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-neutral-900 dark:text-white">
            {release.info_url ? (
              <a
                href={release.info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
              >
                {release.title}
              </a>
            ) : (
              release.title
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {release.indexer && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {release.indexer}
              </span>
            )}
            {release.protocol && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {release.protocol}
              </span>
            )}
            {release.size_bytes != null && (
              <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {formatBytes(release.size_bytes)}
              </span>
            )}
            {release.age != null && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {t('medias.interactive.age', { age: release.age })}
              </span>
            )}
            {(release.seeders != null || release.leechers != null) && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {t('medias.interactive.seedersLeechers', {
                  seeders: release.seeders ?? '-',
                  leechers: release.leechers ?? '-',
                })}
              </span>
            )}
            {release.languages.length > 0 && (
              <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                {release.languages.join(', ')}
              </span>
            )}
          </div>

          {release.rejected && release.rejection_reason && (
            <p className="mt-2 rounded-md bg-amber-100/60 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              {release.rejection_reason}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={isBusy || !release.indexer_id}
          style={{ touchAction: 'manipulation' }}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <Download size={11} strokeWidth={2.5} />
          {isDownloading ? t('medias.interactive.downloading') : t('medias.interactive.download')}
        </button>
      </div>
    </div>
  );
}
