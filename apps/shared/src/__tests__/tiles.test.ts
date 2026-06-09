import { describe, it, expect } from "bun:test";
import {
  TILES,
  getDefaultTileLayout,
  getEffectiveTileLayout,
  moveTileInLayout,
  type TileLayout,
} from "../constants/tiles";

describe("tile catalog", () => {
  it("has unique ids", () => {
    const ids = TILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("default layout is the default-visible ids in defaultOrder", () => {
    const layout = getDefaultTileLayout();
    const expected = TILES.filter((t) => t.defaultVisible)
      .slice()
      .sort((a, b) => a.defaultOrder - b.defaultOrder)
      .map((t) => t.id);
    expect(layout).toEqual(expected);
  });

  it("effective layout falls back to default when stored is null", () => {
    expect(getEffectiveTileLayout(null)).toEqual(getDefaultTileLayout());
  });

  it("effective layout drops unknown ids and appends missing catalog ids", () => {
    const stored = ["next_event", "bogus_tile"] as unknown as TileLayout;
    const eff = getEffectiveTileLayout(stored);
    expect(eff).toContain("next_event");
    expect(eff).not.toContain("bogus_tile");
    expect(new Set(eff).size).toBe(eff.length);
    TILES.forEach((t) => expect(eff).toContain(t.id));
  });

  it("moveTileInLayout swaps adjacent tiles", () => {
    const layout = ["a", "b", "c"] as unknown as TileLayout;
    expect(moveTileInLayout(layout, "b" as never, "up")).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(moveTileInLayout(layout, "b" as never, "down")).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("moveTileInLayout is a no-op at the edges", () => {
    const layout = ["a", "b"] as unknown as TileLayout;
    expect(moveTileInLayout(layout, "a" as never, "up")).toEqual(["a", "b"]);
    expect(moveTileInLayout(layout, "b" as never, "down")).toEqual(["a", "b"]);
  });

  it("deduplicates repeated valid ids in stored layout", () => {
    const stored = ["next_event", "next_event"] as unknown as TileLayout;
    const eff = getEffectiveTileLayout(stored);
    expect(new Set(eff).size).toBe(eff.length);
    expect(eff.filter((id) => id === "next_event")).toHaveLength(1);
  });
});
