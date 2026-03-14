import { Loader2, FileText } from 'lucide-react';
import type { C411DraftsResponse } from '@hously/shared';

interface Props {
  data: C411DraftsResponse | null;
  isLoading: boolean;
}

export function C411DraftsList({ data, isLoading }: Props) {
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
      {drafts.map((draft) => (
        <div
          key={draft.id}
          className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{draft.name}</p>
              {draft.title && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{draft.title}</p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
                  {draft.category.name}
                </span>
                {draft.hasTorrentFile && (
                  <span className="inline-flex items-center rounded-md bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                    .torrent
                  </span>
                )}
                {draft.hasNfoFile && (
                  <span className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                    .nfo
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
              {new Date(draft.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
