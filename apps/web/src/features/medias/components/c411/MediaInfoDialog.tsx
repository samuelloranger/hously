import { useEffect, useState } from 'react';
import { Grid3X3, FileText, FolderOpen, Loader2, RefreshCw, Plus, AudioLines } from 'lucide-react';
import { Dialog } from '@/components/dialog';
import { cn } from '@/lib/utils';
import {
  useC411Releases,
  useC411Drafts,
  useC411PrepareRelease,
  useC411Sync,
  useC411MediaInfo,
  useC411ReleasePrepareStream,
} from '@hously/shared';
import type { MediaItem } from '@hously/shared';
import { C411ReleasesList } from './C411ReleasesList';
import { C411DraftsList } from './C411DraftsList';
import { C411ReleaseEditor } from './C411ReleaseEditor';
import { MediaInfoPanel } from './MediaInfoPanel';
import { MediaInfoHistoryActionsPanel } from './MediaInfoHistoryActionsPanel';

interface MediaInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  media: MediaItem | null;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  editingReleaseId: number | null;
  onEditingReleaseChange: (id: number | null) => void;
}

export type TabKey = 'info' | 'history' | 'releases' | 'drafts';

const TABS: { key: TabKey; icon: typeof AudioLines; label: string }[] = [
  { key: 'info', icon: AudioLines, label: 'Media Info' },
  { key: 'history', icon: Grid3X3, label: 'History / Actions' },
  { key: 'releases', icon: FolderOpen, label: 'Releases' },
  { key: 'drafts', icon: FileText, label: 'Drafts' },
];

export function MediaInfoDialog({
  isOpen,
  onClose,
  onDelete,
  media,
  activeTab,
  onTabChange,
  editingReleaseId,
  onEditingReleaseChange,
}: MediaInfoDialogProps) {
  const tmdbId = media?.tmdb_id ?? null;
  const isSeries = media?.media_type === 'series';
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  useEffect(() => {
    if (!isSeries) {
      setSelectedSeason(null);
      return;
    }

    const seasonCount = media?.season_count ?? 0;
    setSelectedSeason(seasonCount > 0 ? 1 : null);
  }, [isSeries, media?.id, media?.season_count]);

  const mediaInfo = useC411MediaInfo(
    {
      service: media?.service === 'sonarr' ? 'sonarr' : 'radarr',
      sourceId: media?.source_id ?? null,
      seasonNumber: isSeries ? selectedSeason : null,
    },
    { enabled: isOpen && (activeTab === 'info' || activeTab === 'history') }
  );
  const releases = useC411Releases();
  const drafts = useC411Drafts({ enabled: isOpen && activeTab === 'drafts' });
  const prepareRelease = useC411PrepareRelease();
  const sync = useC411Sync();

  // SSE stream: auto-refresh releases when a prepare finishes
  const hasPreparing = (releases.data?.releases ?? []).some(r => r.status === 'preparing');
  useC411ReleasePrepareStream({ enabled: isOpen && hasPreparing });

  const handlePrepareRelease = () => {
    if (!media?.source_id) return;
    if (isSeries && selectedSeason == null) return;

    prepareRelease.mutate({
      service: media.service,
      sourceId: media.source_id,
      seasonNumber: isSeries ? selectedSeason : null,
    });
  };

  const handleSync = () => {
    sync.mutate();
  };

  if (editingReleaseId !== null) {
    return (
      <Dialog
        isOpen={isOpen}
        onClose={() => {
          onEditingReleaseChange(null);
          onClose();
        }}
        title="Edit Release"
        panelClassName="max-w-5xl"
      >
        <C411ReleaseEditor releaseId={editingReleaseId} onBack={() => onEditingReleaseChange(null)} />
      </Dialog>
    );
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Media Info — ${media?.title ?? ''}`} panelClassName="max-w-5xl">
      {/* Tab bar */}
      <div className="mb-4 space-y-3">
        <div className="border-b border-neutral-200/80 dark:border-neutral-700/60">
          <nav className="flex gap-0.5 -mb-px overflow-x-auto overflow-y-hidden scrollbar-none">
            {TABS.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150',
                  activeTab === key
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {activeTab === key && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {isSeries && (media?.season_count ?? 0) > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Season
            </span>
            <select
              value={selectedSeason ?? ''}
              onChange={event => setSelectedSeason(event.target.value ? Number(event.target.value) : null)}
              className="h-8 rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-xs text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              {Array.from({ length: media?.season_count ?? 0 }, (_, index) => index + 1).map(seasonNumber => (
                <option key={seasonNumber} value={seasonNumber}>
                  Season {seasonNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'releases' && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleSync}
              disabled={sync.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-150 disabled:opacity-50"
            >
              {sync.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync
            </button>
            <button
              onClick={handlePrepareRelease}
              disabled={prepareRelease.isPending || !media?.source_id || (isSeries && selectedSeason == null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 transition-all duration-150 disabled:opacity-50"
            >
              {prepareRelease.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Prepare Release
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === 'info' && <MediaInfoPanel data={mediaInfo.data} isLoading={mediaInfo.isLoading} />}
        {activeTab === 'history' && (
          <MediaInfoHistoryActionsPanel
            service={media?.service === 'sonarr' ? 'sonarr' : 'radarr'}
            sourceId={media?.source_id ?? null}
            seasonNumber={isSeries ? selectedSeason : null}
            onDelete={onDelete}
          />
        )}
        {activeTab === 'releases' && (
          <C411ReleasesList
            releases={(releases.data?.releases ?? []).filter(release => {
              if (release.tmdb_id !== tmdbId) return false;
              if (!isSeries || selectedSeason == null) return true;
              return Number(release.metadata?.seasonNumber ?? -1) === selectedSeason;
            })}
            isLoading={releases.isLoading}
            onEdit={id => onEditingReleaseChange(id)}
            prepareStatus={prepareRelease.isPending ? 'pending' : prepareRelease.isSuccess ? 'success' : null}
            emptyMessage={
              isSeries
                ? 'No releases for this season. Use "Prepare Release" to create one.'
                : 'No releases for this movie. Use "Prepare Release" to create one.'
            }
          />
        )}
        {activeTab === 'drafts' && <C411DraftsList data={drafts.data ?? null} isLoading={drafts.isLoading} />}
      </div>
    </Dialog>
  );
}
