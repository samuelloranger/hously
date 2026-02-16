import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Navbar } from '../Navbar';
import { mockUser } from '../../test-utils/mocks';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../lib/auth', () => ({
  clearUser: vi.fn(),
}));

vi.mock('@hously/shared', () => ({
  useLogout: () => ({
    mutateAsync: mockLogout,
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
  useRouterState: () => ({
    location: { pathname: '/' },
  }),
}));

vi.mock('../../hooks/usePrefetchRoute', () => ({
  usePrefetchRoute: () => () => {},
}));

vi.mock('./NotificationsBell', () => ({
  NotificationsMenu: () => <div>Notifications</div>,
}));

vi.mock('./UserMenu', () => ({
  UserMenu: ({ user }: { user: { first_name: string | null; last_name: string | null; email: string } }) => (
    <div>{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email}</div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.shopping': 'Shopping',
        'nav.chores': 'Chores',
        'nav.kitchen': 'Kitchen',
        'calendar.title': 'Calendar',
      };
      return translations[key] || key;
    },
  }),
}));

describe('Navbar', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    mockUseAuth.mockReset();
  });

  it('renders user display name', () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
    });

    render(<Navbar />);
    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    mockUseAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
    });

    render(<Navbar />);
    expect(screen.getByText(/Shopping/i)).toBeInTheDocument();
    expect(screen.getByText(/Chores/i)).toBeInTheDocument();
  });

  it('shows loading when no user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
    });

    render(<Navbar />);
  });
});
