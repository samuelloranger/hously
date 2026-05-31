export const TILES = [
  { id: "latest_media", defaultVisible: true, defaultOrder: 0 },
  { id: "chores_today", defaultVisible: true, defaultOrder: 1 },
  { id: "next_event", defaultVisible: true, defaultOrder: 2 },
  { id: "habit_streak", defaultVisible: true, defaultOrder: 3 },
  { id: "active_downloads", defaultVisible: false, defaultOrder: 4 },
  { id: "library_alerts", defaultVisible: false, defaultOrder: 5 },
  { id: "weather", defaultVisible: false, defaultOrder: 6 },
  { id: "system", defaultVisible: false, defaultOrder: 7 },
] as const;

export type TileId = (typeof TILES)[number]["id"];
export type TileMeta = (typeof TILES)[number];
export type TileLayout = TileId[];

export function getDefaultTileLayout(): TileLayout {
  return TILES.filter((t) => t.defaultVisible)
    .slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((t) => t.id);
}

const VALID_TILE_IDS = new Set<string>(TILES.map((t) => t.id));

/**
 * Reconcile a stored tile layout with the current catalog: keep stored order,
 * drop ids no longer in the catalog, and append any catalog ids not present
 * (in defaultOrder) so newly-shipped tiles surface without wiping config.
 */
export function getEffectiveTileLayout(stored: TileLayout | null): TileLayout {
  if (!stored) return getDefaultTileLayout();
  const cleaned = [
    ...new Set(stored.filter((id) => VALID_TILE_IDS.has(id))),
  ] as TileLayout;
  const present = new Set(cleaned);
  TILES.slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .forEach((t) => {
      if (!present.has(t.id)) cleaned.push(t.id);
    });
  return cleaned;
}

export function moveTileInLayout(
  layout: TileLayout,
  id: TileId,
  direction: "up" | "down",
): TileLayout {
  const next = [...layout];
  const pos = next.indexOf(id);
  if (pos === -1) return next;
  const target = direction === "up" ? pos - 1 : pos + 1;
  if (target < 0 || target >= next.length) return next;
  [next[pos], next[target]] = [next[target], next[pos]];
  return next;
}
