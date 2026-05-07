export function jellyfinPlaybackUrlPath(itemId: string): string {
  return `/api/integrations/jellyfin/playback-url/${encodeURIComponent(itemId)}`;
}

export const JELLYFIN_PLAYBACK_STARTED_PATH =
  "/api/integrations/jellyfin/playback/started";
export const JELLYFIN_PLAYBACK_PROGRESS_PATH =
  "/api/integrations/jellyfin/playback/progress";
export const JELLYFIN_PLAYBACK_STOPPED_PATH =
  "/api/integrations/jellyfin/playback/stopped";
