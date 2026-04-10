import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "@/test-utils/render";
import { TorrentsPage } from "@/pages/torrents/_component";
import { useDashboardQbittorrentTorrents } from "@/hooks/dashboard/useDashboard";

const mockNavigate = vi.fn();
let mockSearch: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useSearch: vi.fn(() => mockSearch),
  useNavigate: vi.fn(() => mockNavigate),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (typeof fallbackOrOptions === "object" && fallbackOrOptions !== null) {
        const o = fallbackOrOptions as Record<string, unknown>;
        if ("count" in o && "total" in o) {
          return `${key}:${String(o.count)}:${String(o.total)}`;
        }
      }
      if (typeof fallbackOrOptions === "string") return fallbackOrOptions;
      return key;
    },
  }),
}));

vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/pages/torrents/_component/AddTorrentPanel", () => ({
  AddTorrentPanel: () => <div>Add Torrent</div>,
}));

vi.mock("@/pages/torrents/_component/TorrentRow", () => ({
  TorrentRow: ({ torrent }: { torrent: { name: string } }) => (
    <div>{torrent.name}</div>
  ),
}));

vi.mock("@/hooks/realtime/useEventSourceState", () => ({
  useEventSourceState: ({
    initialData,
  }: {
    initialData?: {
      summary?: { download_speed: number; upload_speed: number };
    };
  }) => ({
    data: initialData ?? null,
    streamConnected: true,
  }),
}));

vi.mock("@/hooks/dashboard/useDashboard", () => ({
  useDashboardQbittorrentTorrents: vi.fn(),
  usePinnedQbittorrentTorrent: vi.fn(() => ({ data: null })),
  useSetPinnedQbittorrentTorrent: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@hously/shared", async () => {
  return {
    DASHBOARD_ENDPOINTS: {
      QBITTORRENT: {
        STREAM: "/api/dashboard/qbittorrent/stream",
        TORRENTS_STREAM: "/api/qbittorrent/torrents/stream",
      },
    },
    QBITTORRENT_TORRENTS_PAGE_SIZE: 50,
    buildQbittorrentTorrentsStreamUrl: (base: string, offset: number) =>
      `${base}${base.includes("?") ? "&" : "?"}offset=${offset}`,
    QBITTORRENT_STATE_FILTERS: [
      { id: "all", labelKey: "torrents.filterAll" },
      { id: "downloading", labelKey: "torrents.filterDownloading" },
      { id: "uploading", labelKey: "torrents.filterUploading" },
      { id: "seeding", labelKey: "torrents.filterSeeding" },
      { id: "paused", labelKey: "torrents.filterPaused" },
      { id: "complete", labelKey: "torrents.filterComplete" },
      { id: "stalled", labelKey: "torrents.filterStalled" },
      { id: "error", labelKey: "torrents.filterError" },
    ],
    countQbittorrentTorrentsByState: (items: typeof torrents) => {
      const counts: Record<string, number> = {};

      for (const torrent of items) {
        const stateFilter =
          torrent.state === "pauseddl" ? "paused" : torrent.state;
        counts[stateFilter] = (counts[stateFilter] ?? 0) + 1;
      }

      return counts;
    },
    filterAndSortQbittorrentTorrents: (items: typeof torrents, options: any) =>
      [...items]
        .filter((torrent) => {
          const matchesState =
            options.stateFilter === "all" ||
            (options.stateFilter === "paused"
              ? torrent.state === "pauseddl"
              : torrent.state === options.stateFilter);
          const matchesCategory =
            options.selectedCategories.length === 0 ||
            options.selectedCategories.includes(torrent.category);
          const matchesTag =
            options.selectedTags.length === 0 ||
            options.selectedTags.some((tag: string) =>
              torrent.tags.includes(tag),
            );
          const matchesSearch =
            !options.search ||
            torrent.name.toLowerCase().includes(options.search.toLowerCase());

          return matchesState && matchesCategory && matchesTag && matchesSearch;
        })
        .sort((left, right) => {
          let comparison = 0;

          if (options.sortBy === "name")
            comparison = left.name.localeCompare(right.name);
          else if (options.sortBy === "size")
            comparison = left.size_bytes - right.size_bytes;
          else if (options.sortBy === "download_speed")
            comparison = left.download_speed - right.download_speed;
          else if (options.sortBy === "upload_speed")
            comparison = left.upload_speed - right.upload_speed;
          else if (options.sortBy === "ratio")
            comparison = left.ratio - right.ratio;
          else comparison = left.added_on.localeCompare(right.added_on);

          return options.sortDir === "asc" ? comparison : -comparison;
        }),
    formatSpeed: (value: number) => `${value} B/s`,
    getUniqueQbittorrentCategories: (items: typeof torrents) => [
      ...new Set(items.map((torrent) => torrent.category)),
    ],
    getUniqueQbittorrentTags: (items: typeof torrents) => [
      ...new Set(items.flatMap((torrent) => torrent.tags)),
    ],
    queryKeys: {
      dashboard: {
        qbittorrentTorrents: (params: Record<string, unknown>) => [
          "qbittorrent-torrents",
          params,
        ],
        qbittorrentPinnedTorrent: () => ["qbittorrent-pinned-torrent"],
      },
    },
    useDashboardQbittorrentTorrents: vi.fn(),
    useQbittorrentStatus: vi.fn(() => ({
      data: {
        enabled: true,
        connected: true,
        updated_at: "",
        poll_interval_seconds: 30,
        summary: {
          downloading_count: 0,
          stalled_count: 0,
          seeding_count: 0,
          paused_count: 0,
          completed_count: 0,
          total_count: 3,
          download_speed: 15,
          upload_speed: 2,
          downloaded_bytes: 0,
          uploaded_bytes: 0,
        },
        torrents: [],
      },
      isPending: false,
    })),
    usePinnedQbittorrentTorrent: vi.fn(() => ({
      data: { pinned_hash: null, torrent: null },
    })),
    useSetPinnedQbittorrentTorrent: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useJsonEventSource: vi.fn(),
  };
});

const torrents = [
  {
    id: "movie-4k",
    hash: "movie-4k",
    name: "Movie 4K",
    state: "downloading",
    category: "movies",
    tags: ["4k"],
    ratio: 1,
    added_on: "2024-01-03T00:00:00.000Z",
    size_bytes: 100,
    download_speed: 10,
    upload_speed: 1,
  },
  {
    id: "movie-1080p",
    hash: "movie-1080p",
    name: "Movie 1080p",
    state: "downloading",
    category: "movies",
    tags: ["1080p"],
    ratio: 1,
    added_on: "2024-01-02T00:00:00.000Z",
    size_bytes: 90,
    download_speed: 5,
    upload_speed: 1,
  },
  {
    id: "series-weekly",
    hash: "series-weekly",
    name: "Series Weekly",
    state: "pauseddl",
    category: "series",
    tags: ["weekly"],
    ratio: 1,
    added_on: "2024-01-01T00:00:00.000Z",
    size_bytes: 80,
    download_speed: 0,
    upload_speed: 0,
  },
];

describe("TorrentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockSearch = {};

    (useDashboardQbittorrentTorrents as any).mockReturnValue({
      data: {
        enabled: true,
        connected: true,
        torrents,
        total_count: torrents.length,
        offset: 0,
        limit: 50,
        download_speed: 15,
        upload_speed: 2,
      },
      isPending: false,
    });
  });

  it("restores torrent filters from the URL on first load and updates when search params change", () => {
    mockSearch = {
      search: "movie",
      state: "downloading",
      categories: ["movies"],
      tags: ["4k"],
      sortBy: "name",
      sortDir: "asc",
    };

    const { rerender } = renderWithProviders(<TorrentsPage />);

    expect(screen.getByText("Movie 4K")).toBeInTheDocument();
    expect(screen.queryByText("Movie 1080p")).not.toBeInTheDocument();
    expect(screen.queryByText("Series Weekly")).not.toBeInTheDocument();

    mockSearch = {
      search: "series",
      state: "paused",
      categories: ["series"],
      tags: ["weekly"],
      sortBy: "name",
      sortDir: "desc",
    };

    rerender(<TorrentsPage />);

    expect(screen.getByText("Series Weekly")).toBeInTheDocument();
    expect(screen.queryByText("Movie 4K")).not.toBeInTheDocument();
    expect(screen.queryByText("Movie 1080p")).not.toBeInTheDocument();
  });

  it("keeps the speed strip mounted and locks pagination while the torrent list is pending", () => {
    (useDashboardQbittorrentTorrents as any).mockReturnValue({
      data: undefined,
      isPending: true,
    });
    mockSearch = { page: 2 };

    renderWithProviders(<TorrentsPage />);

    expect(screen.getByLabelText("torrents.prevPage")).toBeDisabled();
    expect(screen.getByLabelText("torrents.nextPage")).toBeDisabled();
  });

  it("keeps default array filters when router search includes undefined values", () => {
    mockSearch = {
      state: undefined,
      categories: undefined,
      tags: undefined,
    };

    renderWithProviders(<TorrentsPage />);

    expect(screen.getByText("Movie 4K")).toBeInTheDocument();
    expect(screen.getByText("Movie 1080p")).toBeInTheDocument();
    expect(screen.getByText("Series Weekly")).toBeInTheDocument();
  });

  it("pushes debounced search changes to router history", () => {
    vi.useFakeTimers();

    renderWithProviders(<TorrentsPage />);

    fireEvent.change(
      screen.getByPlaceholderText("dashboard.qbittorrent.searchPlaceholder"),
      {
        target: { value: "weekly" },
      },
    );

    expect(mockNavigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/torrents",
        search: { search: "weekly" },
        replace: false,
      }),
    );
  });

  it("pushes category changes to router history", () => {
    renderWithProviders(<TorrentsPage />);

    fireEvent.click(screen.getByLabelText("movies"));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/torrents",
        search: { categories: ["movies"] },
        replace: false,
      }),
    );
  });

  it("pushes tag changes to router history", () => {
    renderWithProviders(<TorrentsPage />);

    fireEvent.click(screen.getByLabelText("4k"));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/torrents",
        search: { tags: ["4k"] },
        replace: false,
      }),
    );
  });

  it("pushes state changes to router history", () => {
    renderWithProviders(<TorrentsPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /torrents\.filterPaused/i }),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/torrents",
        search: { state: "paused" },
        replace: false,
      }),
    );
  });

  it("pushes sort key and direction changes to router history", () => {
    const firstRender = renderWithProviders(<TorrentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "torrents.sortName" }));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/torrents",
        search: { sortBy: "name" },
        replace: false,
      }),
    );

    mockNavigate.mockClear();
    mockSearch = { sortBy: "name" };

    firstRender.unmount();
    renderWithProviders(<TorrentsPage />);

    fireEvent.click(screen.getByRole("button", { name: "torrents.sortName" }));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/torrents",
        search: { sortBy: "name", sortDir: "asc" },
        replace: false,
      }),
    );
  });
});
