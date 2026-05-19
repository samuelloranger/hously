import { describe, expect, it } from "bun:test";
import { WIDGETS } from "../constants/widgets";

describe("WIDGETS registry", () => {
  it("contains exactly 17 widgets", () => {
    expect(WIDGETS.length).toBe(17);
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
