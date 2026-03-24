import { useEffect, useMemo, useState } from 'react';
import {
  Grid3X3,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Plus,
  AudioLines,
  Search,
  Sparkles,
} from 'lucide-react';
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
import { InteractiveSearchPanel } from '../InteractiveSearchPanel';
import { ConvertMediaPanel } from '../ConvertMediaPanel';
import { SimilarMediasPanel } from '../SimilarMediasPanel';
import { DeleteMediaDialog } from '../DeleteMediaDialog';

export type TabKey = 'search' | 'info' | 'history' | 'convert' | 'similar' | 'releases' | 'drafts';

interface TabDef {
  key: TabKey;
  icon: typeof AudioLines;
  label: string;
}

interface MediaInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
  c411Enabled: boolean;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  editingReleaseId: number | null;
  onEditingReleaseChange: (id: number | null) => void;
  onRefetchLibrary: () => void;
}

const WIDE_TABS: TabKey[] = ['search', 'releases', 'drafts'];

export function MediaInfoDialog({
  isOpen,
  onClose,
  media,
  c411Enabled,
  activeTab,
  onTabChange,
  editingReleaseId,
  onEditingReleaseChange,
  onRefetchLibrary,
}: MediaInfoDialogProps) {
  const tmdbId = media?.tmdb_id ?? null;
  const isSeries = media?.media_type === 'series';
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!isSeries) {
      setSelectedSeason(null);
      return;
    }

    const seasonCount = media?.season_count ?? 0;
    setSelectedSeason(seasonCount > 0 ? 1 : null);
  }, [isSeries, media?.id, media?.season_count]);

  // Build tabs based on media state
  const tabs = useMemo<TabDef[]>(() => {
    if (!media) return [];
    const result: TabDef[] = [];

    result.push({ key: 'search', icon: Search, label: 'Search' });

    if (media.downloaded) {
      result.push({ key: 'info', icon: AudioLines, label: 'Media Info' });
    }

    result.push({ key: 'history', icon: Grid3X3, label: 'History' });

    if (media.service === 'radarr' && media.media_type === 'movie' && media.downloaded) {
      result.push({ key: 'convert', icon: RefreshCw, label: 'Convert' });
    }

    if (tmdbId !== null) {
      result.push({ key: 'similar', icon: Sparkles, label: 'Similar' });
    }

    if (c411Enabled) {
      result.push({ key: 'releases', icon: FolderOpen, label: 'Releases' });
      result.push({ key: 'drafts', icon: FileText, label: 'Drafts' });
    }

    return result;
  }, [media, tmdbId, c411Enabled]);

  // Ensure activeTab is valid for current tabs
  const validTab = useMemo(() => {
    if (tabs.some(t => t.key === activeTab)) return activeTab;
    return tabs[0]?.key ?? 'search';
  }, [tabs, activeTab]);

  const isWide = WIDE_TABS.includes(validTab);

  const mediaInfo = useC411MediaInfo(
    {
      service: media?.service === 'sonarr' ? 'sonarr' : 'radarr',
      sourceId: media?.source_id ?? null,
      seasonNumber: isSeries ? selectedSeason : null,
    },
    { enabled: isOpen && (validTab === 'info' || validTab === 'history') }
  );
  const releases = useC411Releases();
  const drafts = useC411Drafts({ enabled: isOpen && validTab === 'drafts' });
  const prepareRelease = useC411PrepareRelease();
  const sync = useC411Sync();

  // SSE stream: auto-refresh releases when a prepare finishes
  const hasPreparing = (releases.data?.releases ?? []).some(r => r.status === 'preparing');
  useC411ReleasePrepareStream({ enabled: isOpen && hasPreparing });

  const handlePrepareRelease = () => {
    if (!media?.source_id) return;

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
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={media?.title ?? ''}
        panelClassName={cn(
          'transition-[max-width] duration-300 ease-in-out',
          isWide ? 'max-w-5xl' : 'max-w-3xl'
        )}
      >
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
                <option value="">Intégral</option>
                {Array.from({ length: media?.season_count ?? 0 }, (_, index) => index + 1).map(seasonNumber => (
                  <option key={seasonNumber} value={seasonNumber}>
                    Season {seasonNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {validTab === 'releases' && (
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
                disabled={prepareRelease.isPending || !media?.source_id}
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
          {validTab === 'search' && (
            <InteractiveSearchPanel isActive={isOpen && validTab === 'search'} media={media} />
          )}
          {validTab === 'info' && <MediaInfoPanel data={mediaInfo.data} isLoading={mediaInfo.isLoading} />}
          {validTab === 'history' && (
            <MediaInfoHistoryActionsPanel
              service={media?.service === 'sonarr' ? 'sonarr' : 'radarr'}
              sourceId={media?.source_id ?? null}
              seasonNumber={isSeries ? selectedSeason : null}
              onDelete={() => setShowDeleteDialog(true)}
            />
          )}
          {validTab === 'convert' && (
            <ConvertMediaPanel isActive={isOpen && validTab === 'convert'} media={media} />
          )}
          {validTab === 'similar' && (
            <SimilarMediasPanel
              isActive={isOpen && validTab === 'similar'}
              tmdbId={tmdbId}
              mediaType={media ? (media.media_type === 'movie' ? 'movie' : 'tv') : null}
              onAdded={onRefetchLibrary}
            />
          )}
          {validTab === 'releases' && (
            <C411ReleasesList
              releases={(releases.data?.releases ?? []).filter(release => {
                if (release.tmdb_id !== tmdbId) return false;
                if (!isSeries) return true;
                if (selectedSeason == null) return release.metadata?.seasonNumber == null;
                return Number(release.metadata?.seasonNumber ?? -1) === selectedSeason;
              })}
              isLoading={releases.isLoading}
              onEdit={id => onEditingReleaseChange(id)}
              prepareStatus={prepareRelease.isPending ? 'pending' : prepareRelease.isSuccess ? 'success' : null}
              emptyMessage={
                !isSeries
                  ? 'No releases for this movie. Use "Prepare Release" to create one.'
                  : selectedSeason == null
                    ? 'No integral release for this series. Use "Prepare Release" to create one.'
                    : 'No releases for this season. Use "Prepare Release" to create one.'
              }
            />
          )}
          {validTab === 'drafts' && <C411DraftsList data={drafts.data ?? null} isLoading={drafts.isLoading} />}
        </div>
      </Dialog>

      <DeleteMediaDialog
        isOpen={showDeleteDialog}
        media={media}
        onClose={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
