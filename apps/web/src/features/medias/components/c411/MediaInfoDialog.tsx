import { useMemo } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Dialog } from '@/components/dialog';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@hously/shared';
import { InteractiveSearchPanel } from '../InteractiveSearchPanel';
import { SimilarMediasPanel } from '../SimilarMediasPanel';

export type TabKey = 'search' | 'similar';

interface TabDef {
  key: TabKey;
  icon: typeof Search;
  label: string;
}

interface MediaInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onRefetchLibrary: () => void;
}

export function MediaInfoDialog({
  isOpen,
  onClose,
  media,
  activeTab,
  onTabChange,
  onRefetchLibrary,
}: MediaInfoDialogProps) {
  const tmdbId = media?.tmdb_id ?? null;
  const tabs = useMemo<TabDef[]>(() => {
    if (!media) return [];
    const result: TabDef[] = [];

    result.push({ key: 'search', icon: Search, label: 'Search' });

    if (tmdbId !== null) {
      result.push({ key: 'similar', icon: Sparkles, label: 'Similar' });
    }

    return result;
  }, [media, tmdbId]);

  const validTab = useMemo(() => {
    if (tabs.some(t => t.key === activeTab)) return activeTab;
    return tabs[0]?.key ?? 'search';
  }, [tabs, activeTab]);

  return (
    <>
      <Dialog isOpen={isOpen} onClose={onClose} title={media?.title ?? ''} panelClassName="max-w-5xl">
        {/* Tab bar */}
        <div className="mb-4 space-y-3">
          <div className="border-b border-neutral-200/80 dark:border-neutral-700/60">
            <nav className="flex gap-0.5 -mb-px overflow-x-auto overflow-y-hidden scrollbar-none">
              {tabs.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => onTabChange(key)}
                  className={cn(
                    'relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150',
                    validTab === key
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {validTab === key && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab content */}
        <div className="min-h-[300px]">
          {validTab === 'search' && <InteractiveSearchPanel isActive={isOpen && validTab === 'search'} media={media} />}
          {validTab === 'similar' && (
            <SimilarMediasPanel
              isActive={isOpen && validTab === 'similar'}
              tmdbId={tmdbId}
              mediaType={media ? (media.media_type === 'movie' ? 'movie' : 'tv') : null}
              onAdded={onRefetchLibrary}
            />
          )}
        </div>
      </Dialog>
    </>
  );
}
