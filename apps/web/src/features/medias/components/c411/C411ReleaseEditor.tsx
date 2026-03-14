import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Loader2, Upload, Eye, Code } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useC411Release,
  useC411UpdateRelease,
  useC411CreateDraft,
  useC411Categories,
  useC411CategoryOptions,
} from '@hously/shared';
import type { C411DraftPayload } from '@hously/shared';

/** Convert BBCode to HTML for preview. */
function bbcodeToHtml(input: string): string {
  let html = input
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Block tags
  html = html.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, '<h1 class="text-xl font-bold text-neutral-900 dark:text-white mb-1">$1</h1>');
  html = html.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, '<h2 class="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">$1</h2>');
  html = html.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, '<h3 class="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-1">$1</h3>');

  // Inline tags
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');

  // URLs
  html = html.replace(/\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noreferrer" class="text-indigo-500 hover:text-indigo-400 underline">$2</a>');
  html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noreferrer" class="text-indigo-500 hover:text-indigo-400 underline">$1</a>');

  // Images
  html = html.replace(/\[img=(\d+)x(\d+)\](.*?)\[\/img\]/gi, '<img src="$3" width="$1" height="$2" class="inline-block" loading="lazy" />');
  html = html.replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" class="max-w-full rounded-lg my-1" loading="lazy" />');

  // Tables
  html = html.replace(/\[table\]/gi, '<table class="w-full text-xs border-collapse my-2">');
  html = html.replace(/\[\/table\]/gi, '</table>');
  html = html.replace(/\[tr\]/gi, '<tr>');
  html = html.replace(/\[\/tr\]/gi, '</tr>');
  html = html.replace(/\[th\]([\s\S]*?)\[\/th\]/gi, '<th class="border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 px-2 py-1 text-left font-semibold">$1</th>');
  html = html.replace(/\[td\]([\s\S]*?)\[\/td\]/gi, '<td class="border border-neutral-300 dark:border-neutral-600 px-2 py-1">$1</td>');

  // Newlines to <br>
  html = html.replace(/\n/g, '<br/>');

  return html;
}

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
  const [showPreview, setShowPreview] = useState(false);

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
      title: release.title ?? undefined,
      description: bbcode,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
      options: release.options as any,
      tmdbData: release.tmdb_data as any,
    };

    // If we have torrent and nfo, include them
    if (release.torrent_s3_key) {
      payload.torrentFileName = `${name}.torrent`;
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
      payload.nfoFileName = `${name}.nfo`;
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
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-3 text-sm text-neutral-900 dark:text-white overflow-y-auto max-h-[600px] min-h-[200px] [&_img]:inline-block [&_table]:my-2 [&_strong]:font-bold"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : (
          <textarea
            value={bbcode}
            onChange={(e) => setBbcode(e.target.value)}
            rows={20}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-xs text-neutral-900 dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono resize-y min-h-[200px]"
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
