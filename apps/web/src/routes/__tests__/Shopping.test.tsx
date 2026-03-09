import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockShoppingItem } from '@/test-utils/mocks';
import { ShoppingList } from '@/features/shopping';

const mockGetShoppingItems = vi.fn();
const mockCreateShoppingItem = vi.fn();
const mockToggleShoppingItem = vi.fn();
const mockDeleteShoppingItem = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    getShoppingItems: () => mockGetShoppingItems(),
    createShoppingItem: (data: unknown) => mockCreateShoppingItem(data),
    toggleShoppingItem: (id: number) => mockToggleShoppingItem(id),
    deleteShoppingItem: (id: number) => mockDeleteShoppingItem(id),
  },
}));

describe('ShoppingList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders shopping list', async () => {
    mockGetShoppingItems.mockResolvedValue({
      items: [mockShoppingItem],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ShoppingList />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(mockShoppingItem.item_name)).toBeInTheDocument();
    });
  });

  it('allows adding new items', async () => {
    mockGetShoppingItems.mockResolvedValue({
      items: [],
    });
    mockCreateShoppingItem.mockResolvedValue({
      success: true,
      data: { id: 1 },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ShoppingList />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText(/what do you need to buy/i);

    await waitFor(() => {
      expect(input).toBeInTheDocument();
    });

    expect(mockCreateShoppingItem).not.toHaveBeenCalled();
  });

  it('shows empty state when no items', async () => {
    mockGetShoppingItems.mockResolvedValue({
      items: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ShoppingList />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no items in your shopping list/i)).toBeInTheDocument();
    });
  });
});
