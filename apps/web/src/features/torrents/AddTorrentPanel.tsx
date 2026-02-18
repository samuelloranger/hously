import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddQbittorrentMagnet, useAddQbittorrentTorrentFile } from '@hously/shared';
import { ChevronRight, Magnet, Plus, Upload } from 'lucide-react';

export function AddTorrentPanel() {
  const { t } = useTranslation('common');

  const addMagnetMutation = useAddQbittorrentMagnet();
  const addFileMutation = useAddQbittorrentTorrentFile();

  const [open, setOpen] = useState(false);
  const [magnet, setMagnet] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canInteract = !addMagnetMutation.isPending && !addFileMutation.isPending;

  const handleAddMagnet = () => {
    const value = magnet.trim();
    if (!value) return;
    addMagnetMutation.mutate(
      { magnet: value },
      {
        onSuccess: res => {
          if (res.success) setMagnet('');
        },
      }
    );
  };

  const handleSubmitFile = () => {
    if (!selectedFile) return;
    addFileMutation.mutate(selectedFile, {
      onSuccess: res => {
        if (res.success) {
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
    });
  };

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {t('dashboard.qbittorrent.addTorrent')}
          </span>
        </div>
        <ChevronRight
          size={14}
          className={`text-neutral-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Magnet */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
              <Magnet size={11} />
              {t('dashboard.qbittorrent.addMagnet', 'Magnet link')}
            </label>
            <div className="flex items-center gap-2">
              <input
                value={magnet}
                onChange={e => setMagnet(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddMagnet()}
                placeholder={t('dashboard.qbittorrent.magnetPlaceholder', 'magnet:?xt=urn:btih:...')}
                className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2.5 text-sm font-mono text-neutral-900 dark:text-neutral-100 placeholder:font-sans placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 dark:focus:border-sky-500 transition"
                disabled={!canInteract}
              />
              <button
                onClick={handleAddMagnet}
                disabled={!canInteract || magnet.trim().length === 0}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {t('dashboard.qbittorrent.add', 'Add')}
              </button>
            </div>
            {addMagnetMutation.error && (
              <p className="mt-1.5 text-xs text-rose-600">
                {String((addMagnetMutation.error as any)?.message ?? addMagnetMutation.error)}
              </p>
            )}
          </div>

          {/* File upload */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
              <Upload size={11} />
              {t('dashboard.qbittorrent.addTorrentFile', '.torrent file')}
            </label>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".torrent,application/x-bittorrent"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 dark:file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-700 dark:file:text-neutral-200 file:cursor-pointer"
                disabled={!canInteract}
              />
              <button
                onClick={handleSubmitFile}
                disabled={!canInteract || !selectedFile}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {t('torrents.submitTorrentFile', 'Submit')}
              </button>
            </div>
            {addFileMutation.error && (
              <p className="mt-1.5 text-xs text-rose-600">
                {String((addFileMutation.error as any)?.message ?? addFileMutation.error)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
