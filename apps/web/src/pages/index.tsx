import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser } from '@/lib/auth';
import { prefetchRouteData } from '@/lib/routing/prefetch';
import { HomePage } from '@/pages/_component/HomePage';

export const Route = createFileRoute('/')({
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
    await prefetchRouteData(context.queryClient, '/');
  },
  component: HomePage,
});
