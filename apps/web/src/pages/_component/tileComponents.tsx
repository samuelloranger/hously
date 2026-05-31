import type React from "react";
import type { TileId } from "@hously/shared/constants";
import { ChoresTodayTile } from "@/pages/_component/tiles/ChoresTodayTile";
import { HabitStreakTile } from "@/pages/_component/tiles/HabitStreakTile";

/**
 * Maps a TileId to its component. Partial by design: the shared catalog lists
 * all planned tiles, but components ship incrementally. SmartTilesStrip renders
 * only tiles present in this registry.
 */
export const TILE_COMPONENTS: Partial<Record<TileId, React.ComponentType>> = {
  chores_today: ChoresTodayTile,
  habit_streak: HabitStreakTile,
};
