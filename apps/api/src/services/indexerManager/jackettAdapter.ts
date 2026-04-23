import type {
  IndexerManagerAdapter,
  IndexerSearchParams,
  NormalizedRelease,
  NormalizedIndexer,
  GrabResult,
} from "./types";
import type { IndexerIntegrationConfig } from "../../utils/integrations/types";
import { randomUUID } from "crypto";

const RELEASE_TTL_MS = 10 * 60 * 1000;

const releasePayloads = new Map<
  string,
  { url: string; isMagnet: boolean; expiresAt: number }
>();

function cleanupExpired() {
  const now = Date.now();
  for (const [token, entry] of releasePayloads.entries()) {
    if (entry.expiresAt <= now) releasePayloads.delete(token);
  }
}

function storeDownloadUrl(url: string, isMagnet: boolean): string {
  cleanupExpired();
  const token = randomUUID();
  releasePayloads.set(token, {
    url,
    isMagnet,
    expiresAt: Date.now() + RELEASE_TTL_MS,
  });
  return token;
}

function takeDownloadUrl(
  token: string,
): { url: string; isMagnet: boolean } | null {
  cleanupExpired();
  const entry = releasePayloads.get(token);
  if (!entry) return null;
  releasePayloads.delete(token);
  return { url: entry.url, isMagnet: entry.isMagnet };
}

export class JackettAdapter implements IndexerManagerAdapter {
  readonly name = "jackett" as const;
  private readonly config: IndexerIntegrationConfig;

  constructor(config: IndexerIntegrationConfig) {
    this.config = config;
  }

  async search(params: IndexerSearchParams): Promise<NormalizedRelease[]> {
    const url = new URL(
      "/api/v2.0/indexers/all/results",
      this.config.website_url,
    );
    url.searchParams.set("apikey", this.config.api_key);

    if (params.query) {
      url.searchParams.set("Query", params.query);
    }

    // Category filtering: 2000 = Movies, 5000 = TV
    if (params.mediaType === "movie") {
      url.searchParams.append("Category[]", "2000");
    } else if (params.mediaType === "tv" || params.type === "tvsearch") {
      url.searchParams.append("Category[]", "5000");
    }

    if (params.tmdbId != null) {
      url.searchParams.set("tmdbid", String(params.tmdbId));
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (!res?.ok) return [];

    const body = (await res.json().catch(() => null)) as unknown;
    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const results = Array.isArray(record?.Results)
      ? record.Results
      : Array.isArray(body)
        ? body
        : [];

    return (results as Record<string, unknown>[])
      .map((raw) => this.normalizeRelease(raw))
      .filter((r): r is NormalizedRelease => r !== null);
  }

  async getIndexers(): Promise<NormalizedIndexer[]> {
    // Jackett's /api/v2.0/indexers management endpoint requires cookie auth,
    // not the API key. Instead, run a lightweight search — the response
    // includes an "Indexers" array with all configured indexers and their status.
    const url = new URL(
      "/api/v2.0/indexers/all/results",
      this.config.website_url,
    );
    url.searchParams.set("apikey", this.config.api_key);
    url.searchParams.set("Query", "_");
    // Limit results to minimize payload — we only need the Indexers metadata
    url.searchParams.set("_", String(Date.now()));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);

    if (!res?.ok) return [];

    const body = await res.json().catch(() => null);
    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const rawIndexers = Array.isArray(record?.Indexers)
      ? (record.Indexers as Array<Record<string, unknown>>)
      : [];

    if (rawIndexers.length === 0) return [];

    const indexers: NormalizedIndexer[] = rawIndexers.map((item, idx) => ({
      id: typeof item.ID === "string" ? idx : Number(item.ID ?? idx),
      name: String(item.Name ?? ""),
      protocol: "torrent",
      enabled: item.Status === 2, // 2 = OK in Jackett
      privacy: "private", // Jackett doesn't expose privacy; assume private
    }));

    indexers.sort((a, b) => a.name.localeCompare(b.name));

    return indexers;
  }

  async grabRelease(token: string): Promise<GrabResult> {
    const stored = takeDownloadUrl(token);
    if (!stored) {
      return { success: false, error: "Release token expired or not found" };
    }

    if (stored.isMagnet) {
      return { success: true, magnetUrl: stored.url };
    }
    return { success: true, downloadUrl: stored.url };
  }

  storeReleaseToken(release: NormalizedRelease): string | null {
    const url = release.magnetUrl ?? release.downloadUrl;
    if (!url) return null;
    return storeDownloadUrl(url, url.startsWith("magnet:"));
  }

  private normalizeRelease(
    raw: Record<string, unknown>,
  ): NormalizedRelease | null {
    const title = toString(raw.Title) || toString(raw.title);
    const guid =
      toString(raw.Guid) || toString(raw.guid) || toString(raw.Link) || title;
    if (!guid || !title) return null;

    const magnetUrl =
      toString(raw.MagnetUri) || toString(raw.magnetUri) || null;
    const link = toString(raw.Link) || toString(raw.link) || null;
    const downloadUrl = link && !link.startsWith("magnet:") ? link : null;

    const trackerName = toString(raw.Tracker) || toString(raw.tracker) || null;

    const infoHash =
      toString(raw.InfoHash) ||
      toString(raw.infoHash) ||
      (magnetUrl ? extractInfoHash(magnetUrl) : null);

    const dvf = toNumber(raw.DownloadVolumeFactor);

    return {
      guid,
      title,
      indexer: trackerName,
      indexerId: null,
      languages: [],
      protocol: "torrent",
      sizeBytes: toNumber(raw.Size) ?? toNumber(raw.size) ?? null,
      age: null,
      seeders: toNumber(raw.Seeders) ?? toNumber(raw.seeders) ?? null,
      leechers: toNumber(raw.Peers) ?? toNumber(raw.peers) ?? null,
      rejected: false,
      rejections: [],
      infoUrl: toString(raw.Details) || toString(raw.details) || null,
      downloadUrl,
      magnetUrl,
      infoHash,
      tmdbId: toNumber(raw.TMDb) ?? toNumber(raw.tmdb) ?? null,
      freeleech: dvf === 0,
    };
  }
}

function toString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractInfoHash(magnet: string): string | null {
  const m = /btih:([a-fA-F0-9]{40})/i.exec(magnet);
  return m ? m[1].toLowerCase() : null;
}
