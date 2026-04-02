import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser } from '@/lib/auth';
import { prefetchRouteData } from '@/lib/routing/prefetch';
import { KitchenPage } from '@/pages/kitchen/_component/KitchenPage';

export type KitchenSearchParams = { modal?: 'create' };

export const Route = createFileRoute('/kitchen/')({
  validateSearch: (search: Record<string, unknown>): KitchenSearchParams => ({
    modal: search.modal === 'create' ? search.modal : undefined,
  }),
  beforeLoad: async () => {
    try {
      const user = await getCurrentUser();
      if (!user) throw redirect({ to: '/login' });
      return { user };
    } catch (e: any) {
      if (e?.status === 429) return { user: null };
      throw e;
    }
  },
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/kitchen');
  },
  component: KitchenPage,
});
