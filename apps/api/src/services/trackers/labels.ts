import type { TrackerType } from "@hously/api/utils/integrations/types";

export const TRACKER_LABELS: Record<TrackerType, string> = {
  c411: "C411",
  torr9: "Torr9",
  "la-cale": "La Cale",
  "ygg-reborn": "YGG Reborn",
};

export const TRACKER_HTTP_STATUS_MESSAGES: Record<number, string> = {
  401: "Authentication required",
  403: "Access forbidden (Cloudflare challenge or IP banned)",
  404: "Tracker page not found",
  429: "Rate limited by tracker",
  500: "Tracker internal error",
  502: "Tracker bad gateway",
  503: "Tracker unavailable (maintenance)",
  504: "Tracker timeout",
};

export function trackerLabel(type: TrackerType): string {
  return TRACKER_LABELS[type];
}

export function trackerHttpStatusMessage(status: number): string {
  return TRACKER_HTTP_STATUS_MESSAGES[status] ?? `HTTP ${status} from tracker`;
}
