/**
 * C411 session manager — authenticates and caches sessions.
 */

import { parse } from 'node-html-parser';
import { prisma } from '../../db';
import { decrypt } from '../crypto';
import { CookieJar, httpFetch } from '../trackers/httpScraper';
import type { FlareSolverrSolution } from '../trackers/httpScraper';
import type { C411Session } from './types';

let cachedSession: C411Session | null = null;
let sessionCreatedAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Load C411 plugin config from the database.
 */
async function loadC411Config() {
  const plugin = await prisma.plugin.findUnique({ where: { type: 'c411' } });
  if (!plugin?.enabled || !plugin.config) throw new Error('C411 plugin not configured or disabled');
  const config = plugin.config as Record<string, string>;
  if (!config.tracker_url || !config.username) throw new Error('C411 plugin missing tracker_url or username');
  return {
    trackerUrl: config.tracker_url,
    username: config.username,
    password: config.password ? decrypt(config.password) : '',
    flaresolverrUrl: config.flaresolverr_url || '',
    announceUrl: config.announce_url || '',
  };
}

/**
 * Call FlareSolverr to bypass Cloudflare protection.
 */
async function callFlareSolverr(flaresolverrUrl: string, trackerUrl: string): Promise<FlareSolverrSolution> {
  const res = await fetch(flaresolverrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url: trackerUrl, maxTimeout: 60000 }),
  });
  const data = await res.json() as any;
  if (!data?.solution?.userAgent || !Array.isArray(data?.solution?.cookies)) {
    throw new Error('C411 FlareSolverr response invalid');
  }
  return {
    userAgent: data.solution.userAgent,
    cookies: data.solution.cookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
    })),
  };
}

/**
 * Authenticate with C411 via CSRF token + JSON API login.
 */
async function loginC411(
  credentials: { trackerUrl: string; username: string; password: string },
  solution: FlareSolverrSolution,
): Promise<C411Session> {
  const jar = new CookieJar();
  jar.init(solution.cookies);

  // Step 1: GET the page to obtain the CSRF token from <meta> tag
  const { html: loginHtml } = await httpFetch(credentials.trackerUrl, {
    jar,
    userAgent: solution.userAgent,
  });
  const loginRoot = parse(loginHtml);
  const csrfToken = loginRoot.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (!csrfToken) throw new Error('C411: csrf-token meta tag not found');

  // Step 2: Login via JSON API with the CSRF token
  const loginRes = await fetch(new URL('/api/auth/login', credentials.trackerUrl).href, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': solution.userAgent,
      Cookie: jar.serialize(),
      'csrf-token': csrfToken,
    },
    body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    redirect: 'manual',
  });
  jar.absorb(loginRes.headers);

  if (!loginRes.ok) {
    const body = await loginRes.text().catch(() => '');
    throw new Error(`C411 login failed: ${loginRes.status} ${body.slice(0, 200)}`);
  }

  return { jar, userAgent: solution.userAgent, trackerUrl: credentials.trackerUrl };
}

/**
 * Get an authenticated C411 session (cached with TTL).
 */
export async function getC411Session(): Promise<C411Session> {
  const now = Date.now();
  if (cachedSession && now - sessionCreatedAt < SESSION_TTL_MS) {
    return cachedSession;
  }

  const config = await loadC411Config();
  if (!config.flaresolverrUrl) throw new Error('C411 plugin missing flaresolverr_url');

  console.log('[c411] Creating new session...');
  const solution = await callFlareSolverr(config.flaresolverrUrl, config.trackerUrl);
  const session = await loginC411(
    { trackerUrl: config.trackerUrl, username: config.username, password: config.password },
    solution,
  );

  cachedSession = session;
  sessionCreatedAt = now;
  console.log('[c411] Session created successfully');
  return session;
}

/**
 * Clear the cached session (call on 401/403 to force re-auth).
 */
export function clearC411Session(): void {
  cachedSession = null;
  sessionCreatedAt = 0;
}

/**
 * Execute a C411 API call with automatic session refresh on auth failure.
 */
export async function withC411Session<T>(fn: (session: C411Session) => Promise<T>): Promise<T> {
  let session = await getC411Session();
  try {
    return await fn(session);
  } catch (error: any) {
    const msg = error?.message ?? '';
    if (msg.includes('401') || msg.includes('403') || msg.includes('login')) {
      console.log('[c411] Session expired, re-authenticating...');
      clearC411Session();
      session = await getC411Session();
      return fn(session);
    }
    throw error;
  }
}

/**
 * Load the C411 plugin config (for use by other modules that need announce_url etc).
 */
export { loadC411Config };
