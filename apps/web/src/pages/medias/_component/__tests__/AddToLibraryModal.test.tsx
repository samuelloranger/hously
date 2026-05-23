import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AddToLibraryModal } from "../AddToLibraryModal";

vi.mock("@/pages/medias/_component/TmdbMediaSearchPanel", () => ({
  TmdbMediaSearchPanel: ({ variant }: { variant: string }) => (
    <div data-testid="tmdb-panel" data-variant={variant} />
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

describe("AddToLibraryModal", () => {
  it("renders the search panel when open", () => {
    render(<AddToLibraryModal isOpen onClose={vi.fn()} />);
    expect(screen.getByTestId("tmdb-panel")).toBeInTheDocument();
  });

  it("does not render panel content when closed", () => {
    render(<AddToLibraryModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("tmdb-panel")).not.toBeInTheDocument();
  });
});
