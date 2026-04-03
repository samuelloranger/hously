import { parse } from "node-html-parser";
import type { TrackerPluginConfig } from "../../utils/plugins/types";
import {
  CookieJar,
  httpFetch,
  type FlareSolverrSolution,
  type HttpTrackerStats,
} from "./httpScraper";

interface C411UserResponse {
  uploaded: number;
  downloaded: number;
  ratio: number;
}

export async function scrapeC411(
  config: TrackerPluginConfig,
  solution?: FlareSolverrSolution,
): Promise<HttpTrackerStats> {
  if (!solution) throw new Error("C411 scraper requires FlareSolverr solution");

  const jar = new CookieJar();
  jar.init(solution.cookies);

  // Step 1: GET login page to obtain the CSRF token from a <meta> tag.
  const { html: loginHtml } = await httpFetch(config.tracker_url, {
    jar,
    userAgent: solution.userAgent,
  });
  const loginRoot = parse(loginHtml);
  const csrfToken = loginRoot
    .querySelector('meta[name="csrf-token"]')
    ?.getAttribute("content");
  if (!csrfToken)
    throw new Error("C411: csrf-token meta tag not found on login page");

  // Step 2: Login via the JSON API.
  const loginRes = await fetch(
    new URL("/api/auth/login", config.tracker_url).href,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": solution.userAgent,
        Cookie: jar.serialize(),
        "csrf-token": csrfToken,
      },
      body: JSON.stringify({
        username: config.username,
        password: config.password ?? "",
      }),
      redirect: "manual",
    },
  );
  jar.absorb(loginRes.headers);

  if (!loginRes.ok) {
    const body = await loginRes.text().catch(() => "");
    throw new Error(
      `C411 API login failed: ${loginRes.status} ${body.slice(0, 200)}`,
    );
  }

  // Step 3: Fetch user stats from the API directly.
  const userUrl = new URL(
    `/api/users/${encodeURIComponent(config.username)}`,
    config.tracker_url,
  ).href;
  const userRes = await fetch(userUrl, {
    headers: {
      "User-Agent": solution.userAgent,
      Cookie: jar.serialize(),
      Accept: "application/json",
    },
  });

  if (!userRes.ok) {
    const body = await userRes.text().catch(() => "");
    throw new Error(
      `C411 user API failed: ${userRes.status} ${body.slice(0, 200)}`,
    );
  }

  const user = (await userRes.json()) as C411UserResponse;

  // API returns bytes — convert to Go (1 Go = 1,000,000,000 bytes, C411 uses decimal).
  return {
    uploadedGo: user.uploaded / 1_000_000_000,
    downloadedGo: user.downloaded / 1_000_000_000,
    ratio: user.ratio,
  };
}
