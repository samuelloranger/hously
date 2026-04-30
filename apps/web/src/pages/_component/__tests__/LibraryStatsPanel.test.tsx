import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test-utils/render";
import { LibraryStatsPanel } from "../LibraryStatsPanel";

const mockUseLibraryStats = vi.fn();

vi.mock("@/features/medias/hooks/useLibrary", () => ({
  useLibraryStats: () => mockUseLibraryStats(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "dashboard.libraryStats.title": "Library stats",
        "dashboard.libraryStats.openLibrary": "Library",
        "dashboard.libraryStats.downloaded": "Downloaded",
        "dashboard.libraryStats.wanted": "Wanted",
        "dashboard.libraryStats.returningSeries": "Returning Series",
        "dashboard.libraryStats.storageUsed": "Storage Used",
        "dashboard.libraryStats.loadError": "Failed to load library stats",
        "dashboard.libraryStats.mediaTypeSplit": "Media type",
        "dashboard.libraryStats.movies": "Movies",
        "dashboard.libraryStats.shows": "Shows",
        "dashboard.libraryStats.storageByQuality": "Storage by quality",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe("LibraryStatsPanel", () => {
  beforeEach(() => {
    mockUseLibraryStats.mockReset();
  });

  it("renders all KPI labels inside one card", () => {
    mockUseLibraryStats.mockReturnValue({
      data: {
        stats: {
          total_movies: 10,
          total_shows: 5,
          downloaded: 8,
          wanted: 7,
          returning_series: 3,
          storage_used_bytes: 1099511627776,
          storage_by_resolution: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LibraryStatsPanel />);
    expect(screen.getByText("Downloaded")).toBeInTheDocument();
    expect(screen.getByText("Wanted")).toBeInTheDocument();
    expect(screen.getByText("Returning Series")).toBeInTheDocument();
    expect(screen.getByText("Storage Used")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows loading placeholders", () => {
    mockUseLibraryStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = renderWithProviders(<LibraryStatsPanel />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows error message", () => {
    mockUseLibraryStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderWithProviders(<LibraryStatsPanel />);
    expect(
      screen.getByText("Failed to load library stats"),
    ).toBeInTheDocument();
  });
});
