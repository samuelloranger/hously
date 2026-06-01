import type React from "react";
import type { TileId, TileLayout } from "@hously/shared/constants";
import { TILE_COMPONENTS } from "@/pages/_component/tileComponents";

export function SmartTilesStrip({ layout }: { layout: TileLayout }) {
  const tiles = layout
    .map((id) => ({ id, Component: TILE_COMPONENTS[id as TileId] }))
    .filter((t): t is { id: TileId; Component: React.ComponentType } =>
      Boolean(t.Component),
    );

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
      {tiles.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </div>
  );
}
