import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { preloadRoute, prefetchRouteDataOptimistic } = vi.hoisted(() => ({
  preloadRoute: vi.fn(),
  prefetchRouteDataOptimistic: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ preloadRoute }),
}));
vi.mock("@/lib/routing/prefetch", () => ({ prefetchRouteDataOptimistic }));
vi.mock("@/lib/api/queryClient", () => ({ getQueryClient: () => ({}) }));
vi.mock("@/lib/routing/navigation", () => ({
  navSections: [{ items: [{ path: "/" }, { path: "/library" }] }],
}));

import { usePrefetchAllRoutes } from "@/lib/routing/usePrefetchAllRoutes";

describe("usePrefetchAllRoutes", () => {
  beforeEach(() => {
    preloadRoute.mockClear();
    prefetchRouteDataOptimistic.mockClear();
    // force the setTimeout fallback path for deterministic timing
    // @ts-expect-error remove rIC so the hook uses setTimeout
    delete globalThis.requestIdleCallback;
    vi.useFakeTimers();
  });

  it("does NOT prefetch synchronously when invoked", () => {
    const { result } = renderHook(() => usePrefetchAllRoutes());
    result.current();
    expect(preloadRoute).not.toHaveBeenCalled();
    expect(prefetchRouteDataOptimistic).not.toHaveBeenCalled();
  });

  it("prefetches every nav path once the idle timer fires", () => {
    const { result } = renderHook(() => usePrefetchAllRoutes());
    result.current();
    vi.runAllTimers();
    expect(preloadRoute).toHaveBeenCalledTimes(2);
    expect(prefetchRouteDataOptimistic).toHaveBeenCalledTimes(2);
  });
});
