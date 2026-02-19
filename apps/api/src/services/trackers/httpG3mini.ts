import { parse } from 'node-html-parser';
import type { TrackerPluginConfig } from '../../utils/plugins/types';
import { CookieJar, httpFetch, type FlareSolverrSolution, type HttpTrackerStats } from './httpScraper';
import { parseNumber } from './utils';

// G3mini reports sizes in binary units (1 GiB = 1,073,741,824 bytes).
// NOTE: differs from C411/Torr9 which use decimal GB.
const parseSizeToGo = (text: string): number | null => {
  const normalized = text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(',', '.');

  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|Ko|Mo|Go|To)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  switch (match[2].toLowerCase()) {
    case 'kib':
    case 'kb':
    case 'ko':
      return value / 1024 / 1024;
    case 'mib':
    case 'mb':
    case 'mo':
      return value / 1024;
    case 'gib':
    case 'gb':
    case 'go':
      return value;
    case 'tib':
    case 'tb':
    case 'to':
      return value * 1024;
    default:
      return null;
  }
};

/**
 * G3mini is a Laravel app with a traditional form POST.
 * The login form has anti-bot measures:
 *   - `_captcha` (hidden, encrypted challenge) — must be submitted
 *   - A randomly-named hidden field with a timestamp — must be submitted
 *   - `_username` (visible text input) — honeypot that must remain EMPTY
 * We submit all hidden fields + credentials, but explicitly clear the _username honeypot.
 */
export async function scrapeG3mini(
  config: TrackerPluginConfig,
  solution?: FlareSolverrSolution
): Promise<HttpTrackerStats> {
  if (!solution) throw new Error('G3mini scraper requires FlareSolverr solution');

  const jar = new CookieJar();
  jar.init(solution.cookies);

  // Step 1: GET login page to get the CSRF token, captcha challenge, and form action.
  const { html: loginHtml, finalUrl: loginFinalUrl } = await httpFetch(config.tracker_url, {
    jar,
    userAgent: solution.userAgent,
  });

  const loginRoot = parse(loginHtml);
  const form = loginRoot.querySelector('form.auth-form__form');
  if (!form) throw new Error(`G3mini: login form not found (form.auth-form__form) on ${config.tracker_url}`);

  // Step 2: Collect ALL hidden fields (CSRF token, captcha challenge, timestamp field).
  const body = new URLSearchParams();
  for (const input of form.querySelectorAll('input[type="hidden"]')) {
    const name = input.getAttribute('name');
    const value = input.getAttribute('value') ?? '';
    if (name) body.set(name, value);
  }

  // Step 3: Add credentials and explicitly set honeypot to empty.
  body.set('username', config.username);
  body.set('password', config.password ?? '');
  body.set('_username', ''); // Honeypot field — must remain empty

  // Resolve form action against the final URL (after any redirects).
  const action = form.getAttribute('action') || '';
  const formActionUrl = new URL(action, loginFinalUrl).href;

  // Include CSRF headers from cookies (XSRF-TOKEN double-submit) + Referer.
  const csrfHeaders = jar.csrfHeaders();
  console.log(`[g3mini-http] POST ${formActionUrl} (fields: ${[...body.keys()].join(', ')})`);

  const result = await httpFetch(formActionUrl, {
    method: 'POST',
    body: body.toString(),
    contentType: 'application/x-www-form-urlencoded',
    extraHeaders: {
      ...csrfHeaders,
      Referer: loginFinalUrl,
      Origin: new URL(loginFinalUrl).origin,
    },
    jar,
    userAgent: solution.userAgent,
  });
  console.log(`[g3mini-http] POST → ${result.status} (final: ${result.finalUrl}, ${result.html.length} bytes)`);

  // After login, the page may redirect. If empty body, fetch homepage.
  let html = result.html;
  if (!html.trim()) {
    const homeUrl = new URL('/', loginFinalUrl).href;
    console.log(`[g3mini-http] login returned empty body, fetching homepage: ${homeUrl}`);
    const homePage = await httpFetch(homeUrl, { jar, userAgent: solution.userAgent });
    html = homePage.html;
  }

  const root = parse(html);

  // Stats are in the ratio bar nav, rendered server-side on every authenticated page.
  const uploadedEl = root.querySelector('li.ratio-bar__uploaded a');
  const downloadedEl = root.querySelector('li.ratio-bar__downloaded a');
  const ratioEl = root.querySelector('li.ratio-bar__ratio a');

  if (!uploadedEl && !downloadedEl && !ratioEl) {
    const loginFormStillPresent = root.querySelector('form.auth-form__form');
    throw new Error(
      loginFormStillPresent
        ? 'G3mini HTTP login failed: login form still present after submit'
        : 'G3mini HTTP login failed: no stats elements found on post-login page'
    );
  }

  return {
    uploadedGo: uploadedEl ? parseSizeToGo(uploadedEl.textContent) : null,
    downloadedGo: downloadedEl ? parseSizeToGo(downloadedEl.textContent) : null,
    ratio: ratioEl ? parseNumber(ratioEl.textContent) : null,
  };
}
