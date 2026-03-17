import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Loader2, Upload, Eye, Code, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useC411Release,
  useC411UpdateRelease,
  useC411CreateDraft,
  useC411PublishRelease,
  useC411RefreshRelease,
  useC411Categories,
  useC411CategoryOptions,
  bbcodeToHtml,
  arrayBufferToBase64,
} from '@hously/shared';
import type { C411DraftPayload } from '@hously/shared';

interface Props {
  releaseId: number;
  onBack: () => void;
}

export function C411ReleaseEditor({ releaseId, onBack }: Props) {
  const { data: release, isLoading } = useC411Release(releaseId);
  const updateRelease = useC411UpdateRelease();
  const createDraft = useC411CreateDraft();
  const publishRelease = useC411PublishRelease();
  const refreshRelease = useC411RefreshRelease();
  const categories = useC411Categories();
  useC411CategoryOptions(release?.category_id ?? null, {
    enabled: release?.category_id != null,
  });

  const [bbcode, setBbcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const isPreparing = release?.status === 'preparing';
  const canPublishArtifacts = Boolean(release?.torrent_s3_key) && !isPreparing;

  const previewHtml = useMemo(() => showPreview ? bbcodeToHtml(bbcode) : '', [bbcode, showPreview]);

  useEffect(() => {
    if (release) {
      setBbcode(release.bbcode ?? '');
      setName(release.name ?? '');
      setCategoryId(release.category_id);
      setSubcategoryId(release.subcategory_id);
    }
  }, [release]);

  const handleSave = () => {
    updateRelease.mutate({
      id: releaseId,
      payload: { name, bbcode, category_id: categoryId, subcategory_id: subcategoryId },
    });
  };

  const handleCreateDraft = async () => {
    if (!release) return;

    const payload: C411DraftPayload = {
      name,
      title: name,
      description: bbcode,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
      options: release.options as any,
      tmdbData: release.tmdb_data as any,
    };

    // If we have torrent and nfo, include them
    if (release.torrent_s3_key) {
      payload.torrentFileName = `${name}.torrent`;
      try {
        const res = await fetch(`/api/medias/c411/releases/${releaseId}/torrent`);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          payload.torrentFileData = arrayBufferToBase64(buf);
        }
      } catch { /* skip torrent */ }
    }

    if (release.nfo_content) {
      payload.nfoFileName = `${name}.nfo`;
      payload.nfoFileData = btoa(release.nfo_content);
    }

    createDraft.mutate(payload);
  };

  const handleRefresh = () => {
    if (!confirm('Refresh this release? This will regenerate the torrent, BBCode, and all metadata.')) return;
    refreshRelease.mutate(releaseId);
  };

  const handlePublish = () => {
    if (!release) return;
    if (!confirm(`Publish "${name}" directly on C411?`)) return;
    // Save first, then publish
    updateRelease.mutate(
      { id: releaseId, payload: { name, bbcode, category_id: categoryId, subcategory_id: subcategoryId } },
      { onSuccess: () => publishRelease.mutate(releaseId) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!release) {
    return <p className="text-sm text-neutral-500">Release not found</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshRelease.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-150 disabled:opacity-50"
          >
            {refreshRelease.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
          <button
            onClick={handleCreateDraft}
            disabled={createDraft.isPending || !canPublishArtifacts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-150 disabled:opacity-50"
          >
            {createDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={publishRelease.isPending || updateRelease.isPending || !canPublishArtifacts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 transition-all duration-150 disabled:opacity-50"
          >
            {publishRelease.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Publish
          </button>
          <button
            onClick={handleSave}
            disabled={updateRelease.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 transition-all duration-150 disabled:opacity-50"
          >
            {updateRelease.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </div>

      {publishRelease.isSuccess && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Published on C411! Torrent added to qBittorrent.
        </div>
      )}
      {publishRelease.isError && (
        <div className="rounded-xl border border-red-200/60 dark:border-red-800/30 bg-red-50/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-300">
          {(publishRelease.error as any)?.data?.message ?? (publishRelease.error as Error)?.message ?? 'Publish failed'}
        </div>
      )}
      {isPreparing && (
        <div className="rounded-xl border border-sky-200/60 dark:border-sky-800/30 bg-sky-50/30 dark:bg-sky-950/10 p-3 text-xs text-sky-700 dark:text-sky-300">
          Torrent preparation is still running in the background. Draft creation and publishing will be available when it finishes.
        </div>
      )}
      {release.metadata?.prepareError && (
        <div className="rounded-xl border border-red-200/60 dark:border-red-800/30 bg-red-50/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-300">
          {String(release.metadata.prepareError)}
        </div>
      )}
      {createDraft.isSuccess && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Draft created on C411!
        </div>
      )}
      {createDraft.isError && (
        <div className="rounded-xl border border-red-200/60 dark:border-red-800/30 bg-red-50/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-300">
          Failed to create draft: {(createDraft.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}
      {refreshRelease.isSuccess && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Release refreshed! Torrent, BBCode, and metadata have been regenerated.
        </div>
      )}
      {refreshRelease.isError && (
        <div className="rounded-xl border border-red-200/60 dark:border-red-800/30 bg-red-50/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-300">
          Failed to refresh: {(refreshRelease.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}
      {updateRelease.isSuccess && !publishRelease.isPending && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Release saved!
        </div>
      )}
      {updateRelease.isError && (
        <div className="rounded-xl border border-red-200/60 dark:border-red-800/30 bg-red-50/30 dark:bg-red-950/10 p-3 text-xs text-red-700 dark:text-red-300">
          Failed to save: {(updateRelease.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Name */}
      <div>
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Release Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs"
        />
      </div>

      {/* Category / Subcategory */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Category</label>
          <select
            value={categoryId ?? ''}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">—</option>
            {(categories.data ?? []).map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">Subcategory</label>
          <select
            value={subcategoryId ?? ''}
            onChange={(e) => setSubcategoryId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">—</option>
            {(categories.data ?? [])
              .find((c) => c.id === categoryId)
              ?.subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* BBCode editor / preview */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            BBCode Presentation
            <span className="ml-2 text-[10px] text-neutral-400 font-normal">{bbcode.length} chars</span>
          </label>
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full transition-all duration-150',
              showPreview
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700',
            )}
          >
            {showPreview ? <><Code className="h-3 w-3" /> Edit</> : <><Eye className="h-3 w-3" /> Preview</>}
          </button>
        </div>
        {showPreview ? (
          <div
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-3 text-sm text-neutral-900 dark:text-white overflow-x-hidden break-words [&_img]:inline-block [&_img]:max-w-full [&_table]:my-2 [&_table]:w-full [&_table]:table-fixed [&_strong]:font-bold [&_h1]:break-words [&_h2]:break-words"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <textarea
            ref={(el) => { if (el) { el.style.height = '0'; el.style.height = el.scrollHeight + 'px'; } }}
            value={bbcode}
            onChange={(e) => {
              setBbcode(e.target.value);
              const el = e.target;
              el.style.height = '0';
              el.style.height = el.scrollHeight + 'px';
            }}
            rows={10}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-none overflow-hidden"
            placeholder="BBCode will be generated when you prepare a release..."
          />
        )}
      </div>

      {/* Metadata */}
      {release.nfo_content && (
        <details className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden">
          <summary className="px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
            NFO / MediaInfo
          </summary>
          <pre className="px-3 py-2 text-[10px] text-neutral-500 dark:text-neutral-400 font-mono overflow-x-auto whitespace-pre max-h-[300px] bg-neutral-50 dark:bg-neutral-900/60">
            {release.nfo_content}
          </pre>
        </details>
      )}
    </div>
  );
}
