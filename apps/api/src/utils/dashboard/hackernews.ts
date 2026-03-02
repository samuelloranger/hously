import { prisma } from '../../db';
import { normalizeHackernewsConfig } from '../plugins/normalizers';
import type { HackernewsPluginConfig } from '../plugins/types';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

export const HN_CACHE_TTL_SECONDS = 5 * 60;

interface HnItem {
  id?: number;
  title?: string;
  url?: string;
  score?: number;
  by?: string;
  time?: number;
  descendants?: number;
  type?: string;
}

const feedEndpoint: Record<HackernewsPluginConfig['feed_type'], string> = {
  top: 'topstories',
  best: 'beststories',
  new: 'newstories',
  ask: 'askstories',
  show: 'showstories',
  job: 'jobstories',
};

export interface HackerNewsStory {
  id: number;
  title: string;
  url: string | null;
  score: number;
  by: string;
  time: number;
  comment_count: number;
  type: 'story' | 'job' | 'poll';
}

export interface DashboardHackerNewsResponse {
  enabled: boolean;
  stories: HackerNewsStory[];
  feed_type: string;
  updated_at: string;
  error?: string;
}

const buildDisabledResponse = (error?: string): DashboardHackerNewsResponse => ({
  enabled: false,
  stories: [],
  feed_type: 'top',
  updated_at: new Date().toISOString(),
  ...(error ? { error } : {}),
});

export const fetchHackerNewsStories = async (): Promise<DashboardHackerNewsResponse> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: 'hackernews' },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildDisabledResponse();
  }

  const config = normalizeHackernewsConfig(plugin.config);
  if (!config) {
    return {
      ...buildDisabledResponse('Hacker News plugin is enabled but not configured'),
      enabled: true,
    };
  }

  try {
    const endpoint = feedEndpoint[config.feed_type] || 'topstories';
    const idsResponse = await fetch(`${HN_API_BASE}/${endpoint}.json`);
    if (!idsResponse.ok) {
      return {
        ...buildDisabledResponse(`HN API returned status ${idsResponse.status}`),
        enabled: true,
      };
    }

    const allIds = (await idsResponse.json()) as number[];
    const ids = allIds.slice(0, config.story_count);

    const stories = await Promise.all(
      ids.map(async (id): Promise<HackerNewsStory | null> => {
        try {
          const itemResponse = await fetch(`${HN_API_BASE}/item/${id}.json`);
          if (!itemResponse.ok) return null;
          const item = (await itemResponse.json()) as HnItem;
          if (!item || !item.id || !item.title) return null;

          return {
            id: item.id,
            title: item.title,
            url: item.url || null,
            score: item.score || 0,
            by: item.by || 'unknown',
            time: item.time || 0,
            comment_count: item.descendants || 0,
            type: (item.type as HackerNewsStory['type']) || 'story',
          };
        } catch {
          return null;
        }
      })
    );

    return {
      enabled: true,
      stories: stories.filter((s): s is HackerNewsStory => s !== null),
      feed_type: config.feed_type,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching Hacker News stories:', error);
    return {
      ...buildDisabledResponse('Failed to fetch Hacker News stories'),
      enabled: true,
    };
  }
};
