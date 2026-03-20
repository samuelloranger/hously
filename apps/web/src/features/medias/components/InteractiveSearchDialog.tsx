import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/dialog';
import type { MediaItem } from '@hously/shared';
import { InteractiveSearchPanel } from './InteractiveSearchPanel';

interface InteractiveSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media?: MediaItem | null;
  mode?: 'arr' | 'prowlarr';
}

export function InteractiveSearchDialog({ isOpen, onClose, media = null, mode = 'arr' }: InteractiveSearchDialogProps) {
  const { t } = useTranslation('common');
  const isProwlarrMode = mode === 'prowlarr';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        isProwlarrMode
          ? t('medias.interactive.prowlarrTitle')
          : t('medias.interactive.title', {
              title: media?.title ?? '',
            })
      }
      panelClassName="max-w-5xl overflow-hidden"
    >
      <InteractiveSearchPanel
        isActive={isOpen}
        media={media}
        mode={mode}
        onDownloadSuccess={onClose}
      />
    </Dialog>
  );
}
