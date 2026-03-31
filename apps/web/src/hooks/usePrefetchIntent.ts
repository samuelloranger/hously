import { usePrefetchRoute } from './usePrefetchRoute';

type PrefetchParams = Record<string, string | number | boolean | undefined>;

type PrefetchIntentHandlers = {
  onMouseEnter: () => void;
  onTouchStart: () => void;
};

export function usePrefetchIntent(route: string, params?: PrefetchParams): PrefetchIntentHandlers {
  const prefetchRoute = usePrefetchRoute();
  const resolvedParams = params ?? {};

  return {
    onMouseEnter: () => prefetchRoute(route, resolvedParams),
    onTouchStart: () => prefetchRoute(route, resolvedParams),
  };
}
