import type { TrackerType } from '../plugins/types';

export type CachedTrackerStats = {
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  previous_uploaded_go?: number | null;
  previous_downloaded_go?: number | null;
  previous_ratio?: number | null;
  updated_at?: string | null;
};

export const cacheKey = (type: TrackerType): string => `${type}Stats`;

const toIsoStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const parseCachedTrackerStats = (cached: unknown): CachedTrackerStats | null => {
  if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return null;
  const payload = cached as Record<string, unknown>;

  const uploaded_go =
    typeof payload.uploaded_go === 'number' && Number.isFinite(payload.uploaded_go) ? payload.uploaded_go : null;
  const downloaded_go =
    typeof payload.downloaded_go === 'number' && Number.isFinite(payload.downloaded_go) ? payload.downloaded_go : null;
  const ratio = typeof payload.ratio === 'number' && Number.isFinite(payload.ratio) ? payload.ratio : null;

  const previous_uploaded_go =
    typeof payload.previous_uploaded_go === 'number' && Number.isFinite(payload.previous_uploaded_go)
      ? payload.previous_uploaded_go
      : null;
  const previous_downloaded_go =
    typeof payload.previous_downloaded_go === 'number' && Number.isFinite(payload.previous_downloaded_go)
      ? payload.previous_downloaded_go
      : null;
  const previous_ratio =
    typeof payload.previous_ratio === 'number' && Number.isFinite(payload.previous_ratio)
      ? payload.previous_ratio
      : null;

  const updated_at = toIsoStringOrNull(payload.updated_at);

  // A brand-new account may have all-null stats (the tracker page shows no data
  // yet) but the cache entry still proves that a fetch was completed. Return the
  // struct so callers can show "connected with no data" instead of "not fetched".
  return {
    uploaded_go,
    downloaded_go,
    ratio,
    previous_uploaded_go,
    previous_downloaded_go,
    previous_ratio,
    updated_at,
  };
};
