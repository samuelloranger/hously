import { formatDistanceToNow } from 'date-fns';
import { Loader2, RefreshCw, CalendarClock, Trash2 } from 'lucide-react';
import { useMediaHistory, useC411ReprocessReleaseGroup } from '@hously/shared';
import { toast } from 'sonner';

interface MediaInfoHistoryActionsPanelProps {
  service: 'radarr' | 'sonarr';
  sourceId: number | null;
  seasonNumber: number | null;
  onDelete: () => void;
}

export function MediaInfoHistoryActionsPanel({ service, sourceId, seasonNumber, onDelete }: MediaInfoHistoryActionsPanelProps) {
  const { data: history, isLoading } = useMediaHistory(
    { service, sourceId, seasonNumber },
    { enabled: sourceId !== null }
  );

  const reprocess = useC411ReprocessReleaseGroup();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const handleReprocess = async (historyEventId?: number) => {
    if (!sourceId) return;
    try {
      await reprocess.mutateAsync({ service, sourceId, seasonNumber, historyEventId });
      toast.success(service === 'sonarr' ? 'Rescan triggered for series' : 'Rescan triggered for movie');
    } catch (err: any) {
      toast.error('Failed to trigger scan: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 rounded-xl border border-neutral-100 dark:border-neutral-800 p-4">
      {/* Actions */}
      <div className="flex flex-col gap-3 pb-6 border-b border-neutral-100 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleReprocess()}
            disabled={reprocess.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
          >
            {reprocess.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh / Rescan {service === 'sonarr' ? 'Series' : 'Movie'}
          </button>

          <button
            onClick={onDelete}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Media
          </button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">History ({service})</h3>

        {!history || history.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">No history events found.</p>
        ) : (
          <div className="space-y-3">
            {history.map((event: any, i: number) => (
              <div
                key={event.id || i}
                className="flex gap-3 text-sm p-3 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50"
              >
                <CalendarClock className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                      {event.eventType?.replace('_', ' ') || 'Unknown event'}
                    </p>
                    {event.date && (
                      <span className="text-xs text-neutral-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  {event.sourceTitle && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate" title={event.sourceTitle}>
                      File: {event.sourceTitle}
                    </p>
                  )}

                  {event.data?.droppedPath && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex gap-1">
                      <span className="text-red-400 line-through">Dropped:</span>{' '}
                      {event.data.droppedPath.split(/[/\\\\]/).pop()}
                    </p>
                  )}
                  {event.data?.importedPath && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex gap-1">
                      <span className="text-emerald-500">Imported:</span>{' '}
                      {event.data.importedPath.split(/[/\\\\]/).pop()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
