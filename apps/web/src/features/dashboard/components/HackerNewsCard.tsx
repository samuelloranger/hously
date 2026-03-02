import { useTranslation } from 'react-i18next';
import { useDashboardHackerNews } from '@hously/shared';

const formatTimeAgo = (unixTime: number): string => {
  const seconds = Math.floor(Date.now() / 1000 - unixTime);
  if (seconds < 60) return '<1m';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export function HackerNewsCard() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useDashboardHackerNews();

  if (isLoading) return null;
  if (!data?.enabled) return null;

  const stories = data.stories ?? [];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-orange-300/60 dark:border-orange-200/40 bg-gradient-to-br from-[#ffe0b2] via-[#ffcc80] to-[#ffb74d] dark:from-orange-800 dark:via-orange-700 dark:to-amber-700 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-orange-950/70 dark:text-orange-200/90">
            {t('dashboard.hackerNews.kicker')}
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-orange-950 dark:text-orange-50">
            {t('dashboard.hackerNews.title')}
          </h3>
          <p className="text-sm text-orange-900/70 dark:text-orange-100/90 mt-1">
            {t('dashboard.hackerNews.subtitle')}
          </p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-orange-950 dark:text-orange-100">
          {t(`dashboard.hackerNews.feedTypes.${data.feed_type}`)}
        </span>
      </div>

      {stories.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-orange-500/40 dark:border-orange-300/40 bg-orange-100/55 dark:bg-orange-100/15 p-4 text-orange-950 dark:text-orange-100">
          <p className="font-medium">{t('dashboard.hackerNews.emptyTitle')}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {stories.map((story) => (
            <a
              key={story.id}
              href={story.url || `https://news.ycombinator.com/item?id=${story.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-black/10 dark:bg-black/20 p-3 hover:bg-black/15 dark:hover:bg-black/30 transition-colors"
            >
              <p className="text-sm font-medium text-orange-950 dark:text-white leading-snug">
                {story.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-orange-900/75 dark:text-orange-200/80">
                <span>{t('dashboard.hackerNews.points', { count: story.score })}</span>
                <span>{t('dashboard.hackerNews.postedBy', { author: story.by })}</span>
                {story.type !== 'job' && (
                  <a
                    href={`https://news.ycombinator.com/item?id=${story.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t('dashboard.hackerNews.comments', { count: story.comment_count })}
                  </a>
                )}
                <span>{formatTimeAgo(story.time)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
