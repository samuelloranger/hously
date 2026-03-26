import { prisma } from '../db';
import { normalizeTrackerConfig } from '../utils/plugins/normalizers';
import { cacheKey } from '../utils/dashboard/trackers';
import { setJsonCache } from '../services/cache';
import { TRACKER_SCRAPERS } from '../services/trackers';
import type { TrackerType } from '../utils/plugins/types';
import { logActivity } from '../utils/activityLogs';
import { decrypt } from '../services/crypto';
import { sendApnNotifications } from '../utils/apnPush';
import type { FlareSolverrCookie, FlareSolverrSolution } from '../services/trackers/httpScraper';

/** Runtime guard for the FlareSolverr JSON response. Throws on invalid shape. */
function validateFlareSolverrResponse(data: unknown, trackerLabel: string): { solution: FlareSolverrSolution } {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error(`${trackerLabel} FlareSolverr response is not an object`);
  const obj = data as Record<string, unknown>;
  const sol = obj.solution;
  if (!sol || typeof sol !== 'object' || Array.isArray(sol))
    throw new Error(`${trackerLabel} FlareSolverr response missing solution`);
  const s = sol as Record<string, unknown>;
  if (typeof s.userAgent !== 'string' || !s.userAgent)
    throw new Error(`${trackerLabel} FlareSolverr response missing solution.userAgent`);
  if (!Array.isArray(s.cookies))
    throw new Error(`${trackerLabel} FlareSolverr response missing solution.cookies array`);
  const cookies: FlareSolverrCookie[] = (s.cookies as unknown[]).map((c, i) => {
    if (!c || typeof c !== 'object' || Array.isArray(c))
      throw new Error(`${trackerLabel} FlareSolverr cookie[${i}] is not an object`);
    const cookie = c as Record<string, unknown>;
    if (typeof cookie.name !== 'string') throw new Error(`${trackerLabel} FlareSolverr cookie[${i}].name missing`);
    if (typeof cookie.value !== 'string') throw new Error(`${trackerLabel} FlareSolverr cookie[${i}].value missing`);
    if (typeof cookie.domain !== 'string') throw new Error(`${trackerLabel} FlareSolverr cookie[${i}].domain missing`);
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: typeof cookie.path === 'string' ? cookie.path : '/',
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure),
    };
  });
  const response = typeof s.response === 'string' ? s.response : undefined;
  return { solution: { userAgent: s.userAgent, cookies, response } };
}

const TRACKER_ORDER: TrackerType[] = ['torr9', 'c411', 'la-cale'];
const trackerName = (type: TrackerType): string => type.toUpperCase();

const sendTrackerWidgetRefreshSilentPush = async (): Promise<void> => {
  try {
    const pushTokens = await prisma.pushToken.findMany({
      where: { platform: 'ios' },
      select: { token: true },
    });

    const iosTokens = [...new Set(pushTokens.map(t => t.token).filter(Boolean))];
    if (iosTokens.length === 0) return;

    const { successCount, invalidTokens } = await sendApnNotifications(iosTokens, {
      contentAvailable: true,
      sound: null,
      data: { type: 'TRACKER_WIDGET_REFRESH' },
    });

    if (successCount > 0) {
      console.log(`[cron:trackers] sent widget refresh silent push to ${successCount} iOS devices`);
    }

    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } });
      console.log(`[cron:trackers] deleted ${invalidTokens.length} invalid APNs tokens`);
    }
  } catch (error) {
    console.error('[cron:trackers] failed to send widget refresh silent push:', error);
  }
};

export const fetchTrackerStats = async (
  trackerType: TrackerType,
  options?: { trigger?: 'cron' | 'manual' | 'plugin' | 'queue' }
): Promise<{ uploadedGo: number | null; downloadedGo: number | null; ratio: number | null } | void> => {
  const trigger = options?.trigger ?? 'cron';
  const jobId = `fetch${trackerName(trackerType)}Stats`;
  const jobName = `Fetch ${trackerName(trackerType)} stats`;
  const startedAt = Date.now();

  const endLog = async (success: boolean, message?: string) => {
    await logActivity({
      type: 'cron_job_ended',
      payload: { job_id: jobId, job_name: jobName, success, duration_ms: Date.now() - startedAt, trigger, message },
    });
  };

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

    const config = normalizeTrackerConfig(plugin.config);
    if (!config) {
      console.log(`[warn] ${trackerName(trackerType)} plugin config is invalid, skipping stats fetch`);
      await logActivity({
        type: 'cron_job_skipped',
        payload: { job_id: jobId, job_name: jobName, reason: 'invalid_config', trigger },
      });
      return;
    }

    const loginConfig = config.password ? { ...config, password: decrypt(config.password) } : config;

    let solution: FlareSolverrSolution | undefined;

    if (scraper.needsFlaresolverr !== false) {
      if (!config.flaresolverr_url) {
        console.log(`[warn] ${trackerName(trackerType)} plugin config missing flaresolverr_url, skipping stats fetch`);
        await logActivity({
          type: 'cron_job_skipped',
          payload: { job_id: jobId, job_name: jobName, reason: 'missing_flaresolverr_url', trigger },
        });
        return;
      }

      const fsRes = await fetch(config.flaresolverr_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'request.get', url: config.tracker_url, maxTimeout: 60000 }),
      });
      const fsRaw = await fsRes.json();
      const fsJson = validateFlareSolverrResponse(fsRaw, trackerName(trackerType));
      if (!fsRes.ok) {
        throw new Error(`${trackerName(trackerType)} FlareSolverr request failed`);
      }
      solution = fsJson.solution;
    }

    const stats = await scraper.scrape(loginConfig, solution);
    console.log(`[cron:${trackerType}] stats`, stats);

    const now = new Date();

    await setJsonCache(
      cacheKey(trackerType),
      {
        uploaded_go: stats.uploadedGo,
        downloaded_go: stats.downloadedGo,
        ratio: stats.ratio,
        updated_at: now.toISOString(),
      },
      60 * 60 * 24
    );

    await endLog(true);
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await endLog(false, message);
    throw error;
  }
};

export const fetchAllTrackerStats = async (options?: {
  trigger?: 'cron' | 'manual' | 'plugin' | 'queue';
}): Promise<void> => {
  const trigger = options?.trigger ?? 'cron';
  const startedAt = Date.now();

  try {
    for (const trackerType of TRACKER_ORDER) {
      try {
        await fetchTrackerStats(trackerType, { trigger });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[cron:${trackerType}] fetch failed in batch run:`, message);
      }
    }

    if (trigger === 'cron') {
      await sendTrackerWidgetRefreshSilentPush();
    }

    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: 'fetchAllTrackerStats',
        job_name: 'Fetch all tracker stats',
        success: true,
        duration_ms: Date.now() - startedAt,
        trigger,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await logActivity({
      type: 'cron_job_ended',
      payload: {
        job_id: 'fetchAllTrackerStats',
        job_name: 'Fetch all tracker stats',
        success: false,
        duration_ms: Date.now() - startedAt,
        trigger,
        message,
      },
    });
    throw error;
  }
};
