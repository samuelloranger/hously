import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithProviders } from '@/test-utils/render';
import { Calendar } from '@/pages/calendar/_component/Calendar';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useSearch: vi.fn().mockReturnValue({}),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  useParams: vi.fn().mockReturnValue({}),
}));

// Mock shared hooks
vi.mock('@hously/shared', async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useCalendarEvents: vi.fn(),
    useDeleteCustomEvent: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useDashboardUpcoming: vi.fn().mockReturnValue({
      data: { items: [], enabled: true },
      isLoading: false,
    }),
  };
});

import { useCalendarEvents } from '@/hooks/useCalendar';

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders calendar', async () => {
    (useCalendarEvents as any).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<Calendar />);

    await waitFor(() => {
      expect(screen.getAllByText('calendar.title').length).toBeGreaterThan(0);
    });
  });

  it('shows event dots when events are present', async () => {
    const mockEvent = {
      id: '1',
      date: new Date().toISOString().split('T')[0],
      type: 'custom_event',
      title: 'Test Event',
      metadata: { color: '#ff0000', custom_event_id: 1 },
    };

    (useCalendarEvents as any).mockReturnValue({
      data: [mockEvent],
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<Calendar />);

    await waitFor(() => {
      // The day button should have a dot
      const dots = document.querySelectorAll('.rounded-full.transition-transform');
      expect(dots.length).toBeGreaterThan(0);
    });
  });
});
