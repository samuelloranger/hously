import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, Upload } from 'lucide-react';
import {
  useC411Release,
  useC411UpdateRelease,
  useC411CreateDraft,
  useC411Categories,
  useC411CategoryOptions,
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
  const categories = useC411Categories();
  useC411CategoryOptions(release?.category_id ?? null, {
    enabled: release?.category_id != null,
  });

  const [bbcode, setBbcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);

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
      name: release.name,
      title: release.title ?? undefined,
      description: bbcode,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
      options: release.options as any,
      tmdbData: release.tmdb_data as any,
    };

    // If we have torrent and nfo, include them
    if (release.torrent_s3_key) {
      payload.torrentFileName = `${release.name}.torrent`;
      // Fetch torrent data from API
      try {
        const res = await fetch(`/api/medias/c411/releases/${releaseId}/torrent`);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          payload.torrentFileData = btoa(String.fromCharCode(...new Uint8Array(buf)));
        }
      } catch { /* skip torrent */ }
    }

    if (release.nfo_content) {
      payload.nfoFileName = `${release.name}.nfo`;
      payload.nfoFileData = btoa(release.nfo_content);
    }

    createDraft.mutate(payload);
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
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateDraft}
            disabled={createDraft.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-150 disabled:opacity-50"
          >
            {createDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Create Draft on C411
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

      {createDraft.isSuccess && (
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          Draft created on C411!
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

      {/* BBCode editor */}
      <div>
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1 block">
          BBCode Presentation
          <span className="ml-2 text-[10px] text-neutral-400 font-normal">{bbcode.length} chars</span>
        </label>
        <textarea
          value={bbcode}
          onChange={(e) => setBbcode(e.target.value)}
          rows={20}
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-y min-h-[200px]"
          placeholder="BBCode will be generated when you prepare a release..."
        />
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
