import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit2, Check, X as XIcon } from 'lucide-react';
import { formatBytes, type QbittorrentTorrentFile } from '@hously/shared';

interface TorrentFilesTabProps {
  isLoading: boolean;
  files: QbittorrentTorrentFile[] | undefined;
  error?: string;
  onRenameFile: (oldPath: string, newPath: string) => void;
  isRenamePending: boolean;
}

export function TorrentFilesTab({ isLoading, files, error, onRenameFile, isRenamePending }: TorrentFilesTabProps) {
  const { t } = useTranslation('common');

  const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null);
  const [draftFilePath, setDraftFilePath] = useState('');

  const beginRename = (path: string) => {
    setRenamingFilePath(path);
    setDraftFilePath(path);
  };

  const cancelRename = () => {
    setRenamingFilePath(null);
    setDraftFilePath('');
  };

  const submitRename = () => {
    if (!renamingFilePath) return;
    const newPath = draftFilePath.trim();
    if (!newPath || newPath === renamingFilePath) return;
    onRenameFile(renamingFilePath, newPath);
    cancelRename();
  };

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
            {t('common.loading', 'Loading...')}
          </div>
        ) : files?.length ? (
          files.map(file => (
            <div key={`${file.index}-${file.name}`} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-neutral-700 dark:text-neutral-200 break-all leading-relaxed">
                    {file.name}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500"
                        style={{ width: `${Math.round(file.progress * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                      {Math.round(file.progress * 100)}% · {formatBytes(file.size_bytes)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => beginRename(file.name)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Edit2 size={11} />
                  {t('torrents.rename', 'Rename')}
                </button>
              </div>

              {renamingFilePath === file.name && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={draftFilePath}
                    onChange={e => setDraftFilePath(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={submitRename}
                      disabled={isRenamePending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                    >
                      <Check size={12} />
                      {t('common.save', 'Save')}
                    </button>
                    <button
                      onClick={cancelRename}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium transition-colors"
                    >
                      <XIcon size={12} />
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
            {error ?? t('torrents.noFiles', 'No files')}
          </div>
        )}
      </div>
    </div>
  );
}
