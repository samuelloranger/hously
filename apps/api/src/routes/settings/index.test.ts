import { describe, it, expect } from "bun:test";
import { getEffectiveTileLayout } from "@hously/shared/constants";

// The settings route persists dashboard_tile_layout verbatim; the route + UI
// rely on getEffectiveTileLayout to reconcile it. Cover that shared contract.
describe("dashboard_tile_layout reconciliation", () => {
  it("keeps a valid stored order", () => {
    const eff = getEffectiveTileLayout(["active_downloads", "latest_media"]);
    expect(eff[0]).toBe("active_downloads");
    expect(eff[1]).toBe("latest_media");
  });

  it("null falls back to defaults (latest_media first)", () => {
    expect(getEffectiveTileLayout(null)[0]).toBe("latest_media");
  });
});
