/**
 * Quick test script for HTTP tracker scrapers.
 * Usage: bun run test-http-scraper.ts [ygg|c411|torr9|g3mini]
 */
import type { FlareSolverrSolution } from './src/services/trackers/httpScraper';
import { scrapeYgg } from './src/services/trackers/httpYgg';
import { scrapeC411 } from './src/services/trackers/httpC411';
import { scrapeTorr9 } from './src/services/trackers/httpTorr9';
import { scrapeG3mini } from './src/services/trackers/httpG3mini';
import { scrapeLaCale } from './src/services/trackers/httpLaCale';

const FLARESOLVERR_URL = 'http://localhost:8191/v1';

const TRACKERS = {
  'la-cale': {
    tracker_url: 'https://la-cale.space',
    username: 'samuelloranger@gmail.com',
    password: '$Kiara0512',
    flaresolverr_url: FLARESOLVERR_URL,
    noFlaresolverr: true,
    scrape: (config: any) => scrapeLaCale(config),
  },
  ygg: {
    tracker_url: 'https://yggtorrent.top',
    username: 'samlo122',
    password: '$Kiara0512',
    flaresolverr_url: FLARESOLVERR_URL,
    scrape: scrapeYgg,
  },
  c411: {
    tracker_url: 'https://c411.org/login',
    username: 'samuelloranger@gmail.com',
    password: '$Kiara0512',
    flaresolverr_url: FLARESOLVERR_URL,
    scrape: scrapeC411,
  },
  torr9: {
    tracker_url: 'https://torr9.xyz/login',
    username: 'samlo122',
    password: '$Benji122',
    flaresolverr_url: FLARESOLVERR_URL,
    scrape: scrapeTorr9,
  },
  g3mini: {
    tracker_url: 'https://gemini-tracker.org/login',
    username: 'samlo122',
    password: '$Benji122',
    flaresolverr_url: FLARESOLVERR_URL,
    scrape: scrapeG3mini,
  },
} as const;

type TrackerKey = keyof typeof TRACKERS;

async function getFlareSolverrSolution(url: string): Promise<FlareSolverrSolution> {
  console.log(`[flaresolverr] Requesting CF clearance for ${url}...`);
  const res = await fetch(FLARESOLVERR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: 60000 }),
  });
  const data = (await res.json()) as any;
  if (!res.ok || !data?.solution) {
    console.error('[flaresolverr] Response:', JSON.stringify(data, null, 2).slice(0, 500));
    throw new Error(`FlareSolverr failed: ${res.status}`);
  }
  console.log(
    `[flaresolverr] Got ${data.solution.cookies.length} cookies, UA: ${data.solution.userAgent.slice(0, 60)}...`
  );
  const responseHtml = typeof data.solution.response === 'string' ? data.solution.response : undefined;
  if (responseHtml) {
    console.log(`[flaresolverr] Rendered HTML: ${responseHtml.length} bytes`);
  }
  return { ...data.solution, response: responseHtml } as FlareSolverrSolution;
}

async function testTracker(key: TrackerKey) {
  const tracker = TRACKERS[key];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${key.toUpperCase()} — ${tracker.tracker_url}`);
  console.log('='.repeat(60));

  try {
    const config = {
      tracker_url: tracker.tracker_url,
      username: tracker.username,
      password: tracker.password,
      flaresolverr_url: tracker.flaresolverr_url,
    };
    const needsFlaresolverr = !('noFlaresolverr' in tracker && tracker.noFlaresolverr);
    const solution = needsFlaresolverr ? await getFlareSolverrSolution(tracker.tracker_url) : undefined;
    const stats = await tracker.scrape(config, solution as any);
    console.log(`\n✅ ${key.toUpperCase()} SUCCESS:`, stats);
  } catch (err) {
    console.error(`\n❌ ${key.toUpperCase()} FAILED:`, err instanceof Error ? err.message : err);
  }
}

async function probeSite(label: string, loginUrl: string, username: string, password: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`Probing ${label} — ${loginUrl}`);
  console.log('='.repeat(60));

  const { CookieJar, httpFetch } = await import('./src/services/trackers/httpScraper');
  const { parse: parseHtml } = await import('node-html-parser');
  const solution = await getFlareSolverrSolution(loginUrl);
  const jar = new CookieJar();
  jar.init(solution.cookies);

  const { html, finalUrl } = await httpFetch(loginUrl, { jar, userAgent: solution.userAgent });
  console.log(`  GET ${loginUrl} → final: ${finalUrl} (${html.length} bytes)`);
  const root = parseHtml(html);
  const title = root.querySelector('title')?.textContent ?? '(no title)';
  console.log(`  Page title: ${title}`);

  // Check all cookies
  console.log(`  Cookies: ${jar.serialize().slice(0, 300)}`);

  // Find all forms
  const forms = root.querySelectorAll('form');
  console.log(`  Forms found: ${forms.length}`);
  for (const form of forms) {
    const cls = form.getAttribute('class') || '(no class)';
    const action = form.getAttribute('action') || '(no action)';
    console.log(`    form.${cls} action=${action} → ${form.outerHTML.slice(0, 200)}`);
  }

  // Check for CSRF meta tags
  const csrfMeta = root.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  console.log(`  CSRF meta: ${csrfMeta ?? '(none)'}`);

  // Check for __NUXT__ or SPA markers
  const isNuxt = html.includes('__NUXT__');
  const isNext = html.includes('__NEXT_DATA__');
  console.log(`  SPA markers: nuxt=${isNuxt}, next=${isNext}`);

  // Try common JSON API login endpoints
  const csrfToken = csrfMeta ?? jar.get('__csrf') ?? '';
  const baseUrl = new URL('/', finalUrl).href;
  const endpoints = ['/api/auth/login', '/api/login', '/api/session'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}${ep}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': solution.userAgent,
          Cookie: jar.serialize(),
          'csrf-token': csrfToken,
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ username, password }),
        redirect: 'manual',
      });
      const body = await res.text();
      console.log(`  POST ${ep} → ${res.status} (${body.length}b) ${body.slice(0, 120)}`);
    } catch (err: any) {
      console.log(`  POST ${ep} → ERROR: ${err.message}`);
    }
  }
}

const target = process.argv[2] as TrackerKey | 'probe-torr9' | 'probe-g3mini' | undefined;
if (target === 'probe-torr9') {
  await probeSite('Torr9', 'https://torr9.xyz/login', 'samlo122', '$Benji122');
} else if (target === 'probe-g3mini') {
  await probeSite('G3mini', 'https://gemini-tracker.org/login', 'samlo122', '$Benji122');
} else if (target && TRACKERS[target as TrackerKey]) {
  await testTracker(target as TrackerKey);
} else {
  for (const key of Object.keys(TRACKERS) as TrackerKey[]) {
    await testTracker(key);
  }
}
