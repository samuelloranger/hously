import { describe, expect, it } from "bun:test";
import {
  WIDGETS,
  getDefaultLayout,
  getEffectiveLayout,
  moveWidgetInLayout,
} from "../constants/widgets";
import type { WidgetId, WidgetLayout } from "../constants/widgets";

describe("WIDGETS registry", () => {
  it("contains exactly 16 widgets", () => {
    expect(WIDGETS.length).toBe(16);
  });

  it("has no duplicate IDs", () => {
    const ids = WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate column+order pairs", () => {
    const keys = WIDGETS.map((w) => `${w.column}:${w.order}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("assigns all widgets to column 1, 2, or 3", () => {
    for (const w of WIDGETS) {
      expect([1, 2, 3]).toContain(w.column);
    }
  });
});

describe("getDefaultLayout", () => {
  it("returns a tuple of exactly 3 arrays", () => {
    const layout = getDefaultLayout();
    expect(layout).toHaveLength(3);
  });

  it("column 0 contains all widgets with column === 1, sorted by order", () => {
    const layout = getDefaultLayout();
    const expected = WIDGETS.filter((w) => w.column === 1)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
    expect(layout[0]).toEqual(expected);
  });

  it("column 1 contains all widgets with column === 2, sorted by order", () => {
    const layout = getDefaultLayout();
    const expected = WIDGETS.filter((w) => w.column === 2)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
    expect(layout[1]).toEqual(expected);
  });

  it("column 2 contains all widgets with column === 3, sorted by order", () => {
    const layout = getDefaultLayout();
    const expected = WIDGETS.filter((w) => w.column === 3)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
    expect(layout[2]).toEqual(expected);
  });

  it("contains every widget ID exactly once across all columns", () => {
    const layout = getDefaultLayout();
    const all = layout.flat();
    expect(all).toHaveLength(WIDGETS.length);
    expect(new Set(all).size).toBe(WIDGETS.length);
  });
});

describe("getEffectiveLayout", () => {
  it("returns default layout when stored is null", () => {
    expect(getEffectiveLayout(null)).toEqual(getDefaultLayout());
  });

  it("preserves stored order when all widgets are present", () => {
    const stored = getDefaultLayout();
    // Swap two widgets to verify stored order is respected
    const reordered: WidgetLayout = [
      [...stored[0]].reverse() as WidgetId[],
      [...stored[1]],
      [...stored[2]],
    ];
    const result = getEffectiveLayout(reordered);
    expect(result[0]).toEqual(reordered[0]);
    expect(result[1]).toEqual(reordered[1]);
    expect(result[2]).toEqual(reordered[2]);
  });

  it("strips unknown IDs from stored layout", () => {
    const stored = [
      ["chores", "unknown_widget" as WidgetId, "weather"],
      ["habits"],
      ["system"],
    ] as WidgetLayout;
    const result = getEffectiveLayout(stored);
    expect(result[0]).not.toContain("unknown_widget");
    expect(result[0]).toContain("chores");
    expect(result[0]).toContain("weather");
  });

  it("appends widgets missing from stored layout to their default column", () => {
    const defaultLayout = getDefaultLayout();
    const partial: WidgetLayout = [
      [defaultLayout[0][0]],
      [defaultLayout[1][0]],
      [defaultLayout[2][0]],
    ];
    const result = getEffectiveLayout(partial);
    const allIds = result.flat();
    expect(allIds).toHaveLength(WIDGETS.length);
    for (const w of WIDGETS) {
      expect(allIds).toContain(w.id);
    }
  });
});

describe("moveWidgetInLayout", () => {
  const allVisible = () => true;

  it("swaps a widget up within a column", () => {
    const layout: WidgetLayout = [
      ["weather", "chores"],
      ["habits"],
      ["system"],
    ];
    const result = moveWidgetInLayout(layout, "chores", "up", allVisible);
    expect(result[0]).toEqual(["chores", "weather"]);
  });

  it("swaps a widget down within a column", () => {
    const layout: WidgetLayout = [
      ["weather", "chores"],
      ["habits"],
      ["system"],
    ];
    const result = moveWidgetInLayout(layout, "weather", "down", allVisible);
    expect(result[0]).toEqual(["chores", "weather"]);
  });

  it("moves a widget from position 0 to the end of the previous column", () => {
    const layout: WidgetLayout = [
      ["weather"],
      ["habits", "upcoming"],
      ["system"],
    ];
    const result = moveWidgetInLayout(layout, "habits", "up", allVisible);
    expect(result[0]).toEqual(["weather", "habits"]);
    expect(result[1]).toEqual(["upcoming"]);
  });

  it("moves a widget from the last position to the start of the next column", () => {
    const layout: WidgetLayout = [
      ["weather", "chores"],
      ["habits"],
      ["system"],
    ];
    const result = moveWidgetInLayout(layout, "chores", "down", allVisible);
    expect(result[0]).toEqual(["weather"]);
    expect(result[1]).toEqual(["chores", "habits"]);
  });

  it("no-ops when moving up from position 0 in column 0", () => {
    const layout: WidgetLayout = [
      ["weather", "chores"],
      ["habits"],
      ["system"],
    ];
    const result = moveWidgetInLayout(layout, "weather", "up", allVisible);
    expect(result).toEqual(layout);
  });

  it("no-ops when moving down from last position in column 2", () => {
    const layout: WidgetLayout = [
      ["weather"],
      ["habits"],
      ["system", "downloads"],
    ];
    const result = moveWidgetInLayout(layout, "downloads", "down", allVisible);
    expect(result).toEqual(layout);
  });

  it("skips hidden widgets when moving up, swapping with nearest visible", () => {
    const layout: WidgetLayout = [
      ["weather", "quick_links", "chores"],
      ["habits"],
      ["system"],
    ];
    const isVisible = (id: WidgetId) => id !== "quick_links";
    const result = moveWidgetInLayout(layout, "chores", "up", isVisible);
    expect(result[0]).toEqual(["chores", "quick_links", "weather"]);
  });

  it("skips hidden widgets when moving down, swapping with nearest visible", () => {
    const layout: WidgetLayout = [
      ["weather", "quick_links", "chores"],
      ["habits"],
      ["system"],
    ];
    const isVisible = (id: WidgetId) => id !== "quick_links";
    const result = moveWidgetInLayout(layout, "weather", "down", isVisible);
    expect(result[0]).toEqual(["chores", "quick_links", "weather"]);
  });

  it("crosses to the previous column when all widgets above are hidden", () => {
    const layout: WidgetLayout = [
      ["weather"],
      ["quick_links", "habits"],
      ["system"],
    ];
    const isVisible = (id: WidgetId) => id !== "quick_links";
    const result = moveWidgetInLayout(layout, "habits", "up", isVisible);
    expect(result[0]).toEqual(["weather", "habits"]);
    expect(result[1]).toEqual(["quick_links"]);
  });
});
