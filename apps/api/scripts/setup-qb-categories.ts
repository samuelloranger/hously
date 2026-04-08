/**
 * One-time (or idempotent) setup: create Hously qBittorrent categories with save paths.
 * Run from repo root: `cd apps/api && bun run scripts/setup-qb-categories.ts`
 *
 * Categories (paths match typical *arr-style layout; adjust in qB UI if your host differs):
 * - hously-movies → /data/Downloads/movies
 * - hously-shows → /data/Downloads/tv_shows
 */
import { getQbittorrentPluginConfig } from "../src/services/qbittorrent/config";
import {
  QBIT_CATEGORY_HOUSLY_MOVIES,
  QBIT_CATEGORY_HOUSLY_SHOWS,
} from "../src/constants/libraryGrab";

const SAVE_PATH_MOVIES = "/data/Downloads/movies";
const SAVE_PATH_SHOWS = "/data/Downloads/tv_shows";

const qb = await getQbittorrentPluginConfig();
if (!qb.config || !qb.enabled) {
  console.error("qBittorrent not configured or disabled in Hously plugins");
  process.exit(1);
}

const base = qb.config.website_url.replace(/\/+$/, "");

const loginRes = await fetch(`${base}/api/v2/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    username: qb.config.username,
    password: qb.config.password,
  }),
  redirect: "manual",
});

const cookie = loginRes.headers.get("set-cookie") ?? "";
const sid = cookie.match(/SID=([^;]+)/)?.[1];
if (!sid) {
  console.error("qBittorrent login failed, status:", loginRes.status);
  process.exit(1);
}

const authHeaders = { Cookie: `SID=${sid}` };

async function listCategories(): Promise<Record<string, { savePath?: string }>> {
  const res = await fetch(`${base}/api/v2/torrents/categories`, {
    headers: authHeaders,
  });
  if (!res.ok) {
    throw new Error(`categories list failed: ${res.status}`);
  }
  return (await res.json()) as Record<string, { savePath?: string }>;
}

async function createCategory(name: string, savePath: string): Promise<void> {
  const body = new URLSearchParams();
  body.set("category", name);
  // qBittorrent Web API v2 expects camelCase savePath (see wiki WebUI-API)
  body.set("savePath", savePath);
  const res = await fetch(`${base}/api/v2/torrents/createCategory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...authHeaders,
    },
    body: body.toString(),
  });
  if (res.ok) {
    console.log(`Created category "${name}" → ${savePath}`);
    return;
  }
  const text = await res.text();
  if (res.status === 409 || /exists/i.test(text)) {
    console.log(`Category "${name}" already exists (skipped)`);
    return;
  }
  throw new Error(`createCategory ${name}: ${res.status} ${text}`);
}

const existing = await listCategories();

const wanted: Array<{ name: string; savePath: string }> = [
  { name: QBIT_CATEGORY_HOUSLY_MOVIES, savePath: SAVE_PATH_MOVIES },
  { name: QBIT_CATEGORY_HOUSLY_SHOWS, savePath: SAVE_PATH_SHOWS },
];

for (const { name, savePath } of wanted) {
  if (existing[name]) {
    console.log(
      `Category "${name}" already present (savePath=${existing[name]?.savePath ?? "?"})`,
    );
    continue;
  }
  await createCategory(name, savePath);
}

console.log("Done.");
