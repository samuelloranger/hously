import type { TrackerPluginConfig } from '../../utils/plugins/types';
import type { HttpTrackerStats } from './httpScraper';

/**
 * La Cale has a straightforward JSON API
 * Login via /api/internal/auth/login, then fetch stats from /api/internal/me
 * using the session cookies returned by login.
 */
export async function scrapeLaCale(config: TrackerPluginConfig): Promise<HttpTrackerStats> {
  const trackerUrl = new URL(config.tracker_url);
  const apiBase = `${trackerUrl.protocol}//${trackerUrl.host}/api/internal`;

  console.log(`[la-cale-http] POST ${apiBase}/auth/login`);
  const loginRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Referer: config.tracker_url,
      Origin: trackerUrl.origin,
    },
    body: JSON.stringify({
      email: config.username,
      password: config.password ?? '',
    }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`LaCale API login failed: ${loginRes.status} — ${body.slice(0, 200)}`);
  }

  // Capture Set-Cookie headers from the login response to forward to /me
  const setCookies = loginRes.headers.getSetCookie();
  const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');
  console.log(`[la-cale-http] Login OK — got ${setCookies.length} Set-Cookie header(s)`);

  console.log(`[la-cale-http] GET ${apiBase}/me`);
  const meRes = await fetch(`${apiBase}/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Referer: config.tracker_url,
      Origin: trackerUrl.origin,
      Cookie: cookieHeader,
    },
  });

  if (!meRes.ok) {
    const body = await meRes.text();
    throw new Error(`LaCale API me failed: ${meRes.status} — ${body.slice(0, 200)}`);
  }

  const data = (await meRes.json()) as {
    avatar: string | null;
    bio: string | null;
    bonusPoints: number;
    countExpressed: string;
    downloaded: number;
    email: string;
    forceChangeUsername: boolean;
    id: string;
    newYearGiftClaimed: boolean;
    passkey: string;
    permissions: string[];
    ratio: number;
    role: string;
    seedingCount: number;
    showSensitiveContent: boolean;
    uploadStats: { approved: number; pending: number };
    uploaded: number;
    username: string;
  };
  const uploadedGo = typeof data.uploaded === 'number' ? data.uploaded / 1_000_000_000 : null;
  const downloadedGo = typeof data.downloaded === 'number' ? data.downloaded / 1_000_000_000 : null;
  const ratio =
    uploadedGo !== null && downloadedGo !== null && downloadedGo > 0
      ? Math.round((uploadedGo / downloadedGo) * 100) / 100
      : null;

  console.log(
    `[la-cale-http] me OK — up: ${uploadedGo?.toFixed(2)} Go, down: ${downloadedGo?.toFixed(2)} Go, ratio: ${ratio}`
  );

  return { uploadedGo, downloadedGo, ratio };
}
