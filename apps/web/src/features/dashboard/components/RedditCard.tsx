import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardReddit } from '@hously/shared';
import { RedditPostsModal } from './RedditPostsModal';

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

const formatNumber = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export function RedditCard() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useDashboardReddit();
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) return null;
  if (!data?.enabled) return null;

  const posts = (data.posts ?? []).slice(0, 5);

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-orange-500/60 dark:border-orange-400/40 bg-gradient-to-br from-[#ff6314]/90 via-[#ff4500] to-[#cc3700] dark:from-[#7c2d00] dark:via-[#8b3500] dark:to-[#6b2a00] p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/70">
              {t('dashboard.reddit.kicker')}
            </p>
            <h3 className="text-2xl md:text-3xl font-bold text-white">
              {t('dashboard.reddit.title')}
            </h3>
            <p className="text-sm text-white/75 mt-1">
              {t('dashboard.reddit.subtitle')}
            </p>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/30 bg-white/15 p-4 text-white">
            <p className="font-medium">{t('dashboard.reddit.emptyTitle')}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {posts.map((post) => (
              <a
                key={post.id}
                href={post.permalink || post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-xl bg-black/15 dark:bg-black/25 p-3 hover:bg-black/25 dark:hover:bg-black/35 transition-colors"
              >
                {post.thumbnail && (
                  <img
                    src={post.thumbnail}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-black/20"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                    {post.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/65">
                    <span className="font-medium text-white/80">r/{post.subreddit}</span>
                    <span>{formatNumber(post.score)} pts</span>
                    <span>{t('dashboard.reddit.postedBy', { author: post.author })}</span>
                    <span>{t('dashboard.reddit.comments', { count: post.num_comments })}</span>
                    <span>{formatTimeAgo(post.created_utc)}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {posts.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-4 w-full rounded-xl bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20 text-white text-sm font-medium py-2.5 transition-colors"
          >
            {t('dashboard.reddit.viewMore')}
          </button>
        )}
      </section>

      <RedditPostsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
