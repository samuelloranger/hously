import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from '@/components/dialog';
import { useMediaDelete, type MediaItem } from '@hously/shared';

interface DeleteMediaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
}

export function DeleteMediaDialog({ isOpen, onClose, media }: DeleteMediaDialogProps) {
  const { t } = useTranslation('common');
  const [deleteFiles, setDeleteFiles] = useState(false);
  const deleteMutation = useMediaDelete();

  const handleDelete = async () => {
    if (!media || deleteMutation.isPending) return;

    try {
      await deleteMutation.mutateAsync({
        service: media.service,
        source_id: media.source_id,
        deleteFiles,
      });
      toast.success(t('medias.delete.success', { title: media.title }));
      setDeleteFiles(false);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('medias.delete.failed'));
    }
  };

  const handleClose = () => {
    if (deleteMutation.isPending) return;
    setDeleteFiles(false);
    onClose();
  };

  const serviceName = media?.service === 'radarr' ? 'Radarr' : 'Sonarr';

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title={t('medias.delete.title')}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t('medias.delete.warning', { title: media?.title ?? '', service: serviceName })}
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-3 cursor-pointer select-none hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
          <input
            type="checkbox"
            checked={deleteFiles}
            onChange={e => setDeleteFiles(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 dark:border-neutral-600 text-red-600 focus:ring-red-500/40"
          />
          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {t('medias.delete.deleteFilesLabel')}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('medias.delete.deleteFilesDescription')}
            </p>
          </div>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={deleteMutation.isPending}
            className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleteMutation.isPending}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40"
          >
            {deleteMutation.isPending ? t('medias.delete.deleting') : t('medias.delete.confirm')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
