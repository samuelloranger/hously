import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockChore, mockUser } from "../../test-utils/mocks";
import * as apiModule from "../../lib/api";
import { ChoresList } from "@/features/chores";

vi.mock("../../lib/api");

describe("ChoresList", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it("renders chores list", async () => {
    vi.mocked(apiModule.api.getChores).mockResolvedValue({
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

  it("allows adding new chores", async () => {
    const user = userEvent.setup();
    vi.mocked(apiModule.api.getChores).mockResolvedValue({
      chores: [],
      users: [mockUser],
    });
    vi.mocked(apiModule.api.createChore).mockResolvedValue({
      success: true,
      data: { id: 1 },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ChoresList />
      </QueryClientProvider>
    );

    const input = screen.getByPlaceholderText(/vacuum living room/i);
    const submitButton = screen.getByText(/add chore/i);

    await user.type(input, "Clean bathroom");
    await user.click(submitButton);

    await waitFor(() => {
      expect(apiModule.api.createChore).toHaveBeenCalled();
    });
  });
});
