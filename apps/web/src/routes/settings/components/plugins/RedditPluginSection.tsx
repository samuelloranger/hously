import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRedditPlugin, useUpdateRedditPlugin, useSearchSubreddits } from '@hously/shared';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { PluginSectionCard } from './PluginSectionCard';

export function RedditPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useRedditPlugin();
  const saveMutation = useUpdateRedditPlugin();

  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchData } = useSearchSubreddits(debouncedQuery);

  useEffect(() => {
    if (!data?.plugin) return;
    setSubreddits(data.plugin.subreddits || ['selfhosted', 'homelab']);
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    const initial = data.plugin.subreddits || ['selfhosted', 'homelab'];
    return (
      enabled !== Boolean(data.plugin.enabled) ||
      subreddits.length !== initial.length ||
      subreddits.some((s, i) => s !== initial[i])
    );
  }, [data, subreddits, enabled]);

  const handleCancel = () => {
    setSubreddits(data?.plugin.subreddits || ['selfhosted', 'homelab']);
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ subreddits, enabled })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  const addSubreddit = (name: string) => {
    const clean = name.replace(/^r\//, '').trim();
    if (!clean || subreddits.includes(clean)) return;
    setSubreddits((prev) => [...prev, clean]);
    setSearchInput('');
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeSubreddit = (name: string) => {
    setSubreddits((prev) => prev.filter((s) => s !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const results = searchData?.results;
      if (results && results.length > 0) {
        addSubreddit(results[0].name);
      } else if (searchInput.trim()) {
        addSubreddit(searchInput);
      }
    }
  };

  const searchResults = searchData?.results?.filter(
    (r) => !subreddits.includes(r.name)
  ) ?? [];

  const formatSubscribers = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <PluginSectionCard
      title="Reddit"
      description={t('settings.plugins.reddit.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.reddit.subreddits')}
        </label>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {subreddits.map((sub) => (
            <span
              key={sub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 text-sm font-medium"
            >
              r/{sub}
              <button
                type="button"
                onClick={() => removeSubreddit(sub)}
                className="p-0.5 rounded-full hover:bg-orange-200 dark:hover:bg-orange-800/60 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Search input + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.plugins.reddit.searchPlaceholder')}
            className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder:text-neutral-400"
          />

          {showDropdown && searchInput.length >= 2 && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg overflow-hidden">
              {searchResults.map((result) => (
                <button
                  key={result.name}
                  type="button"
                  onClick={() => addSubreddit(result.name)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
                >
                  {result.icon ? (
                    <img
                      src={result.icon}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-neutral-200 dark:bg-neutral-600"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-300">r/</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                      r/{result.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {result.title} &middot; {formatSubscribers(result.subscribers)} members
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && debouncedQuery.length >= 2 && searchResults.length === 0 && searchData && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg p-4 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t('settings.plugins.reddit.noResults')}
              </p>
            </div>
          )}
        </div>
      </div>
    </PluginSectionCard>
  );
}
