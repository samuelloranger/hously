import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, renderWithProviders } from '@/test-utils/render';
import { mockShoppingItem } from '@/test-utils/mocks';
import { ShoppingList } from '@/pages/shopping/_component/ShoppingList';

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
    useShoppingItems: vi.fn(),
    useCreateShoppingItem: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useToggleShoppingItem: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useDeleteShoppingItem: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useDeleteShoppingItems: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useClearAllCompletedShoppingItems: vi.fn().mockReturnValue({ mutate: vi.fn() }),
    useReorderShoppingItems: vi.fn().mockReturnValue({ mutate: vi.fn() }),
  };
});

import { useShoppingItems } from '@/hooks/useShopping';

describe('ShoppingList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders shopping list', async () => {
    (useShoppingItems as any).mockReturnValue({
      data: {
        items: [mockShoppingItem],
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<ShoppingList />);

    await waitFor(() => {
      expect(screen.getByText(mockShoppingItem.item_name)).toBeInTheDocument();
    });
  });

  it('shows empty state when no items', async () => {
    (useShoppingItems as any).mockReturnValue({
      data: {
        items: [],
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<ShoppingList />);

    await waitFor(() => {
      expect(screen.getByText('shopping.noItems')).toBeInTheDocument();
    });
  });

  it('filters shopping items with search and status chips', async () => {
    (useShoppingItems as any).mockReturnValue({
      data: {
        items: [
          mockShoppingItem,
          {
            ...mockShoppingItem,
            id: 2,
            item_name: 'Dish soap',
            notes: 'Kitchen sink',
            completed: true,
          },
        ],
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderWithProviders(<ShoppingList />);

    const searchInput = await screen.findByPlaceholderText('shopping.searchPlaceholder');
    fireEvent.change(searchInput, { target: { value: 'soap' } });

    await waitFor(() => {
      expect(screen.getByText('Dish soap')).toBeInTheDocument();
      expect(screen.queryByText('Milk')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'shopping.filters.completed' }));

    await waitFor(() => {
      expect(screen.getByText('Dish soap')).toBeInTheDocument();
    });
  });
});
