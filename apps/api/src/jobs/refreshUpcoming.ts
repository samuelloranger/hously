import { prisma } from '../db';
import { normalizeTmdbConfig } from '../utils/plugins/normalizers';
import {
  collectTmdbUpcoming,
  fetchMovieReleaseDates,
  fetchTmdbProviders,
  fetchJellyfinTmdbIds,
  parseTmdbNumericId,
  toIsoDate,
  TMDB_UPCOMING_CACHE_KEY,
  TMDB_UPCOMING_CACHE_TTL_SECONDS,
  TMDB_POPULARITY_THRESHOLD,
} from '../utils/dashboard/tmdbUpcoming';
import { setJsonCache } from '../services/cache';
import { logActivity } from '../utils/activityLogs';
import type { DashboardUpcomingItem } from '../types/dashboardUpcoming';

let isRunning = false;

const JOB_ID = 'refreshUpcoming';
const JOB_NAME = 'Refresh upcoming releases';
const BATCH_SIZE = 10;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processBatch = async <T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    if (i > 0) await sleep(3000); // 3s between batches to respect TMDB rate limits
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
};

export const refreshUpcoming = async (options?: { trigger?: 'cron' | 'manual' }): Promise<void> => {
  const trigger = options?.trigger ?? 'cron';

  if (isRunning) {
    console.log(`[cron:upcoming] Already running, skipping (trigger: ${trigger})`);
    return;
  }

  isRunning = true;
  const startedAt = Date.now();

  try {
    const tmdbPlugin = await prisma.plugin.findFirst({
      where: { type: 'tmdb' },
      select: { enabled: true, config: true },
    });
    const tmdbApiKey = tmdbPlugin?.enabled ? normalizeTmdbConfig(tmdbPlugin.config)?.api_key : null;

    if (!tmdbApiKey) {
      console.log('[cron:upcoming] TMDB plugin not configured, skipping');
      return;
    }

    const today = new Date();
    const todayIso = toIsoDate(today);
    const oneYearOut = new Date(Date.UTC(today.getUTCFullYear() + 1, today.getUTCMonth(), today.getUTCDate()));
    const oneYearOutIso = toIsoDate(oneYearOut);

    const POOL_SIZE_PER_TYPE = 60;
    const [moviesResult, tvResult, jellyfinIds] = await Promise.all([
      collectTmdbUpcoming('movie', POOL_SIZE_PER_TYPE, tmdbApiKey, todayIso, oneYearOutIso),
      collectTmdbUpcoming('tv', POOL_SIZE_PER_TYPE, tmdbApiKey, todayIso, oneYearOutIso),
      fetchJellyfinTmdbIds(),
    ]);

    if (!moviesResult || !tvResult) {
      console.error('[cron:upcoming] TMDB discover request failed');
      await logActivity({
        type: 'cron_job_ended',
        payload: {
          job_id: JOB_ID,
          job_name: JOB_NAME,
          success: false,
          duration_ms: Date.now() - startedAt,
          trigger,
          message: 'TMDB discover request failed',
        },
      });
      return;
    }

    // Filter by popularity threshold
    const filteredMovies = moviesResult.items.filter(item => (item.popularity ?? 0) >= TMDB_POPULARITY_THRESHOLD);
    const filteredTv = tvResult.items.filter(item => (item.popularity ?? 0) >= TMDB_POPULARITY_THRESHOLD);

    console.log(
      `[cron:upcoming] After popularity filter: ${filteredMovies.length} movies, ${filteredTv.length} TV shows ` +
        `(from ${moviesResult.items.length} / ${tvResult.items.length})`
    );

    // Enrich movies with accurate digital release dates (batches of 10)
    const enrichedMovies = await processBatch(filteredMovies, BATCH_SIZE, async movie => {
      const numericId = parseTmdbNumericId(movie.id);
      if (!numericId) return movie;

      const digitalDate = await fetchMovieReleaseDates(numericId, tmdbApiKey);
      if (digitalDate) {
        return { ...movie, release_date: digitalDate };
      }
      return movie;
    });

    // Combine, filter by valid date range, exclude items already in Jellyfin
    const allItems = [...enrichedMovies, ...filteredTv].filter(item => {
      if (!item.release_date) return false;
      const releaseTime = Date.parse(item.release_date);
      const todayTime = Date.parse(todayIso);
      const oneYearOutTime = Date.parse(oneYearOutIso);
      return Number.isFinite(releaseTime) && releaseTime >= todayTime && releaseTime <= oneYearOutTime;
    });

    const itemsNotInJellyfin = allItems.filter(item => {
      const numericId = parseTmdbNumericId(item.id);
      return numericId ? !jellyfinIds.has(numericId) : true;
    });

    const sortedItems = itemsNotInJellyfin.sort((a, b) => {
      const aTime = a.release_date ? Date.parse(a.release_date) : Number.POSITIVE_INFINITY;
      const bTime = b.release_date ? Date.parse(b.release_date) : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    // Fetch providers (batches of 10)
    const itemsWithProviders = await processBatch(sortedItems, BATCH_SIZE, async item => {
      const tmdbId = parseTmdbNumericId(item.id);
      if (!tmdbId) return item;
      const providers = await fetchTmdbProviders(item.media_type, tmdbId, tmdbApiKey);
      return { ...item, providers };
    });

    // Strip internal-only fields before caching
    const cacheItems: DashboardUpcomingItem[] = itemsWithProviders.map(({ popularity: _, ...rest }) => rest);

    const responsePayload = { enabled: true, items: cacheItems };
    await setJsonCache(TMDB_UPCOMING_CACHE_KEY, responsePayload, TMDB_UPCOMING_CACHE_TTL_SECONDS);

    console.log(`[cron:upcoming] Cached ${cacheItems.length} upcoming items`);
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: JOB_ID,
        job_name: JOB_NAME,
        success: true,
        duration_ms: Date.now() - startedAt,
        trigger,
        message: `Cached ${cacheItems.length} items`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron:upcoming] Failed:', message);
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: JOB_ID,
        job_name: JOB_NAME,
        success: false,
        duration_ms: Date.now() - startedAt,
        trigger,
        message,
      },
    });
  } finally {
    isRunning = false;
  }
};
