import { parse } from 'node-html-parser';
import type { TrackerPluginConfig } from '../../utils/plugins/types';
import { CookieJar, httpFetch, type FlareSolverrSolution, type HttpTrackerStats } from './httpScraper';
import { parseNumber } from './utils';

// C411 reports sizes in decimal units (1 Go = 1,000,000,000 bytes).
const parseSizeToGo = (text: string): number | null => {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(',', '.');

  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(o|Ko|Mo|Go|To|B|KB|MB|GB|TB)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  switch (match[2].toLowerCase()) {
    case 'o':
    case 'b':
      return value / 1_000_000_000;
    case 'ko':
    case 'kb':
      return value / 1_000_000;
    case 'mo':
    case 'mb':
      return value / 1_000;
    case 'go':
    case 'gb':
      return value;
    case 'to':
    case 'tb':
      return value * 1_000;
    default:
      return null;
  }
};

export async function scrapeC411(
  config: TrackerPluginConfig,
  solution?: FlareSolverrSolution
): Promise<HttpTrackerStats> {
  if (!solution) throw new Error('C411 scraper requires FlareSolverr solution');

  const jar = new CookieJar();
  jar.init(solution.cookies);

  // Step 1: GET login page to obtain the CSRF token from a <meta> tag.
  const { html: loginHtml } = await httpFetch(config.tracker_url, { jar, userAgent: solution.userAgent });
  const loginRoot = parse(loginHtml);
  const csrfToken = loginRoot.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!csrfToken) throw new Error('C411: csrf-token meta tag not found on login page');

  // Step 2: C411 is a Nuxt.js SPA — login via the JSON API with the meta-tag CSRF token.
  const loginRes = await fetch(new URL('/api/auth/login', config.tracker_url).href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': solution.userAgent,
      Cookie: jar.serialize(),
      'csrf-token': csrfToken,
    },
    body: JSON.stringify({ username: config.username, password: config.password ?? '' }),
    redirect: 'manual',
  });
  jar.absorb(loginRes.headers);

  if (!loginRes.ok) {
    const body = await loginRes.text().catch(() => '');
    throw new Error(`C411 API login failed: ${loginRes.status} ${body.slice(0, 200)}`);
  }

  // Step 3: GET the homepage to get server-rendered stats in the topbar.
  const homeUrl = new URL('/', config.tracker_url).href;
  const { html } = await httpFetch(homeUrl, { jar, userAgent: solution.userAgent });
  const root = parse(html);

  const uploadedEl = root.querySelector('span[title="Uploaded"]');
  const downloadedEl = root.querySelector('span[title="Downloaded"]');
  const ratioEl = root.querySelector('span[title="Ratio (Upload ÷ Download)"]');

  if (!uploadedEl && !downloadedEl && !ratioEl) {
    const title = root.querySelector('title')?.textContent ?? '(no title)';
    throw new Error(`C411 HTTP scrape failed: no stats elements found (page title: ${title})`);
  }

  return {
    uploadedGo: uploadedEl ? parseSizeToGo(uploadedEl.textContent) : null,
    downloadedGo: downloadedEl ? parseSizeToGo(downloadedEl.textContent) : null,
    ratio: ratioEl ? parseNumber(ratioEl.textContent) : null,
  };
}
