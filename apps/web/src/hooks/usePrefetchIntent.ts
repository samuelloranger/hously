import { useMemo } from 'react';
import { usePrefetchRoute } from './usePrefetchRoute';

type PrefetchParams = Record<string, string | number | boolean | undefined>;

type PrefetchIntentHandlers = {
  onMouseEnter: () => void;
  onTouchStart: () => void;
};

export function usePrefetchIntent(route: string, params?: PrefetchParams): PrefetchIntentHandlers {
  const prefetchRoute = usePrefetchRoute();
  const serializedParams = JSON.stringify(params ?? {});
  const stableParams = useMemo(() => params ?? {}, [serializedParams]);

  return useMemo(
    () => ({
      onMouseEnter: () => prefetchRoute(route, stableParams),
      onTouchStart: () => prefetchRoute(route, stableParams),
    }),
    [prefetchRoute, route, stableParams]
  );
}
