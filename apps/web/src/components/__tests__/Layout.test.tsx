import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RootLayout } from "../Layout";
import * as useAuthHook from "../../hooks/useAuth";

vi.mock("../../hooks/useAuth");

describe("RootLayout", () => {
  it("shows loading state when auth is loading", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RootLayout />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders navbar when user is authenticated", () => {
    vi.mocked(useAuthHook.useAuth).mockReturnValue({
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
      error: null,
      refetch: vi.fn(),
    });

    render(<RootLayout />);
    expect(screen.getByText(/hously/i)).toBeInTheDocument();
  });
});
