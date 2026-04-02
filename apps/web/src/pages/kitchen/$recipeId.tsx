import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser } from '@/lib/auth';
import { prefetchRouteData } from '@/lib/routing/prefetch';
import { RecipeDetail } from '@/pages/kitchen/_component/RecipeDetail';
import type { RecipeDetailSearchParams } from '@/pages/kitchen/_component/RecipeDetail';

export { type RecipeDetailSearchParams };

export const Route = createFileRoute('/kitchen/$recipeId')({
  validateSearch: (search: Record<string, unknown>): RecipeDetailSearchParams => ({
    modal: search.modal === 'edit' || search.modal === 'delete' ? (search.modal as any) : undefined,
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
  loader: async ({ context, params }) => {
    await prefetchRouteData(context.queryClient, '/kitchen/$recipeId', params);
  },
  component: RecipeDetail,
});
