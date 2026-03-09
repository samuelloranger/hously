import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test-utils/render';
import { AdguardOverviewCard } from '../AdguardOverviewCard';

const mockUseDashboardAdguardSummary = vi.fn();
const mockUseSetAdguardProtection = vi.fn();
const mockUseAuth = vi.fn();
const mockPrefetchRoute = vi.fn();

const translations: Record<string, string> = {
  'dashboard.adguard.kicker': 'From your DNS shield',
  'dashboard.adguard.title': 'AdGuard Home',
  'dashboard.adguard.subtitle': 'DNS protection and turning AdGuard on or off from Hously.',
  'dashboard.adguard.disconnected': 'Disconnected',
  'dashboard.adguard.protectionOn': 'Protection on',
  'dashboard.adguard.protectionOff': 'Protection paused',
  'dashboard.adguard.turnOn': 'Turn AdGuard on',
  'dashboard.adguard.turnOff': 'Turn AdGuard off',
  'dashboard.adguard.updating': 'Updating...',
  'dashboard.adguard.notConnectedTitle': 'AdGuard Home is not connected yet',
  'dashboard.adguard.notConnectedDescription': 'Connect AdGuard Home',
  'dashboard.adguard.queries': 'Queries',
  'dashboard.adguard.blocked': 'Blocked',
  'dashboard.adguard.blockRate': 'Block rate',
  'dashboard.adguard.avgTime': 'Avg time',
};

vi.mock('@hously/shared', () => ({
  useDashboardAdguardSummary: () => mockUseDashboardAdguardSummary(),
  useSetAdguardProtection: () => mockUseSetAdguardProtection(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock('../../../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../../hooks/usePrefetchRoute', () => ({
  usePrefetchRoute: () => mockPrefetchRoute,
}));

describe('AdguardOverviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { is_admin: true } });
    mockUseSetAdguardProtection.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
    mockUseDashboardAdguardSummary.mockReturnValue({
      isLoading: false,
      data: {
        enabled: true,
        connected: true,
        protection_enabled: true,
        summary: {
          dns_queries: 1234,
          blocked_queries: 120,
          blocked_ratio: 9.7,
          avg_processing_time_ms: 1.2,
        },
      },
    });
  });

  it('toggles AdGuard protection off from the dashboard card', () => {
    const mutate = vi.fn();
    mockUseSetAdguardProtection.mockReturnValue({
      mutate,
      isPending: false,
      error: null,
    });

    renderWithProviders(<AdguardOverviewCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Turn AdGuard off' }));

    expect(mutate).toHaveBeenCalledWith({ enabled: false });
  });
});
