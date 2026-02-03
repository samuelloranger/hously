import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockShoppingItem } from "../../test-utils/mocks";
import * as apiModule from "../../lib/api";
import { ShoppingList } from "@/features/shopping";

vi.mock("../../lib/api");

describe("ShoppingList", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("renders shopping list", async () => {
    vi.mocked(apiModule.api.getShoppingItems).mockResolvedValue({
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

  it("allows adding new items", async () => {
    const user = userEvent.setup();
    vi.mocked(apiModule.api.getShoppingItems).mockResolvedValue({
      items: [],
    });
    vi.mocked(apiModule.api.createShoppingItem).mockResolvedValue({
      success: true,
      data: { id: 1 },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ShoppingList />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText(/what do you need to buy/i);
    const submitButton = screen.getByText(/add item/i);

    await user.type(input, "Bread");
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiModule.api.createShoppingItem).toHaveBeenCalledWith({
        item_name: "Bread",
      });
    });
  });

  it("shows empty state when no items", async () => {
    vi.mocked(apiModule.api.getShoppingItems).mockResolvedValue({
      items: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ShoppingList />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no items in your shopping list/i)
      ).toBeInTheDocument();
    });
  });
});
