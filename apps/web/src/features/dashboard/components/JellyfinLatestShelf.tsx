import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { JellyfinLatestItem } from '../../../types';
import { ListItemSkeleton } from '../../../components/Skeleton';

interface JellyfinLatestShelfProps {
  enabled: boolean;
  isLoading: boolean;
  items: JellyfinLatestItem[];
}

const mediaTypeConfig: Record<string, { emoji: string; badgeClass: string }> = {
  episode: { emoji: '📺', badgeClass: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30' },
  movie: { emoji: '🎬', badgeClass: 'bg-rose-500/15 text-rose-200 border-rose-400/30' },
  musicalbum: { emoji: '💿', badgeClass: 'bg-lime-500/15 text-lime-200 border-lime-400/30' },
  audio: { emoji: '🎧', badgeClass: 'bg-lime-500/15 text-lime-200 border-lime-400/30' },
};

const getTypeConfig = (itemType: string | null) => {
  if (!itemType) return { emoji: '🎞️', badgeClass: 'bg-white/10 text-white border-white/20' };
  return mediaTypeConfig[itemType.toLowerCase()] || { emoji: '🎞️', badgeClass: 'bg-white/10 text-white border-white/20' };
};

const formatItemType = (itemType: string | null) => {
  if (!itemType) return 'Media';
  return itemType.replace(/([a-z])([A-Z])/g, '$1 $2');
};

const formatRelativeTime = (addedAt: string | null) => {
  if (!addedAt) return null;
  const parsed = new Date(addedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDistanceToNow(parsed, { addSuffix: true });
};

export function JellyfinLatestShelf({ enabled, isLoading, items }: JellyfinLatestShelfProps) {
  const { t } = useTranslation('common');

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-700/80 bg-gradient-to-br from-[#0f172a] via-[#112240] to-[#1f2937] p-6 md:p-8 shadow-xl">
      <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-20 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">{t('dashboard.jellyfin.kicker')}</p>
          <h3 className="text-2xl md:text-3xl font-bold text-white">{t('dashboard.jellyfin.title')}</h3>
          <p className="text-sm text-blue-100/80 mt-1">{t('dashboard.jellyfin.subtitle')}</p>
        </div>
        <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-2xl">
          🍿
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/15 bg-black/20 p-4 space-y-3">
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </div>
      ) : !enabled ? (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">
          <p className="font-medium">{t('dashboard.jellyfin.notConnectedTitle')}</p>
          <p className="text-sm text-amber-100/90 mt-1">{t('dashboard.jellyfin.notConnectedDescription')}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/20 bg-black/20 p-6 text-center">
          <p className="text-white font-medium">{t('dashboard.jellyfin.emptyTitle')}</p>
          <p className="text-sm text-blue-100/80 mt-1">{t('dashboard.jellyfin.emptyDescription')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item, index) => {
            const typeConfig = getTypeConfig(item.item_type);
            const relativeTime = formatRelativeTime(item.added_at);
            const cardContent = (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-2xl">{typeConfig.emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate">{item.title}</p>
                  {item.subtitle ? <p className="mt-1 text-sm text-blue-100/85 truncate">{item.subtitle}</p> : null}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${typeConfig.badgeClass}`}>
                      {formatItemType(item.item_type)}
                    </span>
                    {item.year ? <span className="text-xs text-blue-100/80">{item.year}</span> : null}
                  </div>
                  {relativeTime ? <p className="mt-2 text-xs text-blue-100/75">{relativeTime}</p> : null}
                </div>
              </div>
            );

            return (
              item.item_url ? (
                <a
                  key={`${item.id}-${index}`}
                  href={item.item_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 block"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {cardContent}
                </a>
              ) : (
                <article
                  key={`${item.id}-${index}`}
                  className="group rounded-2xl border border-white/15 bg-black/25 p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-black/35"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {cardContent}
                </article>
              )
            );
          })}
        </div>
      )}
    </section>
  );
}
