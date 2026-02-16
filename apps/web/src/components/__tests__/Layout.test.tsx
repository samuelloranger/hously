import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RootLayout } from '../Layout';

const mockUseAuth = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('RootLayout', () => {
  it('shows loading state when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RootLayout />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders navbar when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'test@test.com',
        first_name: null,
        last_name: null,
        is_admin: false,
        last_login: null,
        created_at: '2024-01-01',
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
