import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prisma } from '../db';
import { normalizeTrackerConfig } from '../utils/plugins/normalizers';
import { cacheKey } from '../utils/dashboard/trackers';
import { setJsonCache } from '../services/cache';
import { TRACKER_SCRAPERS } from '../services/trackers';
import type { TrackerType } from '../utils/plugins/types';
import { logActivity } from '../utils/activityLogs';

const runningByTracker: Partial<Record<TrackerType, boolean>> = {};

const isTruthyEnv = (value: string | undefined): boolean => {
  if (!value) return false;
  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'y':
    case 'on':
      return true;
    default:
      return false;
  }
};

const trackerName = (type: TrackerType): string => type.toUpperCase();

export const fetchTrackerStats = async (
  trackerType: TrackerType,
  options?: { trigger?: 'cron' | 'manual' | 'plugin' }
): Promise<{ uploadedGo: number | null; downloadedGo: number | null; ratio: number | null } | void> => {
  const trigger = options?.trigger ?? 'cron';
  const jobId = `fetch${trackerName(trackerType)}TopPanelStats`;
  const jobName = `Fetch ${trackerName(trackerType)} top panel stats`;
  const startedAt = Date.now();

  if (runningByTracker[trackerType]) {
    await logActivity({
      type: 'cron_job_skipped',
      payload: {
        job_id: jobId,
        job_name: jobName,
        reason: 'already_running',
        trigger,
      },
    });
    return;
  }
  runningByTracker[trackerType] = true;

  const endLog = async (success: boolean, message?: string) => {
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: jobId,
        job_name: jobName,
        success,
        duration_ms: Date.now() - startedAt,
        trigger,
        message,
      },
    });
  };

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    const scraper = TRACKER_SCRAPERS[trackerType];
    if (!scraper) {
      await logActivity({
        type: 'cron_job_skipped',
        payload: { job_id: jobId, job_name: jobName, reason: 'scraper_not_implemented', trigger },
      });
      return;
    }

    const plugin = await prisma.plugin.findFirst({ where: { type: trackerType } });
    if (!plugin || !plugin.enabled) {
      console.log(`[warn] ${trackerName(trackerType)} plugin not found or disabled, skipping stats fetch`);
      await logActivity({
        type: 'cron_job_skipped',
        payload: {
          job_id: jobId,
          job_name: jobName,
          reason: !plugin ? 'plugin_missing' : 'plugin_disabled',
          trigger,
        },
      });
      return;
    }

    const config = normalizeTrackerConfig(trackerType, plugin.config);
    if (!config) {
      console.log(`[warn] ${trackerName(trackerType)} plugin config is invalid, skipping stats fetch`);
      await logActivity({
        type: 'cron_job_skipped',
        payload: { job_id: jobId, job_name: jobName, reason: 'invalid_config', trigger },
      });
      return;
    }

    if (!config.flaresolverr_url) {
      console.log(`[warn] ${trackerName(trackerType)} plugin config missing flaresolverr_url, skipping stats fetch`);
      await logActivity({
        type: 'cron_job_skipped',
        payload: { job_id: jobId, job_name: jobName, reason: 'missing_flaresolverr_url', trigger },
      });
      return;
    }

    const trackerUpper = trackerType.toUpperCase();
    const storageStatePath =
      process.env[`${trackerUpper}_STORAGE_STATE_PATH`]?.trim() ||
      (trackerType === 'ygg' ? process.env.YGG_STORAGE_STATE_PATH?.trim() : '') ||
      `.artifacts/${trackerType}/storageState.json`;
    const storageStatePathAbs = resolve(process.cwd(), storageStatePath);

    const headless = !isTruthyEnv(
      process.env[`${trackerUpper}_HEADED`] || (trackerType === 'ygg' ? process.env.YGG_HEADED : undefined)
    );

    const fsRes = await fetch(config.flaresolverr_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'request.get',
        url: config.tracker_url,
        maxTimeout: 60000,
      }),
    });
    const fsJson = (await fsRes.json()) as { solution?: { userAgent?: string; cookies?: any[] } };
    if (!fsRes.ok || !fsJson.solution?.userAgent || !Array.isArray(fsJson.solution.cookies)) {
      throw new Error(`${trackerName(trackerType)} flaresolverr request failed`);
    }

    browser = await chromium.launch({ headless });
    const context = await browser.newContext({ userAgent: fsJson.solution.userAgent });
    await context.addCookies(
      fsJson.solution.cookies.map((cookie: any) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: 'Lax' as const,
      }))
    );
    const page = await context.newPage();

    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (resourceType === 'image' || resourceType === 'font') return route.abort();
      return route.continue();
    });

    await page.goto(config.tracker_url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});

    await scraper.login(page, config);

    await mkdir(dirname(storageStatePathAbs), { recursive: true }).catch(() => {});
    await context.storageState({ path: storageStatePathAbs }).catch(() => {});

    const stats = await scraper.getStats(page);
    console.log(`[cron:${trackerType}] top panel stats`, stats);

    await setJsonCache(
      cacheKey(trackerType),
      {
        uploaded_go: stats.uploadedGo,
        downloaded_go: stats.downloadedGo,
        ratio: stats.ratio,
        updated_at: new Date().toISOString(),
      },
      60 * 60 * 24
    );

    await endLog(true);
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await endLog(false, message);
    throw error;
  } finally {
    await browser?.close().catch(() => {});
    runningByTracker[trackerType] = false;
  }
};
