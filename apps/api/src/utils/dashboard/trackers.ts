import type { TrackerType } from '../plugins/types';

export type CachedTrackerStats = {
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  updated_at?: string | null;
};

export const cacheKey = (type: TrackerType): string => `${type}TopPanelStats`;

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
  const updated_at = toIsoStringOrNull(payload.updated_at);

  if (uploaded_go == null && downloaded_go == null && ratio == null) return null;
  return { uploaded_go, downloaded_go, ratio, updated_at };
};
