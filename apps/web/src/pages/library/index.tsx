import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser } from '@/lib/auth';
import { prefetchRouteData } from '@/lib/routing/prefetch';
import { LibraryPage } from '@/pages/medias/_component/LibraryPage';

export type LibrarySearchParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  current_media_id?: string;
  current_media_tab?: string;
  scrollToMedia?: string;
};

const parseOptionalInt = (val: unknown): number | undefined =>
  typeof val === 'number' ? val : typeof val === 'string' && val ? Number(val) || undefined : undefined;

export const Route = createFileRoute('/library/')({
  validateSearch: (search: Record<string, unknown>): LibrarySearchParams => ({
    page: parseOptionalInt(search.page),
    pageSize: parseOptionalInt(search.pageSize),
    search: typeof search.search === 'string' && search.search ? search.search : undefined,
    current_media_id: typeof search.current_media_id === 'string' ? search.current_media_id : undefined,
    current_media_tab: typeof search.current_media_tab === 'string' ? search.current_media_tab : undefined,
    scrollToMedia: typeof search.scrollToMedia === 'string' ? search.scrollToMedia : undefined,
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
    await prefetchRouteData(context.queryClient, '/library');
  },
  component: LibraryPage,
});
