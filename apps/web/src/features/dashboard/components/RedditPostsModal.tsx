import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardRedditInfinite } from '@hously/shared';
import { Dialog } from '../../../components/dialog';

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

interface RedditPostsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RedditPostsModal({ isOpen, onClose }: RedditPostsModalProps) {
  const { t } = useTranslation('common');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useDashboardRedditInfinite();

  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !isOpen) return;

    const observer = new IntersectionObserver(handleIntersect, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen, handleIntersect]);

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('dashboard.reddit.modalTitle')}>
      <div className="space-y-2 -mx-1">
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.permalink || post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 rounded-xl bg-neutral-100 dark:bg-neutral-700/50 p-3 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-white leading-snug line-clamp-2">
                {post.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">r/{post.subreddit}</span>
                <span>{formatNumber(post.score)} pts</span>
                <span>{t('dashboard.reddit.postedBy', { author: post.author })}</span>
                <span>{t('dashboard.reddit.comments', { count: post.num_comments })}</span>
                <span>{formatTimeAgo(post.created_utc)}</span>
              </div>
            </div>
            {post.thumbnail && (
              <img
                src={post.thumbnail}
                alt=""
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-neutral-200 dark:bg-neutral-600 self-center"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </a>
        ))}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-600 dark:border-t-neutral-300" />
          </div>
        )}
      </div>
    </Dialog>
  );
}
