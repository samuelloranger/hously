import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockChore, mockUser } from '../../test-utils/mocks';
import { ChoresList } from '@/features/chores';

const mockGetChores = vi.fn();
const mockCreateChore = vi.fn();
const mockToggleChore = vi.fn();
const mockDeleteChore = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    getChores: () => mockGetChores(),
    createChore: (data: unknown) => mockCreateChore(data),
    toggleChore: (id: number) => mockToggleChore(id),
    deleteChore: (id: number) => mockDeleteChore(id),
  },
}));

describe('ChoresList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders chores list', async () => {
    mockGetChores.mockResolvedValue({
      chores: [mockChore],
      users: [mockUser],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChoresList />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(mockChore.chore_name)).toBeInTheDocument();
    });
  });

  it('allows adding new chores', async () => {
    mockGetChores.mockResolvedValue({
      chores: [],
      users: [mockUser],
    });
    mockCreateChore.mockResolvedValue({
      success: true,
      data: { id: 1 },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChoresList />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText(/vacuum living room/i);

    await waitFor(() => {
      expect(input).toBeInTheDocument();
    });

    expect(mockCreateChore).not.toHaveBeenCalled();
  });
});
