import { createRouter, createRootRoute, createRoute, redirect } from '@tanstack/react-router';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { RootLayout } from './components/Layout';
import { getCurrentUser, clearUser } from './lib/auth';
import type { Tab } from './routes/settings';
import { getQueryClient } from './lib/queryClient';
import { prefetchRouteData } from './lib/routePrefetch';

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
const Login = cachedLazy('login', () => import('./routes/login').then(m => ({ default: m.Login })));
const ForgotPassword = cachedLazy('forgot-password', () =>
  import('./routes/forgot-password').then(m => ({ default: m.ForgotPassword }))
);
const ResetPassword = cachedLazy('reset-password', () =>
  import('./routes/reset-password').then(m => ({ default: m.ResetPassword }))
);
const ShoppingList = cachedLazy('shopping', () =>
  import('./features/shopping').then(m => ({ default: m.ShoppingList }))
);
const ChoresList = cachedLazy('chores', () => import('./features/chores').then(m => ({ default: m.ChoresList })));
const Calendar = cachedLazy('calendar', () => import('./features/calendar').then(m => ({ default: m.Calendar })));
const Settings = cachedLazy('settings', () => import('./routes/settings').then(m => ({ default: m.Settings })));
const Notifications = cachedLazy('notifications', () =>
  import('./routes/notifications').then(m => ({ default: m.Notifications }))
);
const KitchenPage = cachedLazy('kitchen', () => import('./features/recipes').then(m => ({ default: m.KitchenPage })));
const MediasPage = cachedLazy('medias', () => import('./features/medias').then(m => ({ default: m.MediasPage })));
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

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/');
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (user) {
      throw redirect({ to: '/' });
    }
  },
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPassword,
  beforeLoad: async () => {
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
    if (user) {
      throw redirect({ to: '/' });
    }
  },
});

const shoppingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/shopping',
  component: ShoppingList,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/shopping');
  },
});

const choresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chores',
  component: ChoresList,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/chores');
  },
});

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: Calendar,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
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
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      clearUser();
      throw redirect({ to: '/login' });
    }
  },
});

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/notifications',
  component: Notifications,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      clearUser();
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/notifications');
  },
});

const kitchenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kitchen',
  component: KitchenPage,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/kitchen');
  },
});

const recipeDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/kitchen/$recipeId',
  component: RecipeDetail,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
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
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/torrents');
  },
});

const mediasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/medias',
  component: MediasPage,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
  loader: async () => {
    const queryClient = getQueryClient();
    if (!queryClient) return;
    await prefetchRouteData(queryClient, '/medias');
  },
});

const torrentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/torrents/$hash',
  component: TorrentDetailPage,
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: '/login' });
    }
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  shoppingRoute,
  choresRoute,
  calendarRoute,
  settingsRoute,
  notificationsRoute,
  kitchenRoute,
  recipeDetailRoute,
  privacyRoute,
  termsRoute,
  torrentsRoute,
  mediasRoute,
  torrentDetailRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
