import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getYggTopPanelStats, loginToYgg } from '../services/ygg';
import { prisma } from '../db';
import { normalizeYggConfig } from '../utils/plugins/normalizers';
import { setJsonCache } from '../services/cache';
import { enqueueTask } from '../services/backgroundQueue';

let isRunning = false;

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

export const fetchYggTopPanelStats = async () => {
  if (isRunning) return;
  isRunning = true;

  const plugin = await prisma.plugin.findFirst({ where: { type: 'ygg' } });
  if (!plugin || !plugin.enabled) {
    console.warn('YGG plugin not found or disabled, skipping YGG top panel stats fetch');
    isRunning = false;
    return;
  }

  const config = normalizeYggConfig(plugin.config);
  if (!config) {
    console.warn('YGG plugin config is invalid, skipping YGG top panel stats fetch');
    isRunning = false;
    return;
  }
  if (!config.flaresolverr_url) {
    console.warn('YGG plugin config is missing flaresolverr_url, skipping YGG top panel stats fetch');
    isRunning = false;
    return;
  }

  const storageStatePath = process.env.YGG_STORAGE_STATE_PATH?.trim() || '.artifacts/ygg/storageState.json';
  const storageStatePathAbs = resolve(process.cwd(), storageStatePath);

  const headless = !isTruthyEnv(process.env.YGG_HEADED);

  const url = config.ygg_url;

  const fsRes = await fetch(config.flaresolverr_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: 'request.get',
      url,
      maxTimeout: 60000,
    }),
  });

  const { solution } = (await fsRes.json()) as { solution: { userAgent: string; cookies: any[] } };

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent: solution.userAgent,
  });
  await context.addCookies(
    solution.cookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: 'Lax',
    }))
  );
  const page = await context.newPage();

  try {
    await page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      if (resourceType === 'image' || resourceType === 'font') return route.abort();
      return route.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});

    const loginForm = page.locator('#login-form');

    await loginForm.waitFor({ state: 'visible', timeout: 15_000 });

    await loginToYgg(page, config, { timeoutMs: 30_000, force: true, skipNavigation: true });

    // Save cookies/localStorage for future runs (may help avoid re-login while the session is valid).
    await mkdir(resolve(process.cwd(), '.artifacts/ygg'), { recursive: true }).catch(() => {});
    await context.storageState({ path: storageStatePathAbs }).catch(() => {});

    const stats = await getYggTopPanelStats(page);
    console.log('[cron:ygg] top panel stats', stats);

    const cachedPayload = {
      uploaded_go: stats.uploadedGo,
      downloaded_go: stats.downloadedGo,
      ratio: stats.ratio,
      updated_at: new Date().toISOString(),
    };

    // Cache 24 hours
    enqueueTask('ygg:setCache', async () => {
      await setJsonCache('yggTopPanelStats', cachedPayload, 60 * 60 * 24);
    });
    return stats;
  } finally {
    await browser.close().catch(() => {});
    isRunning = false;
  }
};
