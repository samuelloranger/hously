import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, renderWithProviders } from "@/test-utils/render";
import { RootLayout } from "../Layout";

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="outlet" />,
  ScrollRestoration: () => <div data-testid="scroll-restoration" />,
  useRouter: () => ({
    state: { isLoading: false },
  }),
  useRouterState: vi.fn().mockReturnValue({
    isLoading: false,
    location: { pathname: "/" },
  }),
  useLocation: vi.fn().mockReturnValue({ pathname: "/" }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock shared hooks
vi.mock("@hously/shared", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useCurrentUser: vi.fn(),
    useNotifications: vi.fn().mockReturnValue({
      permission: "default",
      requestPermission: vi.fn(),
      subscription: null,
      subscribe: vi.fn(),
      isSupported: true,
    }),
    useNotificationDevices: vi.fn().mockReturnValue({ refetch: vi.fn() }),
  };
});

// Mock hooks
vi.mock("@/hooks/useAutoSubscribeNotifications", () => ({
  useAutoSubscribeNotifications: vi.fn().mockReturnValue({
    showModal: false,
    handleAllow: vi.fn(),
    handleDismiss: vi.fn(),
  }),
}));

import { useCurrentUser } from "@/hooks/useAuth";

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when user is authenticated", () => {
    (useCurrentUser as any).mockReturnValue({
      data: {
        id: 1,
        email: "test@test.com",
        first_name: "Test",
        last_name: "User",
        is_admin: false,
      },
      isLoading: false,
    });

    renderWithProviders(<RootLayout />);
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });

  it("renders sidebar when not on login page", () => {
    (useCurrentUser as any).mockReturnValue({
      data: { id: 1, email: "test@test.com" },
      isLoading: false,
    });

    renderWithProviders(<RootLayout />);
    // There are multiple "Hously" texts (mobile and desktop)
    expect(screen.getAllByText("Hously").length).toBeGreaterThan(0);
  });
});
