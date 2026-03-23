import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  mergeQbittorrentFiles,
  toOptionalQbittorrentString,
  toOptionalQbittorrentTags,
  toggleQbittorrentTagSelection,
  useAddQbittorrentMagnet,
  useAddQbittorrentTorrentFile,
  useDashboardQbittorrentCategories,
  useDashboardQbittorrentTags,
} from '@hously/shared';
import { ChevronRight, File, FolderOpen, Magnet, Plus, Tag, Upload, X } from 'lucide-react';

export function AddTorrentPanel() {
  const { t } = useTranslation('common');

  const addMagnetMutation = useAddQbittorrentMagnet();
  const addFileMutation = useAddQbittorrentTorrentFile();
  const categoriesQuery = useDashboardQbittorrentCategories();
  const tagsQuery = useDashboardQbittorrentTags();

  const [open, setOpen] = useState(false);
  const [magnet, setMagnet] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categories = categoriesQuery.data?.categories ?? [];
  const availableTags = tagsQuery.data?.tags ?? [];

  const canInteract = !addMagnetMutation.isPending && !addFileMutation.isPending;

  const handleAddMagnet = () => {
    const value = magnet.trim();
    if (!value) return;
    addMagnetMutation.mutate(
      {
        magnet: value,
        category: toOptionalQbittorrentString(selectedCategory),
        tags: toOptionalQbittorrentTags(selectedTags),
      },
      {
        onSuccess: res => {
          if (res.success) setMagnet('');
        },
      }
    );
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(prev => mergeQbittorrentFiles(prev, files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitFiles = () => {
    if (selectedFiles.length === 0) return;
    addFileMutation.mutate(
      {
        torrents: selectedFiles,
        category: toOptionalQbittorrentString(selectedCategory),
        tags: toOptionalQbittorrentTags(selectedTags),
      },
      {
        onSuccess: res => {
          if (res.success) setSelectedFiles([]);
        },
      }
    );
  };

  const hasCategoryOrTags = categories.length > 0 || availableTags.length > 0;

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
        <div className="border-t border-neutral-100 dark:border-neutral-800 p-5 space-y-4">
          {/* Category & Tags — shared between both methods */}
          {hasCategoryOrTags && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                    <FolderOpen size={11} />
                    {t('dashboard.qbittorrent.category', 'Category')}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    disabled={!canInteract}
                    className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 disabled:opacity-50 transition"
                  >
                    <option value="">{t('dashboard.qbittorrent.noCategory', 'No category')}</option>
                    {categories.map(cat => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {availableTags.length > 0 && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                    <Tag size={11} />
                    {t('dashboard.qbittorrent.tags', 'Tags')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map(tag => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTags(prev => toggleQbittorrentTagSelection(prev, tag))}
                          disabled={!canInteract}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
                            active
                              ? 'bg-sky-500 text-white'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                          }`}
                        >
                          {active && <X size={9} />}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  {addMagnetMutation.error.message}
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
                  multiple
                  accept=".torrent,application/x-bittorrent"
                  onChange={handleFilesSelected}
                  className="w-full text-sm text-neutral-600 dark:text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 dark:file:bg-neutral-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-700 dark:file:text-neutral-200 file:cursor-pointer"
                  disabled={!canInteract}
                />

                {selectedFiles.length > 0 && (
                  <div className="space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="flex items-center gap-2 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-2.5 py-1.5"
                      >
                        <File size={12} className="shrink-0 text-neutral-400" />
                        <span className="flex-1 truncate text-xs text-neutral-700 dark:text-neutral-300">
                          {file.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-neutral-400">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          disabled={!canInteract}
                          className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                          aria-label={t('torrents.removeFile', 'Remove {{name}}', { name: file.name })}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleSubmitFiles}
                  disabled={!canInteract || selectedFiles.length === 0}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  {addFileMutation.isPending
                    ? t('common.loading', 'Uploading...')
                    : selectedFiles.length > 1
                      ? t('torrents.submitTorrentFiles', 'Submit {{count}} files', { count: selectedFiles.length })
                      : t('torrents.submitTorrentFile', 'Submit')}
                </button>
              </div>
              {addFileMutation.error && (
                <p className="mt-1.5 text-xs text-rose-600">
                  {addFileMutation.error.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
