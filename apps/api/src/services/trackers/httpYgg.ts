import { parse } from 'node-html-parser';
import type { TrackerPluginConfig } from '../../utils/plugins/types';
import { CookieJar, httpLogin, httpFetch, type FlareSolverrSolution, type HttpTrackerStats } from './httpScraper';

// YGG uses decimal French units (Ko, Mo, Go, To).
const parseSizeToGo = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, ' ').trim().replace(',', '.');
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(Ko|Mo|Go|To)\b/i);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  switch (match[2].toLowerCase()) {
    case 'ko':
      return value / 1_000_000;
    case 'mo':
      return value / 1_000;
    case 'go':
      return value;
    case 'to':
      return value * 1_000;
    default:
      return null;
  }
};

const parseNumber = (text: string): number | null => {
  const normalized = text.replace(/\s+/g, ' ').trim().replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
};

export async function scrapeYgg(
  config: TrackerPluginConfig,
  solution?: FlareSolverrSolution
): Promise<HttpTrackerStats> {
  if (!solution) throw new Error('Ygg scraper requires FlareSolverr solution');

  const jar = new CookieJar();
  jar.init(solution.cookies);

  // YGG uses field names "id" and "pass" (not "username"/"password").
  const { html: loginResponseHtml, finalUrl } = await httpLogin({
    loginPageUrl: config.tracker_url,
    formSelector: '#login-form',
    credentials: { id: config.username, pass: config.password ?? '' } satisfies Record<string, string>,
    jar,
    userAgent: solution.userAgent,
  });

  // YGG's login POST returns an empty body with session cookies set.
  // We need an additional GET to the homepage to fetch the actual page with stats.
  let html = loginResponseHtml;
  if (!html.trim()) {
    const homeUrl = new URL('/', finalUrl).href;
    console.log(`[ygg] login returned empty body, fetching homepage`);
    const homePage = await httpFetch(homeUrl, { jar, userAgent: solution.userAgent });
    html = homePage.html;
  }

  const root = parse(html);
  const topPanel = root.querySelector('#top_panel');

  if (!topPanel) {
    const title = root.querySelector('title')?.textContent ?? '(no title)';
    const loginFormStillPresent = root.querySelector('#login-form');
    console.error(`[ygg] post-login page title: ${title}`);
    throw new Error(
      loginFormStillPresent
        ? 'YGG HTTP login failed: login form still present after submit (captcha / invalid credentials?)'
        : `YGG HTTP login failed: #top_panel not found on post-login page (title: ${title})`
    );
  }

  // Upload: the element with class "ico_upload" lives inside a link whose full
  // text is something like "1.5 Go". We grab the parent's textContent.
  const icoUpload = topPanel.querySelector('.ico_upload');
  const uploadedText = icoUpload?.parentNode?.textContent ?? null;

  const icoDownload = topPanel.querySelector('.ico_download');
  const downloadedText = icoDownload?.parentNode?.textContent ?? null;

  // Ratio: find the <a> inside "ul li" whose text contains "ratio", then read
  // the <strong> child for the numeric value.
  const ratioLink = topPanel.querySelectorAll('ul li a').find(el => /ratio/i.test(el.textContent));
  const ratioText = ratioLink?.querySelector('strong')?.textContent ?? null;

  return {
    uploadedGo: uploadedText ? parseSizeToGo(uploadedText) : null,
    downloadedGo: downloadedText ? parseSizeToGo(downloadedText) : null,
    ratio: ratioText ? parseNumber(ratioText) : null,
  };
}
