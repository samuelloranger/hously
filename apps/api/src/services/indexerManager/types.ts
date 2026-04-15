export interface IndexerSearchParams {
  query?: string;
  type: "freetext" | "tvsearch";
  mediaType?: "movie" | "tv";
  tmdbId?: number | null;
  season?: number | null;
  limit?: number;
}

export interface NormalizedRelease {
  guid: string;
  title: string;
  indexer: string | null;
  indexerId: number | null;
  languages: string[];
  protocol: string | null;
  sizeBytes: number | null;
  age: number | null;
  seeders: number | null;
  leechers: number | null;
  rejected: boolean;
  rejections: string[];
  infoUrl: string | null;
  downloadUrl: string | null;
  magnetUrl: string | null;
  infoHash: string | null;
  /** TMDb ID reported by the indexer (partial — not all trackers provide it) */
  tmdbId: number | null;
  /** Download volume factor: 0 = freeleech, 1 = normal (Jackett-only) */
  freeleech: boolean;
  /** Original raw payload — used by Prowlarr adapter for grab POST */
  rawPayload?: Record<string, unknown>;
}

export interface NormalizedIndexer {
  id: number;
  name: string;
  protocol: string;
  enabled: boolean;
  privacy: string;
}

export interface GrabResult {
  success: boolean;
  downloadUrl?: string;
  magnetUrl?: string;
  error?: string;
}

export interface IndexerManagerAdapter {
  readonly name: "prowlarr" | "jackett";

  search(params: IndexerSearchParams): Promise<NormalizedRelease[]>;

  getIndexers(): Promise<NormalizedIndexer[]>;

  /**
   * Grab/download a release.
   * - Prowlarr: POSTs stored payload back to Prowlarr API
   * - Jackett: returns the direct download URL/magnet
   */
  grabRelease(token: string): Promise<GrabResult>;

  /**
   * Store a release and return a download token for later grab.
   * - Prowlarr: stores the full raw payload for POST-back
   * - Jackett: stores the download URL/magnet
   * Returns null if the release has no downloadable target.
   */
  storeReleaseToken(release: NormalizedRelease): string | null;
}
