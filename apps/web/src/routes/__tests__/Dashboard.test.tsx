import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockDashboardStats, mockActivity } from "../../test-utils/mocks";
import * as apiModule from "../../lib/api";
import { Dashboard } from "@/features/dashboard";

vi.mock("../../lib/api");
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: "test@test.com",
      first_name: null,
      last_name: null,
      is_admin: false,
      last_login: null,
      created_at: "2024-01-01",
      last_activity: null,
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

describe("Dashboard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("renders dashboard stats", async () => {
    vi.mocked(apiModule.api.getDashboardStats).mockResolvedValue({
      stats: mockDashboardStats,
      activities: [mockActivity],
    });
    vi.mocked(apiModule.api.getDashboardActivities).mockResolvedValue({
      activities: [mockActivity],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/shopping items/i)).toBeInTheDocument();
      expect(
        screen.getByText(String(mockDashboardStats.shopping_count))
      ).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    vi.mocked(apiModule.api.getDashboardStats).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    vi.mocked(apiModule.api.getDashboardActivities).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("displays activities when available", async () => {
    vi.mocked(apiModule.api.getDashboardStats).mockResolvedValue({
      stats: mockDashboardStats,
      activities: [mockActivity],
    });
    vi.mocked(apiModule.api.getDashboardActivities).mockResolvedValue({
      activities: [mockActivity],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(mockActivity.description)).toBeInTheDocument();
    });
  });
});
