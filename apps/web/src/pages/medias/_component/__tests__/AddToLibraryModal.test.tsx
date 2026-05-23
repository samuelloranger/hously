import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<AddToLibraryModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
