import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHackernewsPlugin, useUpdateHackernewsPlugin } from '@hously/shared';
import { toast } from 'sonner';
import { PluginSectionCard } from './PluginSectionCard';

type FeedType = 'top' | 'best' | 'new' | 'ask' | 'show' | 'job';

export function HackernewsPluginSection() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useHackernewsPlugin();
  const saveMutation = useUpdateHackernewsPlugin();

  const [feedType, setFeedType] = useState<FeedType>('top');
  const [storyCount, setStoryCount] = useState(10);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!data?.plugin) return;
    setFeedType(data.plugin.feed_type || 'top');
    setStoryCount(data.plugin.story_count || 10);
    setEnabled(Boolean(data.plugin.enabled));
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      feedType !== (data.plugin.feed_type || 'top') ||
      storyCount !== (data.plugin.story_count || 10) ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [data, feedType, storyCount, enabled]);

  const handleCancel = () => {
    setFeedType(data?.plugin.feed_type || 'top');
    setStoryCount(data?.plugin.story_count || 10);
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({ feed_type: feedType, story_count: storyCount, enabled })
      .then(() => toast.success(t('settings.plugins.saveSuccess')))
      .catch(() => toast.error(t('settings.plugins.saveError')));
  };

  return (
    <PluginSectionCard
      title="Hacker News"
      description={t('settings.plugins.hackernews.help')}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.hackernews.feedType')}
        </label>
        <select
          value={feedType}
          onChange={event => setFeedType(event.target.value as FeedType)}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        >
          <option value="top">{t('dashboard.hackerNews.feedTypes.top')}</option>
          <option value="best">{t('dashboard.hackerNews.feedTypes.best')}</option>
          <option value="new">{t('dashboard.hackerNews.feedTypes.new')}</option>
          <option value="ask">{t('dashboard.hackerNews.feedTypes.ask')}</option>
          <option value="show">{t('dashboard.hackerNews.feedTypes.show')}</option>
          <option value="job">{t('dashboard.hackerNews.feedTypes.job')}</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          {t('settings.plugins.hackernews.storyCount')}
        </label>
        <input
          type="number"
          min={1}
          max={50}
          value={storyCount}
          onChange={event => setStoryCount(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
          className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
        />
      </div>
    </PluginSectionCard>
  );
}
