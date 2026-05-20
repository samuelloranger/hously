import { parse } from "node-html-parser";
import type { TrackerIntegrationConfig } from "@hously/api/utils/integrations/types";
import {
  CookieJar,
  httpFetch,
  type FlareSolverrSolution,
  type HttpTrackerStats,
} from "./httpScraper";
import { TrackerAuthError, TrackerHttpError } from "./errors";

// Units: French "octet" system (o, Ko, Mo, Go, To)
function parseBytes(text: string): number | null {
  const m = text.trim().match(/^([\d.,]+)\s*(o|Ko|Mo|Go|To|B|KB|MB|GB|TB)$/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  const unit = m[2].toLowerCase();
  const mul: Record<string, number> = {
    o: 1, b: 1,
    ko: 1e3, kb: 1e3,
    mo: 1e6, mb: 1e6,
    go: 1e9, gb: 1e9,
    to: 1e12, tb: 1e12,
  };
  return Number.isFinite(value) && mul[unit] != null ? value * mul[unit] : null;
}

function parseRatioText(text: string): number | null {
  const t = text.trim();
  if (t === "∞" || t === "Inf" || t.toLowerCase() === "inf") return null;
  const m = t.match(/^([\d.,]+)$/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

export async function scrapeYggReborn(
  config: TrackerIntegrationConfig,
  solution?: FlareSolverrSolution,
): Promise<HttpTrackerStats> {
  if (!solution) throw new Error("YGG Reborn scraper requires FlareSolverr solution");

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

  let uploadedBytes: number | null = null;
  let downloadedBytes: number | null = null;
  let ratio: number | null = null;

  for (const el of root.querySelectorAll("div")) {
    const text = el.rawText?.trim() ?? "";
    if (el.childNodes.length > 2 || !text) continue;

    if (text === "Upload") {
      const valueEl = el.previousElementSibling;
      if (valueEl) uploadedBytes = parseBytes(valueEl.rawText?.trim() ?? "");
    } else if (text === "Download") {
      const valueEl = el.previousElementSibling;
      if (valueEl) downloadedBytes = parseBytes(valueEl.rawText?.trim() ?? "");
    } else if (text === "Ratio") {
      const valueEl = el.previousElementSibling;
      if (valueEl) ratio = parseRatioText(valueEl.rawText?.trim() ?? "");
    }
  }

  const uploadedGo = uploadedBytes !== null ? uploadedBytes / 1_000_000_000 : null;
  const downloadedGo = downloadedBytes !== null ? downloadedBytes / 1_000_000_000 : null;

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
