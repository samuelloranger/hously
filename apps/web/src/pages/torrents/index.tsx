import { createFileRoute, redirect } from "@tanstack/react-router";
import type {
  QbittorrentSortDir,
  QbittorrentSortKey,
  QbittorrentStateFilter,
} from "@hously/shared/utils";
import { getCurrentUser } from "@/lib/auth";
import { prefetchRouteData } from "@/lib/routing/prefetch";
import { TorrentsPage } from "@/pages/torrents/_component/index";

export type TorrentsSearchParams = {
  search?: string;
  state?: QbittorrentStateFilter;
  categories?: string[];
  tags?: string[];
  sortBy?: QbittorrentSortKey;
  sortDir?: QbittorrentSortDir;
  page?: number;
};

const QBITTORRENT_STATE_FILTER_VALUES = new Set<QbittorrentStateFilter>([
  "all",
  "downloading",
  "uploading",
  "seeding",
  "paused",
  "complete",
  "stalled",
  "error",
]);

const QBITTORRENT_SORT_KEY_VALUES = new Set<QbittorrentSortKey>([
  "name",
  "ratio",
  "added_on",
  "size",
  "download_speed",
  "upload_speed",
]);

const QBITTORRENT_SORT_DIR_VALUES = new Set<QbittorrentSortDir>([
  "asc",
  "desc",
]);

const parseOptionalStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const parsed = value.filter(
      (e): e is string => typeof e === "string" && e.length > 0,
    );
    return parsed.length > 0 ? parsed : undefined;
  }
  if (typeof value === "string" && value.length > 0) return [value];
  return undefined;
};

const parsePage = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1)
    return Math.floor(value);
  if (typeof value === "string" && value.length > 0) {
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return undefined;
};

export const Route = createFileRoute("/torrents/")({
  validateSearch: (search: Record<string, unknown>): TorrentsSearchParams => ({
    search:
      typeof search.search === "string" && search.search
        ? search.search
        : undefined,
    state:
      typeof search.state === "string" &&
      QBITTORRENT_STATE_FILTER_VALUES.has(
        search.state as QbittorrentStateFilter,
      )
        ? (search.state as QbittorrentStateFilter)
        : undefined,
    categories: parseOptionalStringArray(search.categories),
    tags: parseOptionalStringArray(search.tags),
    sortBy:
      typeof search.sortBy === "string" &&
      QBITTORRENT_SORT_KEY_VALUES.has(search.sortBy as QbittorrentSortKey)
        ? (search.sortBy as QbittorrentSortKey)
        : undefined,
    sortDir:
      typeof search.sortDir === "string" &&
      QBITTORRENT_SORT_DIR_VALUES.has(search.sortDir as QbittorrentSortDir)
        ? (search.sortDir as QbittorrentSortDir)
        : undefined,
    page: parsePage(search.page),
  }),
  beforeLoad: async () => {
    try {
      const user = await getCurrentUser();
      if (!user) throw redirect({ to: "/login" });
      return { user };
    } catch (e: unknown) {
      if ((e as { status?: number })?.status === 429) return { user: null };
      throw e;
    }
  },
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, "/torrents");
  },
  component: TorrentsPage,
});
