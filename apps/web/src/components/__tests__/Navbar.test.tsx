import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "../Navbar";
import type { User } from "@/types";
import { mockUser } from "../../test-utils/mocks";

// Mock the logout function
vi.mock("../../lib/auth", () => ({
  logout: vi.fn(),
}));

describe("Navbar", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("renders user display name", () => {
    render(<Navbar user={mockUser} />);
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Navbar user={mockUser} />);
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/shopping/i)).toBeInTheDocument();
    expect(screen.getByText(/chores/i)).toBeInTheDocument();
  });

  it("renders theme toggle button", () => {
    render(<Navbar user={mockUser} />);
    const themeButton = screen.getByLabelText(/toggle theme/i);
    expect(themeButton).toBeInTheDocument();
  });

  it("formats display name correctly", () => {
    const userWithNames: User = {
      ...mockUser,
      first_name: "john",
      last_name: "doe",
    };
    render(<Navbar user={userWithNames} />);
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
  });
});
