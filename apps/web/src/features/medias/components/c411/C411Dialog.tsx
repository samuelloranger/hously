import { useState } from 'react';
import { Search, Grid3X3, FileText, FolderOpen, Loader2, RefreshCw, Plus, AudioLines } from 'lucide-react';
import { Dialog } from '@/components/dialog';
import { cn } from '@/lib/utils';
import { useC411FrenchTitle, useC411Search, useC411ReleaseStatus, useC411Releases, useC411Drafts, useC411PrepareRelease, useC411Sync, useC411MediaInfo } from '@hously/shared';
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

type TabKey = 'search' | 'slots' | 'info' | 'releases' | 'drafts';

const TABS: { key: TabKey; icon: typeof Search; label: string }[] = [
  { key: 'search', icon: Search, label: 'Search' },
  { key: 'slots', icon: Grid3X3, label: 'Slots' },
  { key: 'info', icon: AudioLines, label: 'Media Info' },
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
  const mediaInfo = useC411MediaInfo(media?.source_id ?? null, { enabled: isOpen && activeTab === 'info' });
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
        {activeTab === 'info' && (
          <C411MediaInfoPanel data={mediaInfo.data} isLoading={mediaInfo.isLoading} />
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

function C411MediaInfoPanel({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data?.media_info) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <AudioLines className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No media info</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Could not read media file</p>
      </div>
    );
  }

  const mi = data.media_info;

  return (
    <div className="space-y-4">
      {/* Detection summary */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-lg border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          {data.language_tag}
        </span>
        {mi.resolution && <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{mi.resolution}</span>}
        {mi.source && mi.source !== 'N/A' && <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{mi.source}</span>}
        {mi.video_codec && <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{mi.video_codec}</span>}
        {mi.container && <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{mi.container}</span>}
        {mi.duration && mi.duration !== 'N/A' && <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{mi.duration}</span>}
        {data.release_group && <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">-{data.release_group}</span>}
      </div>

      {data.scene_name && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono truncate">{data.scene_name}</p>
      )}

      {/* Audio tracks */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
          Audio ({mi.audio_streams.length})
        </p>
        <div className="space-y-1.5">
          {mi.audio_streams.map((a: any, i: number) => (
            <div key={i} className="rounded-lg border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 px-3 py-2 flex items-center gap-3">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white w-5">#{i + 1}</span>
              <span className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold',
                /^(fre|fra|fr)$/i.test(a.language) ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' :
                /^(eng|en)$/i.test(a.language) ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' :
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
              )}>
                {a.language || 'und'}
              </span>
              {a.title && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{a.title}</span>}
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">{a.codec} · {a.channels} · {a.bitrate || 'N/A'}</span>
            </div>
          ))}
          {mi.audio_streams.length === 0 && (
            <p className="text-xs text-neutral-400">No audio tracks found</p>
          )}
        </div>
      </div>

      {/* Subtitle tracks */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
          Subtitles ({mi.subtitles.length})
        </p>
        <div className="space-y-1.5">
          {mi.subtitles.map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 px-3 py-1.5 flex items-center gap-3">
              <span className="text-xs font-semibold text-neutral-900 dark:text-white w-5">#{i + 1}</span>
              <span className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold',
                /^(fre|fra|fr)$/i.test(s.language) ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' :
                /^(eng|en)$/i.test(s.language) ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' :
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
              )}>
                {s.language || 'und'}
              </span>
              {s.title && <span className="text-[11px] text-neutral-500 dark:text-neutral-400">{s.title}</span>}
              {s.forced && <span className="inline-flex items-center rounded-md bg-amber-100/60 dark:bg-amber-900/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">forced</span>}
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">{s.format}</span>
            </div>
          ))}
          {mi.subtitles.length === 0 && (
            <p className="text-xs text-neutral-400">No subtitle tracks found</p>
          )}
        </div>
      </div>
    </div>
  );
}
