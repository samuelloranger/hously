import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmartTilesStrip } from "./SmartTilesStrip";

vi.mock("@/pages/_component/tileComponents", () => ({
  TILE_COMPONENTS: {
    chores_today: () => <div data-testid="tile-chores">chores</div>,
    habit_streak: () => <div data-testid="tile-streak">streak</div>,
  },
}));

describe("SmartTilesStrip", () => {
  it("renders configured registered tiles in layout order", () => {
    render(<SmartTilesStrip layout={["habit_streak", "chores_today"]} />);
    const tiles = screen.getAllByTestId(/^tile-/);
    expect(tiles.map((el) => el.getAttribute("data-testid"))).toEqual([
      "tile-streak",
      "tile-chores",
    ]);
  });

  it("skips ids with no registered component", () => {
    render(<SmartTilesStrip layout={["weather", "chores_today"] as never} />);
    expect(screen.queryByTestId("tile-chores")).toBeTruthy();
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(1);
  });

  it("renders nothing when no tiles resolve", () => {
    const { container } = render(<SmartTilesStrip layout={["weather"] as never} />);
    expect(container.firstChild).toBeNull();
  });
});
