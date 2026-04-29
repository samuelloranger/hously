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
        "dashboard.home.libraryStats.title": "Library stats",
        "dashboard.home.libraryStats.openLibrary": "Library",
        "dashboard.home.libraryStats.totalMovies": "Total Movies",
        "dashboard.home.libraryStats.totalShows": "Total Shows",
        "dashboard.home.libraryStats.downloaded": "Downloaded",
        "dashboard.home.libraryStats.wanted": "Wanted",

        "dashboard.home.libraryStats.returningSeries": "Returning Series",
        "dashboard.home.libraryStats.storageUsed": "Storage Used",
        "dashboard.home.libraryStats.loadError": "Failed to load library stats",
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
          counts_by_status_type: [],
          storage_by_resolution: [],
          shows_by_tmdb_status: [],
        },
      },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<LibraryStatsPanel />);
    expect(screen.getByText("Total Movies")).toBeInTheDocument();
    expect(screen.getByText("Storage Used")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
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
