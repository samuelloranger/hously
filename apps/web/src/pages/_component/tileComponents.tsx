import type React from "react";
import type { TileId } from "@hously/shared/constants";
import { LatestMediaTile } from "@/pages/_component/tiles/LatestMediaTile";
import { NextEventTile } from "@/pages/_component/tiles/NextEventTile";
import { ActiveDownloadsTile } from "@/pages/_component/tiles/ActiveDownloadsTile";
import { LibraryAlertsTile } from "@/pages/_component/tiles/LibraryAlertsTile";
import { WeatherTile } from "@/pages/_component/tiles/WeatherTile";
import { SystemTile } from "@/pages/_component/tiles/SystemTile";

/**
 * Maps a TileId to its component. Partial by design: the shared catalog lists
 * all planned tiles, but components ship incrementally. SmartTilesStrip renders
 * only tiles present in this registry.
 */
export const TILE_COMPONENTS: Partial<Record<TileId, React.ComponentType>> = {
  latest_media: LatestMediaTile,
  next_event: NextEventTile,
  active_downloads: ActiveDownloadsTile,
  library_alerts: LibraryAlertsTile,
  weather: WeatherTile,
  system: SystemTile,
};
