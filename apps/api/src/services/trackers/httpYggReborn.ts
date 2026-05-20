import { parse } from "node-html-parser";
import type { TrackerIntegrationConfig } from "@hously/api/utils/integrations/types";
import {
  CookieJar,
  httpFetch,
  type FlareSolverrSolution,
  type HttpTrackerStats,
} from "./httpScraper";
import { parseSizeToGo, parseRatio } from "./parseUtils";
import { TrackerAuthError, TrackerHttpError } from "./errors";

// Units: French "octet" system (o, Ko, Mo, Go, To)
export async function scrapeYggReborn(
  config: TrackerIntegrationConfig,
  solution?: FlareSolverrSolution,
): Promise<HttpTrackerStats> {
  if (!solution)
    throw new Error("YGG Reborn scraper requires FlareSolverr solution");

  const jar = new CookieJar();
  jar.init(solution.cookies);

  const baseUrl = new URL(config.tracker_url).origin;
  const loginUrl = `${baseUrl}/login`;

  // Step 1: GET login page to extract the CSRF hidden input.
  console.log(`[ygg-reborn-http] GET ${loginUrl}`);
  const { html: loginHtml } = await httpFetch(loginUrl, {
    jar,
    userAgent: solution.userAgent,
  });

  const loginRoot = parse(loginHtml);
  const csrfToken = loginRoot
    .querySelector('input[name="csrf_token"]')
    ?.getAttribute("value");

  if (!csrfToken) {
    throw new TrackerAuthError(
      "ygg-reborn",
      "csrf_token hidden input not found on login page",
    );
  }

  // Step 2: POST login form (identifier = email, password).
  const formBody = new URLSearchParams({
    csrf_token: csrfToken,
    identifier: config.username,
    password: config.password ?? "",
  });

  console.log(`[ygg-reborn-http] POST ${loginUrl}`);
  const { status: loginStatus, finalUrl } = await httpFetch(loginUrl, {
    method: "POST",
    body: formBody.toString(),
    contentType: "application/x-www-form-urlencoded",
    jar,
    userAgent: solution.userAgent,
  });

  if (loginStatus >= 400) {
    throw new TrackerHttpError("ygg-reborn", loginStatus, loginUrl);
  }

  if (finalUrl.includes("/login")) {
    throw new TrackerAuthError(
      "ygg-reborn",
      "Still on login page after POST — credentials rejected or Turnstile not solved",
    );
  }

  // Step 3: GET /account/ to scrape tracker stats.
  const accountUrl = `${baseUrl}/account/`;
  console.log(`[ygg-reborn-http] GET ${accountUrl}`);
  const { html: accountHtml, status: accountStatus } = await httpFetch(
    accountUrl,
    { jar, userAgent: solution.userAgent },
  );

  if (accountStatus >= 400) {
    throw new TrackerHttpError("ygg-reborn", accountStatus, accountUrl);
  }

  // Step 4: Parse the "Statistiques Tracker" card.
  // Structure:  <div class="...value...">50.00 Go</div>
  //             <div class="...text-dark-400 mt-1">Upload</div>  (next sibling = label)
  const root = parse(accountHtml);

  let uploadedGo: number | null = null;
  let downloadedGo: number | null = null;
  let ratio: number | null = null;

  for (const el of root.querySelectorAll("div")) {
    const text = el.rawText?.trim() ?? "";
    if (el.childNodes.length > 2 || !text) continue;

    if (text === "Upload") {
      const valueEl = el.previousElementSibling;
      if (valueEl) uploadedGo = parseSizeToGo(valueEl.rawText?.trim() ?? "");
    } else if (text === "Download") {
      const valueEl = el.previousElementSibling;
      if (valueEl) downloadedGo = parseSizeToGo(valueEl.rawText?.trim() ?? "");
    } else if (text === "Ratio") {
      const valueEl = el.previousElementSibling;
      if (valueEl) ratio = parseRatio(valueEl.rawText?.trim() ?? "");
    }
  }

  const computedRatio =
    ratio !== null
      ? ratio
      : uploadedGo !== null && downloadedGo !== null && downloadedGo > 0
        ? Math.round((uploadedGo / downloadedGo) * 100) / 100
        : null;

  console.log(
    `[ygg-reborn-http] account OK — up: ${uploadedGo?.toFixed(2)} Go, down: ${downloadedGo?.toFixed(2)} Go, ratio: ${computedRatio}`,
  );

  return { uploadedGo, downloadedGo, ratio: computedRatio };
}
