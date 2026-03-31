import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes, useArrManagementDetails, useMediaDelete, useMediaRefresh } from '@hously/shared';
import { RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/dialog';
import { cn } from '@/lib/utils';

interface ArrManagementPanelProps {
  service: 'radarr' | 'sonarr';
  sourceId: number;
  title: string;
  isActive: boolean;
  onDeleted: () => void;
}

function DetailRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-[38%] shrink-0 text-neutral-500 dark:text-neutral-500">{label}</span>
      <span
        className={cn(
          'min-w-0 flex-1 break-words text-neutral-800 dark:text-neutral-200',
          mono && 'font-mono text-[12px] leading-snug'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ArrManagementPanel({ service, sourceId, title, isActive, onDeleted }: ArrManagementPanelProps) {
  const { t } = useTranslation('common');
  const refreshMutation = useMediaRefresh();
  const deleteMutation = useMediaDelete();

  const { data: info, isLoading, isError, refetch } = useArrManagementDetails(
    { service, source_id: sourceId },
    { enabled: isActive }
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [riskAck, setRiskAck] = useState(false);

  const confirmOk = confirmText === 'DELETE' && riskAck;
  const serviceName = service === 'radarr' ? 'Radarr' : 'Sonarr';

  const handleRefresh = async () => {
    if (refreshMutation.isPending) return;
    try {
      await refreshMutation.mutateAsync({ service, source_id: sourceId });
      toast.success(t('medias.management.refreshSuccess', { service: serviceName }));
      await refetch();
    } catch {
      toast.error(t('medias.management.refreshFailed'));
    }
  };

  const handleDelete = async () => {
    if (!confirmOk || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync({ service, source_id: sourceId, deleteFiles });
      toast.success(t('medias.management.deleteSuccess', { title, service: serviceName }));
      setDeleteOpen(false);
      setConfirmText('');
      setRiskAck(false);
      setDeleteFiles(false);
      onDeleted();
    } catch {
      toast.error(t('medias.management.deleteFailed', { service: serviceName }));
    }
  };

  const formatShortDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const file = info?.file;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t('medias.management.intro', { service: serviceName })}
      </p>

      {/* Arr metadata + file details */}
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-3 dark:border-neutral-700/60 dark:bg-neutral-900/40">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {t('medias.management.detailsSection')}
        </p>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
            {t('medias.management.loadingDetails')}
          </div>
        )}

        {isError && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{t('medias.management.detailsError')}</p>
        )}

        {info && !isLoading && (
          <div className="flex flex-col gap-2">
            <DetailRow label={t('medias.management.path')} value={info.path} mono />
            <DetailRow label={t('medias.management.rootFolder')} value={info.root_folder_path} mono />
            <DetailRow
              label={t('medias.management.monitored')}
              value={info.monitored ? t('medias.management.yes') : t('medias.management.no')}
            />
            <DetailRow label={t('medias.management.arrStatus')} value={info.arr_status} />
            <DetailRow label={t('medias.management.addedToArr')} value={formatShortDate(info.added)} />
            {info.genres.length > 0 && (
              <DetailRow label={t('medias.management.genres')} value={info.genres.join(', ')} />
            )}
            {info.service === 'radarr' && <DetailRow label={t('medias.management.studio')} value={info.studio} />}
            {info.service === 'sonarr' && (
              <>
                <DetailRow label={t('medias.management.network')} value={info.network} />
                <DetailRow label={t('medias.management.seriesType')} value={info.series_type} />
                <DetailRow
                  label={t('medias.management.seasonFolder')}
                  value={info.season_folder ? t('medias.management.yes') : t('medias.management.no')}
                />
              </>
            )}

            {info.service === 'sonarr' && info.statistics && (
              <>
                <DetailRow
                  label={t('medias.management.episodeStats')}
                  value={t('medias.management.episodeStatsValue', {
                    files: info.statistics.episode_file_count,
                    total: info.statistics.total_episode_count,
                  })}
                />
                <DetailRow
                  label={t('medias.management.sizeOnDisk')}
                  value={formatBytes(info.statistics.size_on_disk_bytes)}
                />
                <DetailRow
                  label={t('medias.management.episodePercent')}
                  value={`${Math.round(info.statistics.percent_of_episodes)}%`}
                />
              </>
            )}

            {info.service === 'radarr' && (
              <DetailRow
                label={t('medias.management.hasFile')}
                value={info.has_file ? t('medias.management.yes') : t('medias.management.no')}
              />
            )}

            {info.service === 'radarr' && file && (
              <>
                <div className="my-1 border-t border-neutral-200/80 dark:border-neutral-700/60" />
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {t('medias.management.fileSection')}
                </p>
                <DetailRow label={t('medias.management.filePath')} value={file.relative_path} mono />
                <DetailRow
                  label={t('medias.management.fileSize')}
                  value={file.size_bytes != null ? formatBytes(file.size_bytes) : null}
                />
                <DetailRow label={t('medias.management.quality')} value={file.quality_label} />
                <DetailRow
                  label={t('medias.management.customFormatScore')}
                  value={file.custom_format_score != null ? String(file.custom_format_score) : null}
                />
                <DetailRow label={t('medias.management.fileDateAdded')} value={formatShortDate(file.date_added)} />
                {file.languages.length > 0 && (
                  <DetailRow label={t('medias.management.languages')} value={file.languages.join(', ')} />
                )}
                <DetailRow label={t('medias.management.video')} value={file.video_codec} />
                <DetailRow label={t('medias.management.resolution')} value={file.media_resolution} />
                <DetailRow
                  label={t('medias.management.audio')}
                  value={
                    [file.audio_codec, file.audio_channels].filter(Boolean).join(' · ') || null
                  }
                />
                <DetailRow label={t('medias.management.edition')} value={file.edition} />
                <DetailRow label={t('medias.management.releaseGroup')} value={file.release_group} />
                <DetailRow label={t('medias.management.sceneName')} value={file.scene_name} mono />
              </>
            )}

            {info.service === 'radarr' && info.has_file && !file && (
              <p className="text-xs text-neutral-500">{t('medias.management.filePending')}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800',
            'hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
            'disabled:opacity-50'
          )}
        >
          {refreshMutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
          ) : (
            <RefreshCw size={16} />
          )}
          {t('medias.management.refresh', { service: serviceName })}
        </button>

        <button
          type="button"
          onClick={() => {
            setDeleteOpen(true);
            setConfirmText('');
            setRiskAck(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
        >
          <Trash2 size={16} />
          {t('medias.management.removeFromArr', { service: serviceName })}
        </button>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-500">
        {t('medias.management.releaseReminderHint')}
      </p>

      <Dialog
        isOpen={deleteOpen}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteOpen(false);
            setConfirmText('');
            setRiskAck(false);
          }
        }}
        title={t('medias.management.deleteTitle', { service: serviceName })}
        panelClassName="max-w-md"
      >
        <div className="flex flex-col gap-4 py-1">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('medias.management.deleteWarning', { title, service: serviceName })}
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={deleteFiles}
              onChange={e => setDeleteFiles(e.target.checked)}
              className="mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500 dark:border-neutral-600"
            />
            <span>{t('medias.management.deleteFiles')}</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={riskAck}
              onChange={e => setRiskAck(e.target.checked)}
              className="mt-0.5 rounded border-neutral-300 text-red-600 focus:ring-red-500 dark:border-neutral-600"
            />
            <span>{t('medias.management.deleteAck', { service: serviceName })}</span>
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t('medias.management.typeDelete')}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              placeholder="DELETE"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              {t('medias.management.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmOk || deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              {deleteMutation.isPending
                ? t('medias.management.deleting')
                : t('medias.management.confirmDelete')}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
