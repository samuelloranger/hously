import { prisma } from "../../db";
import { normalizeRedditConfig } from "../plugins/normalizers";

export const REDDIT_CACHE_TTL_SECONDS = 5 * 60;

const REDDIT_USER_AGENT = "Hously/1.0 (self-hosted dashboard)";

const THUMBNAIL_SENTINELS = new Set([
  "self",
  "default",
  "nsfw",
  "spoiler",
  "image",
  "",
]);

export interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  url: string;
  permalink: string;
  created_utc: number;
  num_comments: number;
  subreddit: string;
  thumbnail: string | null;
  is_self: boolean;
}

export interface DashboardRedditResponse {
  enabled: boolean;
  posts: RedditPost[];
  subreddits: string[];
  after: string | null;
  updated_at: string;
  error?: string;
}

const buildDisabledResponse = (error?: string): DashboardRedditResponse => ({
  enabled: false,
  posts: [],
  subreddits: [],
  after: null,
  updated_at: new Date().toISOString(),
  ...(error ? { error } : {}),
});

export const fetchRedditPosts = async (
  afterCursor?: string,
): Promise<DashboardRedditResponse> => {
  const plugin = await prisma.plugin.findFirst({
    where: { type: "reddit" },
    select: { enabled: true, config: true },
  });

  if (!plugin?.enabled) {
    return buildDisabledResponse();
  }

  const config = normalizeRedditConfig(plugin.config);
  const subreddits = config.subreddits;

  try {
    const joined = subreddits.join("+");
    const params = new URLSearchParams({
      limit: "25",
      raw_json: "1",
    });
    if (afterCursor) {
      params.set("after", afterCursor);
    }

    const response = await fetch(
      `https://www.reddit.com/r/${joined}/hot.json?${params.toString()}`,
      {
        headers: { "User-Agent": REDDIT_USER_AGENT },
      },
    );

    if (!response.ok) {
      return {
        ...buildDisabledResponse(
          `Reddit API returned status ${response.status}`,
        ),
        enabled: true,
        subreddits,
      };
    }

    const json = (await response.json()) as {
      data: {
        after: string | null;
        children: Array<{
          data: {
            id?: string;
            title?: string;
            author?: string;
            score?: number;
            url?: string;
            permalink?: string;
            created_utc?: number;
            num_comments?: number;
            subreddit?: string;
            thumbnail?: string;
            is_self?: boolean;
          };
        }>;
      };
    };

    const posts: RedditPost[] = json.data.children
      .map((child) => {
        const d = child.data;
        if (!d.id || !d.title) return null;

        const rawThumb = d.thumbnail ?? "";
        const thumbnail =
          !THUMBNAIL_SENTINELS.has(rawThumb) && rawThumb.startsWith("http")
            ? rawThumb
            : null;

        return {
          id: d.id,
          title: d.title,
          author: d.author || "[deleted]",
          score: d.score || 0,
          url: d.url || "",
          permalink: d.permalink ? `https://www.reddit.com${d.permalink}` : "",
          created_utc: d.created_utc || 0,
          num_comments: d.num_comments || 0,
          subreddit: d.subreddit || "",
          thumbnail,
          is_self: Boolean(d.is_self),
        } satisfies RedditPost;
      })
      .filter((p): p is RedditPost => p !== null);

    return {
      enabled: true,
      posts,
      subreddits,
      after: json.data.after,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching Reddit posts:", error);
    return {
      ...buildDisabledResponse("Failed to fetch Reddit posts"),
      enabled: true,
      subreddits,
    };
  }
};

export interface RedditSubredditSearchResult {
  name: string;
  title: string;
  icon: string | null;
  subscribers: number;
}

export const searchSubreddits = async (
  query: string,
): Promise<RedditSubredditSearchResult[]> => {
  const params = new URLSearchParams({
    q: query,
    limit: "10",
    raw_json: "1",
  });

  const response = await fetch(
    `https://www.reddit.com/subreddits/search.json?${params.toString()}`,
    {
      headers: { "User-Agent": REDDIT_USER_AGENT },
    },
  );

  if (!response.ok) {
    throw new Error(`Reddit search returned status ${response.status}`);
  }

  const json = (await response.json()) as {
    data: {
      children: Array<{
        data: {
          display_name?: string;
          title?: string;
          icon_img?: string;
          community_icon?: string;
          subscribers?: number;
        };
      }>;
    };
  };

  return json.data.children
    .map((child) => {
      const d = child.data;
      if (!d.display_name) return null;

      // Prefer community_icon, fall back to icon_img. Strip URL-encoded query params from community_icon.
      const communityIcon = d.community_icon
        ? d.community_icon.split("?")[0].replace(/&amp;/g, "&")
        : "";
      const iconImg = d.icon_img || "";
      const icon = communityIcon || iconImg || null;

      return {
        name: d.display_name,
        title: d.title || d.display_name,
        icon,
        subscribers: d.subscribers || 0,
      } satisfies RedditSubredditSearchResult;
    })
    .filter((r): r is RedditSubredditSearchResult => r !== null);
};
