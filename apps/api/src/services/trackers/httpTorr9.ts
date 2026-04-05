import type { TrackerPluginConfig } from "@hously/api/utils/plugins/types";
import type { FlareSolverrSolution, HttpTrackerStats } from "./httpScraper";

/**
 * Torr9 is a Next.js SPA with a separate JSON API at api.torr9.xyz.
 * Login returns a JWT token + user stats (uploaded/downloaded bytes) directly.
 * No HTML scraping or FlareSolverr cookies needed for the API domain.
 */
export async function scrapeTorr9(
  config: TrackerPluginConfig,
  solution?: FlareSolverrSolution,
): Promise<HttpTrackerStats> {
  if (!solution)
    throw new Error("Torr9 scraper requires FlareSolverr solution");

  // Derive the API base URL from the tracker URL (torr9.xyz → api.torr9.xyz).
  const trackerUrl = new URL(config.tracker_url);
  const apiBase = `${trackerUrl.protocol}//api.${trackerUrl.host}`;

  console.log(`[torr9-http] POST ${apiBase}/api/v1/auth/login`);
  const loginRes = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": solution.userAgent,
      Referer: config.tracker_url,
      Origin: trackerUrl.origin,
    },
    body: JSON.stringify({
      username: config.username,
      password: config.password ?? "",
    }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(
      `Torr9 API login failed: ${loginRes.status} — ${body.slice(0, 200)}`,
    );
  }

  const data = (await loginRes.json()) as {
    token?: string;
    user?: {
      total_uploaded_bytes?: number;
      total_downloaded_bytes?: number;
    };
  };

  if (!data.token || !data.user) {
    throw new Error("Torr9 API login response missing token or user data");
  }

  const { total_uploaded_bytes, total_downloaded_bytes } = data.user;
  const uploadedGo =
    typeof total_uploaded_bytes === "number"
      ? total_uploaded_bytes / 1_000_000_000
      : null;
  const downloadedGo =
    typeof total_downloaded_bytes === "number"
      ? total_downloaded_bytes / 1_000_000_000
      : null;
  const ratio =
    uploadedGo !== null && downloadedGo !== null && downloadedGo > 0
      ? Math.round((uploadedGo / downloadedGo) * 100) / 100
      : null;

  console.log(
    `[torr9-http] login OK — up: ${uploadedGo?.toFixed(2)} Go, down: ${downloadedGo?.toFixed(2)} Go, ratio: ${ratio}`,
  );

  return { uploadedGo, downloadedGo, ratio };
}
