import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithProviders } from '@/test-utils/render';
import { mockDashboardStats, mockActivity, mockUser } from '@/test-utils/mocks';
import { Dashboard } from '@/features/dashboard';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useSearch: vi.fn().mockReturnValue({}),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock hooks
vi.mock('@/hooks/usePrefetchRoute', () => ({
  usePrefetchRoute: () => vi.fn(),
}));

// Mock shared hooks
vi.mock('@hously/shared', async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useDashboardStats: vi.fn(),
    useDashboardActivityFeed: vi.fn(),
    useDashboardActivities: vi.fn(),
    useDashboardQbittorrent: vi.fn().mockReturnValue({ data: { torrents: [] }, isLoading: false }),
    useDashboardScrutiny: vi.fn().mockReturnValue({ data: { hosts: [] }, isLoading: false }),
    useDashboardNetdata: vi.fn().mockReturnValue({ data: { nodes: [] }, isLoading: false }),
    useDashboardAdguard: vi.fn().mockReturnValue({ data: { stats: {} }, isLoading: false }),
    useDashboardKopia: vi.fn().mockReturnValue({ data: { status: {} }, isLoading: false }),
    useDashboardUnraid: vi.fn().mockReturnValue({ data: { status: {} }, isLoading: false }),
    useCurrentUser: vi.fn(),
    useChores: vi.fn().mockReturnValue({ data: { chores: [], users: [] }, isLoading: false }),
    useWeather: vi.fn().mockReturnValue({ data: { current: {} }, isLoading: false }),
    useJellyfinLatest: vi.fn().mockReturnValue({ data: { items: [] }, isLoading: false }),
    useCalendarEvents: vi.fn().mockReturnValue({ data: [], isLoading: false }),
    useMediaAutoSearch: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useTrackerStats: vi.fn().mockReturnValue({ data: { stats: [] }, isLoading: false }),
    useDashboardActivityPage: vi.fn().mockReturnValue({ data: { activities: [] }, isLoading: false }),
  };
});

import { useDashboardStats, useDashboardActivities, useCurrentUser } from '@hously/shared';

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useCurrentUser as any).mockReturnValue({ data: mockUser, isLoading: false });
  });

  it('renders dashboard stats', async () => {
    (useDashboardStats as any).mockReturnValue({
      data: { stats: mockDashboardStats },
      isLoading: false,
    });
    (useDashboardActivities as any).mockReturnValue({
      data: { activities: [mockActivity] },
      isLoading: false,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('dashboard.shoppingItems')).toBeInTheDocument();
      expect(screen.getByText(String(mockDashboardStats.shopping_count))).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    (useDashboardStats as any).mockReturnValue({
      data: null,
      isLoading: true,
    });
    (useDashboardActivities as any).mockReturnValue({
      data: null,
      isLoading: true,
    });

    renderWithProviders(<Dashboard />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays activities when available', async () => {
    (useDashboardStats as any).mockReturnValue({
      data: { stats: mockDashboardStats },
      isLoading: false,
    });
    (useDashboardActivities as any).mockReturnValue({
      data: { activities: [mockActivity] },
      isLoading: false,
    });

    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      // Check for the translation key or parts of the description
      expect(screen.getByText(/dashboard.activity.shoppingItemAdded/i)).toBeInTheDocument();
      expect(screen.getByText(/Milk/i)).toBeInTheDocument();
    });
  });
});
