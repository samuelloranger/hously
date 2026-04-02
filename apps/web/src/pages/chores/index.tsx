import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser } from '@/lib/auth';
import { prefetchRouteData } from '@/lib/routing/prefetch';
import { ChoresList } from '@/pages/chores/_component/ChoresList';
import type { ChoresSearchParams } from '@/pages/chores/_component/ChoreRow';

export { type ChoresSearchParams };

function parseOptionalInt(val: unknown): number | undefined {
  return typeof val === 'number' ? val : typeof val === 'string' && val ? Number(val) || undefined : undefined;
}

export const Route = createFileRoute('/chores/')({
  validateSearch: (search: Record<string, unknown>): ChoresSearchParams => ({
    modal: search.modal === 'create' || search.modal === 'edit' ? (search.modal as any) : undefined,
    choreId: parseOptionalInt(search.choreId),
    viewImage: typeof search.viewImage === 'string' ? search.viewImage : undefined,
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
    await prefetchRouteData(context.queryClient, '/chores');
  },
  component: ChoresList,
});
