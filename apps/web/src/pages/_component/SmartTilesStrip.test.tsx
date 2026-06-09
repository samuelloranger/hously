import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmartTilesStrip } from "./SmartTilesStrip";

vi.mock("@/pages/_component/tileComponents", () => ({
  TILE_COMPONENTS: {
    next_event: () => <div data-testid="tile-next-event">next event</div>,
    latest_media: () => <div data-testid="tile-latest-media">latest media</div>,
  },
}));

describe("SmartTilesStrip", () => {
  it("renders configured registered tiles in layout order", () => {
    render(<SmartTilesStrip layout={["latest_media", "next_event"]} />);
    const tiles = screen.getAllByTestId(/^tile-/);
    expect(tiles.map((el) => el.getAttribute("data-testid"))).toEqual([
      "tile-latest-media",
      "tile-next-event",
    ]);
  });

  it("skips ids with no registered component", () => {
    render(<SmartTilesStrip layout={["weather", "next_event"] as never} />);
    expect(screen.queryByTestId("tile-next-event")).toBeTruthy();
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(1);
  });

  it("renders nothing when no tiles resolve", () => {
    const { container } = render(
      <SmartTilesStrip layout={["weather"] as never} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
