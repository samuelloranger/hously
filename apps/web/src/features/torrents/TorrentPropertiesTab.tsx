import { useTranslation } from 'react-i18next';
import { Settings2, Check, Tag, X as XIcon } from 'lucide-react';
import { formatBytes, type DashboardQbittorrentTorrentPropertiesResponse } from '@hously/shared';
import { Select } from '@/components/ui/select';

interface TorrentPropertiesTabProps {
  propertiesQuery: {
    isLoading: boolean;
    data?: DashboardQbittorrentTorrentPropertiesResponse;
  };
  selectedTorrent: {
    name: string;
    category?: string | null;
    tags?: string[];
  } | null;
  categories: { name: string }[];
  availableTags: string[];
  draftName: string;
  onDraftNameChange: (value: string) => void;
  draftCategory: string;
  onDraftCategoryChange: (value: string) => void;
  onSaveName: () => void;
  onSaveCategory: () => void;
  onSaveTags: (tags: string[]) => void;
  isRenamePending: boolean;
  isCategoryPending: boolean;
}

export function TorrentPropertiesTab({
  propertiesQuery,
  selectedTorrent,
  categories,
  availableTags,
  draftName,
  onDraftNameChange,
  draftCategory,
  onDraftCategoryChange,
  onSaveName,
  onSaveCategory,
  onSaveTags,
  isRenamePending,
  isCategoryPending,
}: TorrentPropertiesTabProps) {
  const { t } = useTranslation('common');
  const props = propertiesQuery.data?.properties;

  return (
    <div className="space-y-5">
      {/* Metadata */}
      {propertiesQuery.isLoading ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">{t('common.loading', 'Loading...')}</p>
      ) : props ? (
        <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {t('torrents.properties', 'Properties')}
            </h2>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {[
              { label: t('torrents.savePath', 'Save path'), value: props.save_path, mono: true },
              {
                label: t('torrents.totalDownloaded', 'Downloaded'),
                value: props.total_downloaded_bytes != null ? formatBytes(props.total_downloaded_bytes) : null,
                mono: true,
              },
              {
                label: t('torrents.totalUploaded', 'Uploaded'),
                value: props.total_uploaded_bytes != null ? formatBytes(props.total_uploaded_bytes) : null,
                mono: true,
              },
              {
                label: t('torrents.shareRatio', 'Ratio'),
                value: props.share_ratio != null ? props.share_ratio.toFixed(3) : null,
                mono: true,
              },
              { label: 'Comment', value: props.comment, mono: false },
              { label: 'Created', value: props.creation_date, mono: false },
              { label: 'Added', value: props.addition_date, mono: false },
              { label: 'Completed', value: props.completion_date, mono: false },
            ]
              .filter(row => row.value)
              .map(row => (
                <div key={row.label} className="px-5 py-3 flex flex-wrap items-start justify-between gap-3">
                  <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400 pt-0.5 min-w-[110px]">
                    {row.label}
                  </span>
                  <span
                    className={`text-sm text-neutral-900 dark:text-neutral-100 break-all text-right ${row.mono ? 'font-mono' : ''}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 py-2">
          {propertiesQuery.data?.error ?? t('torrents.noProperties', 'No properties')}
        </p>
      )}

      {/* Edit controls */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-2">
          <Settings2 size={13} className="text-neutral-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Edit
          </h2>
        </div>
        <div className="p-5 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
              {t('torrents.renameTorrent', 'Name')}
            </label>
            <div className="flex items-center gap-2">
              <input
                value={draftName}
                onChange={e => onDraftNameChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSaveName()}
                className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 px-3 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 dark:focus:border-sky-500 transition"
              />
              <button
                onClick={onSaveName}
                disabled={isRenamePending || draftName.trim().length === 0}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
              >
                <Check size={14} />
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
              {t('torrents.category', 'Category')}
            </label>
            <div className="flex items-center gap-2">
              <Select value={draftCategory} onChange={e => onDraftCategoryChange(e.target.value)} className="flex-1">
                <option value="">{t('torrents.noCategory', 'No category')}</option>
                {categories.map(category => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <button
                onClick={onSaveCategory}
                disabled={isCategoryPending}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
              >
                <Check size={14} />
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
              {t('torrents.tags', 'Tags')}
            </label>
            <div className="space-y-2.5">
              {selectedTorrent?.tags && selectedTorrent.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTorrent.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const next = (selectedTorrent.tags ?? []).filter(t2 => t2 !== tag);
                        onSaveTags(next);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800 hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:border-red-500/30 dark:hover:text-red-400 transition-colors"
                    >
                      <Tag size={9} />
                      {tag}
                      <XIcon size={10} />
                    </button>
                  ))}
                </div>
              )}
              {availableTags.length > 0 && (
                <Select
                  value=""
                  onChange={e => {
                    const selected = e.target.value;
                    if (!selected) return;
                    const currentTags = selectedTorrent?.tags ?? [];
                    if (currentTags.includes(selected)) return;
                    onSaveTags([...currentTags, selected]);
                  }}
                >
                  <option value="">+ {t('torrents.tags', 'Tags')}</option>
                  {availableTags
                    .filter(tag => !(selectedTorrent?.tags ?? []).includes(tag))
                    .map(tag => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                </Select>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
