import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithProviders } from '@/test-utils/render';
import { mockChore, mockUser } from '@/test-utils/mocks';
import { ChoresList } from '@/pages/chores/_component/ChoresList';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useSearch: vi.fn().mockReturnValue({}),
  useNavigate: vi.fn().mockReturnValue(vi.fn()),
  useParams: vi.fn().mockReturnValue({}),
}));

// Mock shared hooks since they are already tested in apps/shared
vi.mock('@hously/shared', async importOriginal => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useChores: vi.fn(),
    useClearAllCompletedChores: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useReorderChores: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useToggleChore: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useDeleteChore: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  };
});

import { useChores } from '@/hooks/useChores';

describe('ChoresList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chores list', async () => {
    (useChores as any).mockReturnValue({
      data: {
        chores: [mockChore],
        users: [mockUser],
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<ChoresList />);

    await waitFor(() => {
      expect(screen.getByText(mockChore.chore_name)).toBeInTheDocument();
    });
  });

  it('shows empty state when no chores', async () => {
    (useChores as any).mockReturnValue({
      data: {
        chores: [],
        users: [mockUser],
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<ChoresList />);

    await waitFor(() => {
      expect(screen.getByText('chores.noChores')).toBeInTheDocument();
    });
  });
});
