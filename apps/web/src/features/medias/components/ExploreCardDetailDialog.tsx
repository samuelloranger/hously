import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAddUpcomingToArr,
  useMediaRatings,
  useTmdbCredits,
  useTmdbMediaDetails,
  useTmdbTrailer,
  useTmdbWatchProviders,
  type MediaItem,
  type TmdbMediaSearchItem,
} from '@hously/shared';
import { Check, Clock, ExternalLink, Film, Info, Play, Plus, Search, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/dialog';
import { cn } from '@/lib/utils';
import { InteractiveSearchPanel } from './InteractiveSearchPanel';
import { SimilarMediasPanel } from './SimilarMediasPanel';

export type TabKey = 'info' | 'similar' | 'search';

interface ExploreCardDetailDialogProps {
  item: TmdbMediaSearchItem;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
  defaultTab?: TabKey;
  onRefetchLibrary?: () => void;
}

// Build a minimal MediaItem for InteractiveSearchPanel from a TmdbMediaSearchItem
function toMediaItem(item: TmdbMediaSearchItem): MediaItem {
  return {
    id: item.id,
    media_type: item.media_type === 'tv' ? 'series' : 'movie',
    service: item.service,
    source_id: item.source_id!,
    title: item.title,
    sort_title: null,
    year: item.release_year,
    status: null,
    monitored: true,
    downloaded: false,
    downloading: false,
    added_at: null,
    tmdb_id: item.tmdb_id,
    imdb_id: null,
    tvdb_id: null,
    season_count: null,
    episode_count: null,
    poster_url: item.poster_url,
    arr_url: item.arr_url,
    release_tags: null,
  };
}

export function ExploreCardDetailDialog({
  item,
  isOpen,
  onClose,
  onAdded,
  defaultTab = 'info',
  onRefetchLibrary,
}: ExploreCardDetailDialogProps) {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [searchOnAdd, setSearchOnAdd] = useState(true);
  const [imageError, setImageError] = useState(false);

  const addMutation = useAddUpcomingToArr();
  const { data: providers } = useTmdbWatchProviders(item.media_type, item.tmdb_id, undefined, { enabled: isOpen });
  const { data: trailerData } = useTmdbTrailer(item.media_type, item.tmdb_id, { enabled: isOpen });
  const { data: ratingsData } = useMediaRatings(item.media_type, item.tmdb_id, { enabled: isOpen });
  const { data: creditsData } = useTmdbCredits(item.media_type, item.tmdb_id, { enabled: isOpen && activeTab === 'info' });
  const { data: detailsData } = useTmdbMediaDetails(item.media_type, item.tmdb_id, { enabled: isOpen && activeTab === 'info' });

  const canSearch = item.already_exists && item.source_id !== null;
  const hasTmdbId = item.tmdb_id > 0;

  const tabs = useMemo(() => {
    const result: { key: TabKey; label: string; icon: typeof Info }[] = [
      { key: 'info', label: t('medias.detail.tabInfo', 'Info'), icon: Info },
    ];
    if (hasTmdbId) result.push({ key: 'similar', label: t('medias.detail.tabSimilar', 'Similar'), icon: Sparkles });
    if (canSearch) result.push({ key: 'search', label: t('medias.detail.tabSearch', 'Search'), icon: Search });
    return result;
  }, [hasTmdbId, canSearch, t]);

  const validTab = tabs.some(tab => tab.key === activeTab) ? activeTab : 'info';

  const handleAdd = async () => {
    if (addMutation.isPending || item.already_exists || !item.can_add) return;
    try {
      await addMutation.mutateAsync({ media_type: item.media_type, tmdb_id: item.tmdb_id, search_on_add: searchOnAdd });
      toast.success(t('medias.addSuccess', { title: item.title }));
      onAdded();
    } catch {
      toast.error(t('medias.addFailed'));
    }
  };

  const tmdbUrl = `https://www.themoviedb.org/${item.media_type}/${item.tmdb_id}`;
  const serviceName = item.media_type === 'movie' ? 'Radarr' : 'Sonarr';

  // Overlay details data on top of item data (for library items that have null overview/vote_average)
  const overview = item.overview ?? detailsData?.overview ?? null;
  const voteAverage = item.vote_average ?? detailsData?.vote_average ?? null;
  const runtime = detailsData?.runtime ?? null;
  const collection = detailsData?.belongs_to_collection ?? null;

  const runtimeStr = runtime
    ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
    : null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={item.title} panelClassName="max-w-3xl">
      {/* Tab bar */}
      {tabs.length > 1 && (
        <div className="mb-4 border-b border-neutral-200/80 dark:border-neutral-700/60">
          <nav className="flex gap-0.5 -mb-px overflow-x-auto scrollbar-none">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150',
                  validTab === key
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {validTab === key && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Info tab */}
      {validTab === 'info' && (
        <div className="flex flex-col gap-5">
          {/* Trailer */}
          {trailerData?.key && (
            <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={`https://www.youtube.com/embed/${trailerData.key}?rel=0`}
                title={trailerData.name ?? 'Trailer'}
                allow="encrypted-media; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-5">
            {/* Poster — only when no trailer */}
            {!trailerData?.key && (
              <div className="shrink-0 mx-auto sm:mx-0">
                {item.poster_url && !imageError ? (
                  <img
                    src={item.poster_url}
                    alt={item.title}
                    className="w-36 rounded-xl object-cover shadow-md"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-52 w-36 items-center justify-center rounded-xl bg-neutral-200 dark:bg-neutral-700 text-4xl">🎬</div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="flex flex-1 flex-col gap-3 min-w-0">
              {/* Type + year + runtime */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-indigo-600/80 px-2 py-0.5 text-xs font-bold text-white uppercase">
                  {item.media_type === 'movie' ? t('medias.movie') : t('medias.series')}
                </span>
                {item.release_year && <span className="text-sm text-neutral-500 dark:text-neutral-400">{item.release_year}</span>}
                {runtimeStr && (
                  <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <Clock size={12} />
                    {runtimeStr}
                  </span>
                )}
                {detailsData?.number_of_seasons && (
                  <span className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <Film size={12} />
                    {detailsData.number_of_seasons} {t('medias.detail.seasons', 'seasons')} · {detailsData.number_of_episodes} {t('medias.detail.episodes', 'eps')}
                  </span>
                )}
              </div>

              {/* Ratings row */}
              <div className="flex flex-wrap items-center gap-3">
                {voteAverage != null && (
                  <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
                    <Star size={14} className="fill-amber-500 text-amber-500" />
                    {voteAverage.toFixed(1)}
                    <span className="text-neutral-400 dark:text-neutral-500 font-normal text-xs">TMDB</span>
                  </div>
                )}
                {ratingsData?.rotten_tomatoes && (() => {
                  const score = parseInt(ratingsData.rotten_tomatoes);
                  const isFresh = score >= 60;
                  return (
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <img
                        src={isFresh
                          ? 'https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-fresh.149b5e8adc3.svg'
                          : 'https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-rotten.f1ef4f02ce3.svg'}
                        alt={isFresh ? 'Fresh' : 'Rotten'}
                        className="h-5 w-5"
                      />
                      <span className={isFresh ? 'text-red-500 dark:text-red-400' : 'text-neutral-400'}>
                        {ratingsData.rotten_tomatoes}
                      </span>
                    </div>
                  );
                })()}
                {ratingsData?.metacritic && (
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <svg viewBox="0 0 32 32" className="h-5 w-5" aria-label="Metacritic">
                      <circle cx="16" cy="16" r="16" fill="#FFCC34"/>
                      <text x="16" y="22" textAnchor="middle" fontSize="18" fontWeight="900" fontFamily="Arial, sans-serif" fill="#000">M</text>
                    </svg>
                    <span className="text-neutral-700 dark:text-neutral-300">{ratingsData.metacritic}</span>
                  </div>
                )}
              </div>

              {/* Overview */}
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed line-clamp-4">
                {overview || t('medias.detail.noOverview')}
              </p>

              {/* Director */}
              {creditsData?.directors && creditsData.directors.length > 0 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{t('medias.detail.director', 'Directed by')}</span>{' '}
                  {creditsData.directors.join(', ')}
                </p>
              )}

              {/* Collection */}
              {collection && (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                  {collection.poster_url && (
                    <img src={collection.poster_url} alt={collection.name} className="h-8 w-6 rounded object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500/70 dark:text-indigo-400/70">{t('medias.detail.partOfCollection', 'Part of')}</p>
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">{collection.name}</p>
                  </div>
                </div>
              )}

              {/* Where to watch */}
              {providers && (providers.streaming.length > 0 || providers.free.length > 0 || providers.rent.length > 0 || providers.buy.length > 0) && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{t('medias.detail.whereToWatch')}</span>
                  <div className="flex flex-col gap-1.5">
                    {providers.streaming.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{t('medias.detail.stream')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {providers.streaming.map(p => <img key={p.id} src={p.logo_url} alt={p.name} title={p.name} className="w-7 h-7 rounded-md object-cover" />)}
                        </div>
                      </div>
                    )}
                    {providers.free.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{t('medias.detail.free')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {providers.free.map(p => <img key={p.id} src={p.logo_url} alt={p.name} title={p.name} className="w-7 h-7 rounded-md object-cover" />)}
                        </div>
                      </div>
                    )}
                    {providers.rent.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{t('medias.detail.rent')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {providers.rent.map(p => <img key={p.id} src={p.logo_url} alt={p.name} title={p.name} className="w-7 h-7 rounded-md object-cover" />)}
                        </div>
                      </div>
                    )}
                    {providers.buy.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 w-16 shrink-0">{t('medias.detail.buy')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {providers.buy.map(p => <img key={p.id} src={p.logo_url} alt={p.name} title={p.name} className="w-7 h-7 rounded-md object-cover" />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Links */}
              <div className="flex flex-wrap gap-2">
                <a href={tmdbUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/10 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-600/20 transition-colors">
                  <ExternalLink size={14} />{t('medias.detail.viewOnTmdb')}
                </a>
                {trailerData?.key && (
                  <a href={`https://www.youtube.com/watch?v=${trailerData.key}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/10 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-600/20 transition-colors">
                    <Play size={14} />{t('medias.detail.watchTrailer')}
                  </a>
                )}
                {item.arr_url && (
                  <a href={item.arr_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-600/20 transition-colors">
                    <ExternalLink size={14} />{t('medias.detail.viewInArr', { service: serviceName })}
                  </a>
                )}
              </div>

              {/* Add action */}
              <div className="mt-auto pt-2 border-t border-neutral-200 dark:border-neutral-700">
                {item.already_exists ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <Check size={16} />{t('medias.detail.inLibrary')}
                  </div>
                ) : item.can_add ? (
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                      <input type="checkbox" checked={searchOnAdd} onChange={e => setSearchOnAdd(e.target.checked)} className="rounded border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500" />
                      {t('medias.detail.searchOnAdd')}
                    </label>
                    <button onClick={handleAdd} disabled={addMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-colors">
                      {addMutation.isPending ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Plus size={16} />}
                      {t('medias.detail.addToLibrary')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Cast */}
          {creditsData && creditsData.cast.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{t('medias.detail.cast', 'Cast')}</h3>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {creditsData.cast.map(member => (
                  <div key={member.id} className="flex shrink-0 flex-col items-center gap-1.5 w-16">
                    {member.profile_url ? (
                      <img src={member.profile_url} alt={member.name} className="h-16 w-16 rounded-full object-cover bg-neutral-200 dark:bg-neutral-700" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-2xl">👤</div>
                    )}
                    <p className="text-center text-[10px] font-medium text-neutral-700 dark:text-neutral-300 leading-tight line-clamp-2">{member.name}</p>
                    {member.character && (
                      <p className="text-center text-[9px] text-neutral-400 dark:text-neutral-500 leading-tight line-clamp-1">{member.character}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Similar tab */}
      {validTab === 'similar' && (
        <div className="min-h-[300px]">
          <SimilarMediasPanel
            isActive={isOpen && validTab === 'similar'}
            tmdbId={item.tmdb_id}
            mediaType={item.media_type}
            onAdded={onAdded}
          />
        </div>
      )}

      {/* Search tab */}
      {validTab === 'search' && canSearch && (
        <div className="min-h-[300px]">
          <InteractiveSearchPanel
            isActive={isOpen && validTab === 'search'}
            media={toMediaItem(item)}
            onDownloadSuccess={onRefetchLibrary}
          />
        </div>
      )}
    </Dialog>
  );
}
