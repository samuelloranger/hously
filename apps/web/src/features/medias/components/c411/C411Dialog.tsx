import { useState } from 'react';
import { Search, Grid3X3, FileText, FolderOpen, Loader2, RefreshCw, Plus } from 'lucide-react';
import { Dialog } from '@/components/dialog';
import { cn } from '@/lib/utils';
import { useC411FrenchTitle, useC411Search, useC411ReleaseStatus, useC411Releases, useC411Drafts, useC411PrepareRelease, useC411Sync } from '@hously/shared';
import type { MediaItem } from '@hously/shared';
import { C411SearchResults } from './C411SearchResults';
import { C411SlotGrid } from './C411SlotGrid';
import { C411ReleasesList } from './C411ReleasesList';
import { C411DraftsList } from './C411DraftsList';
import { C411ReleaseEditor } from './C411ReleaseEditor';

interface C411DialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
}

type TabKey = 'search' | 'slots' | 'releases' | 'drafts';

const TABS: { key: TabKey; icon: typeof Search; label: string }[] = [
  { key: 'search', icon: Search, label: 'Search' },
  { key: 'slots', icon: Grid3X3, label: 'Slots' },
  { key: 'releases', icon: FolderOpen, label: 'Releases' },
  { key: 'drafts', icon: FileText, label: 'Drafts' },
];

export function C411Dialog({ isOpen, onClose, media }: C411DialogProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('search');
  const [editingReleaseId, setEditingReleaseId] = useState<number | null>(null);

  const tmdbId = media?.tmdb_id ?? null;
  const year = media?.year ?? 0;
  const imdbId = (media as any)?.imdb_id ?? '';
  const mediaType = media?.media_type === 'series' ? 'tv' : 'movie';

  const frenchTitle = useC411FrenchTitle(tmdbId, mediaType, { enabled: isOpen && tmdbId !== null });
  const searchQuery = frenchTitle.data?.title ?? media?.title ?? '';

  const searchResult = useC411Search(searchQuery, { enabled: isOpen && activeTab === 'search' && searchQuery.length >= 2 });
  const releaseStatus = useC411ReleaseStatus(tmdbId, searchQuery, year, imdbId, { enabled: isOpen && activeTab === 'slots' && tmdbId !== null });
  const releases = useC411Releases();
  const drafts = useC411Drafts({ enabled: isOpen && activeTab === 'drafts' });
  const prepareRelease = useC411PrepareRelease();
  const sync = useC411Sync();

  const handlePrepareRelease = () => {
    if (!media?.source_id) return;
    prepareRelease.mutate(media.source_id, {
      onSuccess: () => releases.refetch(),
    });
  };

  const handleSync = () => {
    sync.mutate(undefined, {
      onSuccess: () => releases.refetch(),
    });
  };

  if (editingReleaseId !== null) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={() => { setEditingReleaseId(null); onClose(); }}
        title="Edit Release"
        panelClassName="max-w-5xl"
      >
        <C411ReleaseEditor
          releaseId={editingReleaseId}
          onBack={() => setEditingReleaseId(null)}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`C411 — ${media?.title ?? ''}`}
      panelClassName="max-w-5xl"
    >
      {/* Tab bar */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-150',
              activeTab === key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {activeTab === 'releases' && (
            <>
              <button
                onClick={handleSync}
                disabled={sync.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-150 disabled:opacity-50"
              >
                {sync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Sync
              </button>
              <button
                onClick={handlePrepareRelease}
                disabled={prepareRelease.isPending || !media?.source_id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 transition-all duration-150 disabled:opacity-50"
              >
                {prepareRelease.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Prepare Release
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'search' && (
          <C411SearchResults
            data={searchResult.data ?? null}
            isLoading={searchResult.isLoading}
            query={searchQuery}
          />
        )}
        {activeTab === 'slots' && (
          <C411SlotGrid
            data={releaseStatus.data ?? null}
            isLoading={releaseStatus.isLoading}
            enabled={tmdbId !== null}
          />
        )}
        {activeTab === 'releases' && (
          <C411ReleasesList
            data={releases.data ?? null}
            isLoading={releases.isLoading}
            tmdbId={tmdbId}
            onEdit={(id) => setEditingReleaseId(id)}
            prepareStatus={prepareRelease.isPending ? 'pending' : prepareRelease.isSuccess ? 'success' : null}
          />
        )}
        {activeTab === 'drafts' && (
          <C411DraftsList
            data={drafts.data ?? null}
            isLoading={drafts.isLoading}
          />
        )}
      </div>
    </Dialog>
  );
}
