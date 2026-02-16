import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockDashboardStats, mockActivity } from '../../test-utils/mocks';
import { Dashboard } from '@/features/dashboard';

const mockGetDashboardStats = vi.fn();
const mockGetDashboardActivities = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    getDashboardStats: () => mockGetDashboardStats(),
    getDashboardActivities: (limit?: number) => mockGetDashboardActivities(limit),
    getDashboardJellyfinLatest: vi.fn(),
  },
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'test@test.com',
      first_name: null,
      last_name: null,
      is_admin: false,
      last_login: null,
      created_at: '2024-01-01',
      last_activity: null,
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

describe('Dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders dashboard stats', async () => {
    mockGetDashboardStats.mockResolvedValue({
      stats: mockDashboardStats,
      activities: [mockActivity],
    });
    mockGetDashboardActivities.mockResolvedValue({
      activities: [mockActivity],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/shopping items/i)).toBeInTheDocument();
      expect(screen.getByText(String(mockDashboardStats.shopping_count))).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockGetDashboardStats.mockImplementation(() => new Promise(() => {}));
    mockGetDashboardActivities.mockImplementation(() => new Promise(() => {}));

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it('displays activities when available', async () => {
    mockGetDashboardStats.mockResolvedValue({
      stats: mockDashboardStats,
      activities: [mockActivity],
    });
    mockGetDashboardActivities.mockResolvedValue({
      activities: [mockActivity],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(mockActivity.description!)).toBeInTheDocument();
    });
  });
});
