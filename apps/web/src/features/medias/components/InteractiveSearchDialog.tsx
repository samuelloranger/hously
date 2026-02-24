import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Download, X } from 'lucide-react';
import { Dialog } from '../../../components/dialog';
import {
  useMediaInteractiveDownload,
  useMediaInteractiveSearch,
  type InteractiveReleaseItem,
  type MediaItem,
} from '@hously/shared';

interface InteractiveSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
}

type InteractiveSortKey = 'seeders' | 'age' | 'size' | 'title';
type InteractiveSortDir = 'asc' | 'desc';
type FilterOption = { key: string; label: string };

const UNKNOWN_TRACKER_KEY = '__unknown_tracker__';
const UNKNOWN_LANGUAGE_KEY = '__unknown_language__';

const normalizeFilterKey = (value: string): string => value.trim().toLocaleLowerCase();

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label
      className="inline-flex items-center gap-2 cursor-pointer select-none"
      style={{ touchAction: 'manipulation' }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          checked ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
    </label>
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
    return <span className="text-[11px] text-neutral-400 dark:text-neutral-500 italic">{emptyText}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
      {options.map(option => {
        const active = selected.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => toggle(option.key)}
            style={{ touchAction: 'manipulation' }}
            className={`appearance-none inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 ${
              active
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
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
        className="flex items-center justify-between w-full py-1 group"
        style={{ touchAction: 'manipulation' }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {title}
          {badge != null && badge > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
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

export function InteractiveSearchDialog({ isOpen, onClose, media }: InteractiveSearchDialogProps) {
  const { t } = useTranslation('common');
  const sourceId = media?.source_id ?? null;
  const service = media?.service ?? 'radarr';
  const [hideRejected, setHideRejected] = useState(true);
  const [sortBy, setSortBy] = useState<InteractiveSortKey>('seeders');
  const [sortDir, setSortDir] = useState<InteractiveSortDir>('desc');
  const [includedTrackers, setIncludedTrackers] = useState<string[]>([]);
  const [excludedTrackers, setExcludedTrackers] = useState<string[]>([]);
  const [includedLanguages, setIncludedLanguages] = useState<string[]>([]);

  const releasesQuery = useMediaInteractiveSearch(
    { service, source_id: sourceId },
    {
      enabled: isOpen && Boolean(media),
    }
  );
  const downloadMutation = useMediaInteractiveDownload();

  useEffect(() => {
    setIncludedTrackers([]);
    setExcludedTrackers([]);
    setIncludedLanguages([]);
  }, [media?.id]);

  const trackerOptions = useMemo<FilterOption[]>(() => {
    const options = new Map<string, string>();

    for (const release of releasesQuery.data?.releases ?? []) {
      const trackerLabel = release.indexer?.trim() || t('medias.interactive.unknownIndexer');
      const trackerKey = release.indexer?.trim() ? normalizeFilterKey(release.indexer) : UNKNOWN_TRACKER_KEY;
      if (!options.has(trackerKey)) options.set(trackerKey, trackerLabel);
    }

    return [...options.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [releasesQuery.data?.releases, t]);

  const languageOptions = useMemo<FilterOption[]>(() => {
    const options = new Map<string, string>();

    for (const release of releasesQuery.data?.releases ?? []) {
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
  }, [releasesQuery.data?.releases, t]);

  const releases = useMemo(() => {
    const raw = releasesQuery.data?.releases ?? [];
    const includeTrackers = new Set(includedTrackers);
    const excludeTrackers = new Set(excludedTrackers);
    const includeLanguages = new Set(includedLanguages);

    const filtered = raw.filter(release => {
      if (hideRejected && release.rejected) return false;

      const trackerKey = release.indexer?.trim() ? normalizeFilterKey(release.indexer) : UNKNOWN_TRACKER_KEY;
      if (includeTrackers.size > 0 && !includeTrackers.has(trackerKey)) return false;
      if (excludeTrackers.has(trackerKey)) return false;

      if (includeLanguages.size > 0) {
        const releaseLanguageKeys =
          release.languages.length > 0
            ? release.languages.map(language => normalizeFilterKey(language))
            : [UNKNOWN_LANGUAGE_KEY];

        if (!releaseLanguageKeys.some(languageKey => includeLanguages.has(languageKey))) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'seeders') cmp = (a.seeders ?? -1) - (b.seeders ?? -1);
      else if (sortBy === 'age') cmp = (a.age ?? Number.MAX_SAFE_INTEGER) - (b.age ?? Number.MAX_SAFE_INTEGER);
      else if (sortBy === 'size') cmp = (a.size_bytes ?? -1) - (b.size_bytes ?? -1);
      else cmp = a.title.localeCompare(b.title);

      if (cmp === 0) return a.title.localeCompare(b.title);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [
    releasesQuery.data?.releases,
    hideRejected,
    includedTrackers,
    excludedTrackers,
    includedLanguages,
    sortBy,
    sortDir,
  ]);

  const downloadRelease = async (release: InteractiveReleaseItem) => {
    if (!media || !sourceId || !release.indexer_id || downloadMutation.isPending) return;

    try {
      await downloadMutation.mutateAsync({
        service,
        source_id: sourceId,
        guid: release.guid,
        indexer_id: release.indexer_id,
      });
      toast.success(t('medias.interactive.downloadStarted'));
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('medias.interactive.downloadFailed');
      toast.error(message);
    }
  };

  const hasAdvancedFilters = includedTrackers.length > 0 || excludedTrackers.length > 0 || includedLanguages.length > 0;
  const totalActiveFilters = includedTrackers.length + excludedTrackers.length + includedLanguages.length;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('medias.interactive.title', {
        title: media?.title ?? '',
      })}
    >
      {!media ? null : (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex flex-wrap items-center gap-3">
            <Toggle checked={hideRejected} onChange={setHideRejected} label={t('medias.interactive.hideRejected')} />

            <div className="flex items-center gap-1.5 ml-auto">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('medias.interactive.sortLabel')}
              </label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as InteractiveSortKey)}
                className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="seeders">{t('medias.interactive.sortOptions.seeders')}</option>
                <option value="age">{t('medias.interactive.sortOptions.age')}</option>
                <option value="size">{t('medias.interactive.sortOptions.size')}</option>
                <option value="title">{t('medias.interactive.sortOptions.title')}</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
              >
                {sortDir === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-900/50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5">
                {t('medias.interactive.filtersTitle')}
                {totalActiveFilters > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
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
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 font-medium transition-colors"
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
                  onChange={setIncludedTrackers}
                  emptyText={t('medias.interactive.noTrackers')}
                />
              </FilterSection>

              <div className="pt-3">
                <FilterSection title={t('medias.interactive.trackersExclude')} badge={excludedTrackers.length}>
                  <ChipMultiSelect
                    options={trackerOptions}
                    selected={excludedTrackers}
                    onChange={setExcludedTrackers}
                    emptyText={t('medias.interactive.noTrackers')}
                  />
                </FilterSection>
              </div>

              <div className="pt-3">
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

          {/* Results */}
          {releasesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.loading')}</div>
            </div>
          ) : releases.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.interactive.empty')}</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[55dvh] overflow-y-auto pr-0.5">
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mb-2">
                {releases.length} {releases.length === 1 ? 'release' : 'releases'}
              </p>
              {releases.map(release => (
                <ReleaseCard
                  key={`${release.guid}-${release.indexer_id ?? 'x'}`}
                  release={release}
                  onDownload={() => void downloadRelease(release)}
                  isDownloading={downloadMutation.isPending}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function ReleaseCard({
  release,
  onDownload,
  isDownloading,
  t,
}: {
  release: InteractiveReleaseItem;
  onDownload: () => void;
  isDownloading: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const formatBytes = (bytes: number | null): string => {
    if (!bytes || bytes <= 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** power;
    return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
  };

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        release.rejected
          ? 'border-amber-200/60 dark:border-amber-700/30 bg-amber-50/50 dark:bg-amber-950/20'
          : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-2 leading-snug">
            {release.info_url ? (
              <a
                href={release.info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors"
              >
                {release.title}
              </a>
            ) : (
              release.title
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {release.indexer && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                {release.indexer}
              </span>
            )}
            {release.protocol && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                {release.protocol}
              </span>
            )}
            {release.size_bytes != null && (
              <span className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                {formatBytes(release.size_bytes)}
              </span>
            )}
            {release.age != null && (
              <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                {t('medias.interactive.age', { age: release.age })}
              </span>
            )}
            {(release.seeders != null || release.leechers != null) && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                {t('medias.interactive.seedersLeechers', {
                  seeders: release.seeders ?? '-',
                  leechers: release.leechers ?? '-',
                })}
              </span>
            )}
            {release.languages.length > 0 && (
              <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                {release.languages.join(', ')}
              </span>
            )}
          </div>

          {release.rejected && release.rejection_reason && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/20 rounded-md px-2 py-1">
              {release.rejection_reason}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading || !release.indexer_id}
          style={{ touchAction: 'manipulation' }}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-[11px] font-semibold text-white transition-colors shadow-sm"
        >
          <Download size={11} strokeWidth={2.5} />
          {isDownloading ? t('medias.interactive.downloading') : t('medias.interactive.download')}
        </button>
      </div>
    </div>
  );
}
