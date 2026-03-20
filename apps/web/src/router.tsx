import { createRouter, createRootRouteWithContext, createRoute, redirect } from '@tanstack/react-router';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { RootLayout } from './components/Layout';
import { getCurrentUser } from './lib/auth';
import type { Tab } from './routes/settings';
import { prefetchRouteData } from './lib/routePrefetch';
import type { QueryClient } from '@tanstack/react-query';

// Cache for lazy components to prevent recreating them
const lazyComponentCache = new Map<string, LazyExoticComponent<ComponentType<any>>>();

/**
 * Creates a cached lazy component that only imports once
 * This prevents re-importing modules when components remount
 */
function cachedLazy<T extends ComponentType<any>>(
  cacheKey: string,
  importFn: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  // If already cached, return the cached lazy component
  if (lazyComponentCache.has(cacheKey)) {
    return lazyComponentCache.get(cacheKey)! as LazyExoticComponent<T>;
  }

  // Create lazy component and cache it
  const lazyComponent = lazy(() => importFn());
  lazyComponentCache.set(cacheKey, lazyComponent);

  return lazyComponent;
}

// Lazy load route components for code splitting with caching
const Dashboard = cachedLazy('dashboard', () => import('./features/dashboard').then(m => ({ default: m.Dashboard })));
const RecentActivityPage = cachedLazy('recent-activity', () =>
  import('./features/dashboard/RecentActivityPage').then(m => ({ default: m.RecentActivityPage }))
);
const Login = cachedLazy('login', () => import('./routes/login').then(m => ({ default: m.Login })));
const ForgotPassword = cachedLazy('forgot-password', () =>
  import('./routes/forgot-password').then(m => ({ default: m.ForgotPassword }))
);
const ResetPassword = cachedLazy('reset-password', () =>
  import('./routes/reset-password').then(m => ({ default: m.ResetPassword }))
);
const AcceptInvitation = cachedLazy('accept-invitation', () =>
  import('./routes/accept-invitation').then(m => ({ default: m.AcceptInvitation }))
);
const ShoppingList = cachedLazy('shopping', () =>
  import('./features/shopping').then(m => ({ default: m.ShoppingList }))
);
const ChoresList = cachedLazy('chores', () => import('./features/chores').then(m => ({ default: m.ChoresList })));
const HabitsList = cachedLazy('habits', () => import('./features/habits').then(m => ({ default: m.HabitsList })));
const Calendar = cachedLazy('calendar', () => import('./features/calendar').then(m => ({ default: m.Calendar })));
const Settings = cachedLazy('settings', () => import('./routes/settings').then(m => ({ default: m.Settings })));
const Notifications = cachedLazy('notifications', () =>
  import('./routes/notifications').then(m => ({ default: m.Notifications }))
);
const KitchenPage = cachedLazy('kitchen', () => import('./features/recipes').then(m => ({ default: m.KitchenPage })));
const ExplorePage = cachedLazy('explore', () => import('./features/medias').then(m => ({ default: m.ExplorePage })));
const LibraryPage = cachedLazy('library', () => import('./features/medias').then(m => ({ default: m.LibraryPage })));
const ReleasesPage = cachedLazy('releases', () => import('./features/medias').then(m => ({ default: m.ReleasesPage })));
const RecipeDetail = cachedLazy('recipeDetail', () =>
  import('./features/recipes').then(m => ({ default: m.RecipeDetail }))
);
const Privacy = cachedLazy('privacy', () => import('./routes/privacy').then(m => ({ default: m.Privacy })));
const Terms = cachedLazy('terms', () => import('./routes/terms').then(m => ({ default: m.Terms })));
const TorrentsPage = cachedLazy('torrents', () =>
  import('./features/torrents').then(m => ({ default: m.TorrentsPage }))
);
const TorrentDetailPage = cachedLazy('torrent-detail', () =>
  import('./features/torrents/TorrentDetailPage').then(m => ({ default: m.TorrentDetailPage }))
);

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

/**
 * Helper to require authentication for a route.
 * Redirects to /login if not authenticated, but NOT if rate limited (429).
 */
const requireAuth = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
    return { user };
  } catch (e: any) {
    // If it's a 429, don't redirect to login.
    // This allows the user to stay on the page and see the toast error.
    if (e?.status === 429) {
      return { user: null };
    }
    throw e;
  }
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/');
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
  beforeLoad: async () => {
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: '/' });
    }
  },
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: RecentActivityPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      service: typeof search.service === 'string' ? search.service : '',
      type: typeof search.type === 'string' ? search.type : '',
    };
  },
  beforeLoad: requireAuth,
  loaderDeps: ({ search: { service, type } }) => ({ service, type }),
  loader: async ({ context, deps }) => {
    await prefetchRouteData(context.queryClient, '/activity', deps);
  },
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPassword,
  beforeLoad: async () => {
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: '/' });
    }
  },
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: ResetPassword,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || '',
    };
  },
  beforeLoad: async () => {
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: '/' });
    }
  },
});

const acceptInvitationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accept-invitation',
  component: AcceptInvitation,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || '',
    };
  },
  beforeLoad: async () => {
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      throw redirect({ to: '/' });
    }
  },
});

const shoppingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shopping',
  component: ShoppingList,
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/shopping');
  },
});

export type ChoresSearchParams = {
  modal?: 'create' | 'edit';
  choreId?: number;
  viewImage?: string;
};

const choresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chores',
  component: ChoresList,
  validateSearch: (search: Record<string, unknown>): ChoresSearchParams => ({
    modal: search.modal === 'create' || search.modal === 'edit' ? (search.modal as any) : undefined,
    choreId: parseOptionalInt(search.choreId),
    viewImage: typeof search.viewImage === 'string' ? search.viewImage : undefined,
  }),
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/chores');
  },
});

export type HabitsSearchParams = {
  modal?: 'create' | 'edit';
  habitId?: number;
};

const habitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/habits',
  component: HabitsList,
  validateSearch: (search: Record<string, unknown>): HabitsSearchParams => ({
    modal: search.modal === 'create' || search.modal === 'edit' ? (search.modal as any) : undefined,
    habitId: parseOptionalInt(search.habitId),
  }),
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/habits');
  },
});

export type CalendarSearchParams = {
  date?: string;
  eventId?: number;
  modal?: 'create' | 'edit';
};

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: Calendar,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
    eventId: parseOptionalInt(search.eventId),
    modal: search.modal === 'create' || search.modal === 'edit' ? (search.modal as any) : undefined,
  }),
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/calendar');
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as Tab) || 'profile',
    };
  },
  beforeLoad: requireAuth,
  loaderDeps: ({ search: { tab } }) => ({ tab }),
  loader: async ({ context, deps }) => {
    await prefetchRouteData(context.queryClient, '/settings', deps);
  },
});

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: Notifications,
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/notifications');
  },
});

export type KitchenSearchParams = {
  modal?: 'create';
};

const kitchenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kitchen',
  component: KitchenPage,
  validateSearch: (search: Record<string, unknown>): KitchenSearchParams => ({
    modal: search.modal === 'create' ? search.modal : undefined,
  }),
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/kitchen');
  },
});

export type RecipeDetailSearchParams = {
  modal?: 'edit' | 'delete';
};

const recipeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kitchen/$recipeId',
  component: RecipeDetail,
  validateSearch: (search: Record<string, unknown>): RecipeDetailSearchParams => ({
    modal: search.modal === 'edit' || search.modal === 'delete' ? (search.modal as any) : undefined,
  }),
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    await prefetchRouteData(context.queryClient, '/kitchen/$recipeId', params);
  },
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: Privacy,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: Terms,
});

const torrentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/torrents',
  component: TorrentsPage,
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/torrents');
  },
});

const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  component: ExplorePage,
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/explore');
  },
});

export type LibrarySearchParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  current_media_id?: string;
  current_media_tab?: string;
  current_media_release?: number;
  scrollToMedia?: string;
};

const parseOptionalInt = (val: unknown): number | undefined =>
  typeof val === 'number' ? val : typeof val === 'string' && val ? Number(val) || undefined : undefined;

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/library',
  component: LibraryPage,
  validateSearch: (search: Record<string, unknown>): LibrarySearchParams => ({
    page: parseOptionalInt(search.page),
    pageSize: parseOptionalInt(search.pageSize),
    search: typeof search.search === 'string' && search.search ? search.search : undefined,
    current_media_id: typeof search.current_media_id === 'string' ? search.current_media_id : undefined,
    current_media_tab: typeof search.current_media_tab === 'string' ? search.current_media_tab : undefined,
    current_media_release: parseOptionalInt(search.current_media_release),
    scrollToMedia: typeof search.scrollToMedia === 'string' ? search.scrollToMedia : undefined,
  }),
  beforeLoad: requireAuth,
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, '/library');
  },
});

const releasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/releases',
  component: ReleasesPage,
  beforeLoad: requireAuth,
});

const torrentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/torrents/$hash',
  component: TorrentDetailPage,
  beforeLoad: requireAuth,
  loader: async ({ context, params }) => {
    await prefetchRouteData(context.queryClient, '/torrents/$hash', params);
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  activityRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  acceptInvitationRoute,
  shoppingRoute,
  choresRoute,
  habitsRoute,
  calendarRoute,
  settingsRoute,
  notificationsRoute,
  kitchenRoute,
  recipeDetailRoute,
  privacyRoute,
  termsRoute,
  torrentsRoute,
  exploreRoute,
  libraryRoute,
  releasesRoute,
  torrentDetailRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
    queryClient: undefined!, // Will be provided in main.tsx
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
