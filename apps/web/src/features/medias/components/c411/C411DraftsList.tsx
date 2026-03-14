import { useState } from 'react';
import { Loader2, FileText, Trash2, Upload } from 'lucide-react';
import type { C411DraftsResponse } from '@hously/shared';
import { useC411DeleteDraft, useC411PublishDraft } from '@hously/shared';
import { BADGE_NEUTRAL, BADGE_SKY, BADGE_VIOLET, CARD_HOVER } from './c411-utils';

interface Props {
  data: C411DraftsResponse | null;
  isLoading: boolean;
}

export function C411DraftsList({ data, isLoading }: Props) {
  const deleteDraft = useC411DeleteDraft();
  const publishDraft = useC411PublishDraft();
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const handlePublish = (draftId: number, draftName: string) => {
    if (!confirm(`Publish "${draftName}" on C411?`)) return;
    setPublishingId(draftId);
    setPublishError(null);
    publishDraft.mutate(draftId, {
      onSuccess: (data) => {
        setPublishingId(null);
        if (!data.success) {
          setPublishError(data.message ?? 'Publish failed');
        }
      },
      onError: (error: any) => {
        setPublishingId(null);
        const message = error?.data?.message ?? error?.message ?? 'Publish failed';
        setPublishError(message);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const drafts = data?.data ?? [];

  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/60">
          <FileText className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-white">No drafts</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Prepare a release first, then create a draft on C411
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
        {data?.count ?? 0}/{data?.maxAllowed ?? '?'} drafts
      </p>

      {publishError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {publishError}
          <button onClick={() => setPublishError(null)} className="ml-2 underline hover:no-underline">dismiss</button>
        </div>
      )}

      {drafts.map((draft) => {
        const isPublishing = publishingId === draft.id;
        return (
          <div key={draft.id} className={`p-3 ${CARD_HOVER}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{draft.name}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={BADGE_NEUTRAL}>{draft.category.name}</span>
                  {draft.subcategory?.name && <span className={BADGE_NEUTRAL}>{draft.subcategory.name}</span>}
                  {draft.hasTorrentFile && <span className={BADGE_VIOLET}>.torrent</span>}
                  {draft.hasNfoFile && <span className={BADGE_SKY}>.nfo</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mr-1">
                  {new Date(draft.updatedAt).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handlePublish(draft.id, draft.name)}
                  disabled={isPublishing || publishDraft.isPending}
                  title="Publish on C411"
                  className="rounded-lg p-1.5 text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                >
                  {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => { if (confirm('Delete this draft from C411?')) deleteDraft.mutate(draft.id); }}
                  disabled={deleteDraft.isPending}
                  className="rounded-lg p-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
