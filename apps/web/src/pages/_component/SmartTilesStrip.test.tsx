import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmartTilesStrip } from "./SmartTilesStrip";

vi.mock("@/pages/_component/tileComponents", () => ({
  TILE_COMPONENTS: {
    active_downloads: () => (
      <div data-testid="tile-active-downloads">next event</div>
    ),
    latest_media: () => <div data-testid="tile-latest-media">latest media</div>,
  },
}));

describe("SmartTilesStrip", () => {
  it("renders configured registered tiles in layout order", () => {
    render(<SmartTilesStrip layout={["latest_media", "active_downloads"]} />);
    const tiles = screen.getAllByTestId(/^tile-/);
    expect(tiles.map((el) => el.getAttribute("data-testid"))).toEqual([
      "tile-latest-media",
      "tile-active-downloads",
    ]);
  });

  it("skips ids with no registered component", () => {
    render(
      <SmartTilesStrip layout={["weather", "active_downloads"] as never} />,
    );
    expect(screen.queryByTestId("tile-active-downloads")).toBeTruthy();
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(1);
  });

  it("renders nothing when no tiles resolve", () => {
    const { container } = render(
      <SmartTilesStrip layout={["weather"] as never} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
