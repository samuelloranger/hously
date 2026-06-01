# Dashboard Initial-Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the authenticated dashboard cold-load from ~4.2 MB / 108 requests to well under ~1 MB by fixing the three biggest, real, measured costs.

**Architecture:** Three independent fixes — (1) cap the size of Jellyfin images served by the API proxy; (2) stop eagerly prefetching every other route's API data + JS at dashboard boot (defer to browser idle); (3) lazy-load dashboard widget components so heavy widget code (e.g. the 91 KB tracker-integration chunk pulled by the Trackers widget) leaves the initial bundle.

**Tech Stack:** Elysia + Bun (API), React 19 + TanStack Router/Query + Vite (web), `bun test` (API tests), `vitest` (web tests). Browser perf measured via Playwright-over-CDP against `https://hously-dev.samlo.cloud/`.

---

## Measured baseline (2026-06-01, authenticated cold load)

| Type | Transfer | Count | Notes |
|---|---|---|---|
| Images | 2 315 KB | 19 | `/api/dashboard/jellyfin/image` returned **909 KB + 601 KB** for 2 posters (full-res, unsized) |
| Fetch (API) | 1 086 KB | 31 | `/api/library` = **898 KB** (prefetched, not needed on dashboard) |
| Script | 655 KB | 48 | route chunks (tiptap 110 KB, calendar, forms…) preloaded eagerly; Trackers widget pulls `_trackerIntegration` 91 KB |
| Fonts | 116 KB | 4 | |
| CSS | 43 KB | 1 | |

FCP ≈ 424 ms, DOM interactive < 100 ms (shell is fast; weight is data + images).

**Root causes:**
- Image proxy (`apps/api/src/routes/dashboard/jellyfin/index.ts`) fetches Jellyfin images with **no size params** → full-resolution originals.
- `usePrefetchAllRoutes` (`apps/web/src/lib/routing/usePrefetchAllRoutes.ts`) runs in a `useEffect` with **no delay** on Sidebar mount and warms **JS chunks + API data for every nav route** → pulls `/api/library` (898 KB) and all route chunks (tiptap/calendar/forms) at boot.
- All widgets are statically imported in `widgetComponents.tsx`, so heavy widget deps (Trackers → `_trackerIntegration` 91 KB) are in the initial bundle.

---

## File Structure

- `apps/api/src/utils/dashboard/jellyfin.ts` — add a pure `appendJellyfinImageSizing(url, imageType)` helper (sits beside the existing `mapJellyfinApiItem`).
- `apps/api/src/__tests__/jellyfinImageSizing.test.ts` — new unit test for the helper.
- `apps/api/src/routes/dashboard/jellyfin/index.ts` — call the helper in the image-proxy loop.
- `apps/web/src/lib/routing/usePrefetchAllRoutes.ts` — defer the prefetch loop to browser idle.
- `apps/web/src/pages/_component/widgetComponents.tsx` — convert widget entries to `React.lazy`.
- `apps/web/src/pages/_component/HomePage.tsx` — wrap rendered widget in `<Suspense>`.
- `/tmp/hously-perf/cdp-perf.mjs` — existing measurement script, re-run for before/after verification (not committed).

---

## Task 1: Cap Jellyfin proxy image size

**Files:**
- Modify: `apps/api/src/utils/dashboard/jellyfin.ts` (add helper)
- Test: `apps/api/src/__tests__/jellyfinImageSizing.test.ts` (create)
- Modify: `apps/api/src/routes/dashboard/jellyfin/index.ts:69-75` (call helper)

Jellyfin's image API honours `fillWidth` + `quality` query params. Posters (`Primary`) render at ≤120 px in widgets; backdrops (`Backdrop`) are wider thumbnails. Capping `fillWidth` collapses 900 KB originals to tens of KB.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/jellyfinImageSizing.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { appendJellyfinImageSizing } from "@hously/api/utils/dashboard/jellyfin";

describe("appendJellyfinImageSizing", () => {
  it("caps Primary posters at fillWidth=320 quality=90", () => {
    const u = new URL("http://jelly.local/Items/abc/Images/Primary");
    appendJellyfinImageSizing(u, "Primary");
    expect(u.searchParams.get("fillWidth")).toBe("320");
    expect(u.searchParams.get("quality")).toBe("90");
  });

  it("caps Backdrop images at fillWidth=640 quality=80", () => {
    const u = new URL("http://jelly.local/Items/abc/Images/Backdrop");
    appendJellyfinImageSizing(u, "Backdrop");
    expect(u.searchParams.get("fillWidth")).toBe("640");
    expect(u.searchParams.get("quality")).toBe("80");
  });

  it("preserves an existing tag param", () => {
    const u = new URL("http://jelly.local/Items/abc/Images/Primary?tag=t1");
    appendJellyfinImageSizing(u, "Primary");
    expect(u.searchParams.get("tag")).toBe("t1");
    expect(u.searchParams.get("fillWidth")).toBe("320");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test src/__tests__/jellyfinImageSizing.test.ts`
Expected: FAIL — `appendJellyfinImageSizing` is not exported / not a function.

- [ ] **Step 3: Add the helper**

In `apps/api/src/utils/dashboard/jellyfin.ts`, add (at the end of the file, after the existing exports):

```ts
/**
 * Cap the dimensions/quality of a Jellyfin image URL before proxying it.
 * Posters (Primary) render small in dashboard widgets; backdrops a bit wider.
 * Without this, Jellyfin serves full-resolution originals (hundreds of KB).
 */
export function appendJellyfinImageSizing(
  url: URL,
  imageType: "Primary" | "Backdrop",
): void {
  if (imageType === "Primary") {
    url.searchParams.set("fillWidth", "320");
    url.searchParams.set("quality", "90");
  } else {
    url.searchParams.set("fillWidth", "640");
    url.searchParams.set("quality", "80");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun test src/__tests__/jellyfinImageSizing.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the helper into the image proxy**

In `apps/api/src/routes/dashboard/jellyfin/index.ts`:

Add to the import from the jellyfin util (line 6 currently imports `mapJellyfinApiItem`):

```ts
import { mapJellyfinApiItem, appendJellyfinImageSizing } from "@hously/api/utils/dashboard/jellyfin";
```

Then in the candidate loop, right after the existing tag block (currently lines 73-75):

```ts
          if (candidate.tag) {
            imageUrl.searchParams.set("tag", candidate.tag);
          }
          appendJellyfinImageSizing(imageUrl, candidate.imageType);
```

(`candidate.imageType` is already typed as the literal `"Primary" | "Backdrop"` from the `as const` candidate arrays.)

- [ ] **Step 6: Typecheck + full API test run**

Run: `cd apps/api && bun run typecheck && bun test`
Expected: typecheck clean; all tests pass (incl. the new file).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/utils/dashboard/jellyfin.ts apps/api/src/__tests__/jellyfinImageSizing.test.ts apps/api/src/routes/dashboard/jellyfin/index.ts
git commit -m "perf(dashboard): cap Jellyfin proxy image size (fillWidth+quality)"
```

---

## Task 2: Defer all-routes prefetch to browser idle

**Files:**
- Modify: `apps/web/src/lib/routing/usePrefetchAllRoutes.ts`
- Test: `apps/web/src/lib/routing/__tests__/usePrefetchAllRoutes.test.tsx` (create)

The hook currently warms JS chunks + API data for every nav route synchronously when invoked (Sidebar mount). That pulls `/api/library` (898 KB) and all route chunks into the boot window. Defer the whole loop to `requestIdleCallback` (timeout-bounded) so it runs **after** the dashboard is interactive. Hover-intent prefetch (`usePrefetchRoute`, already wired on nav items) still gives instant navigation.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/routing/__tests__/usePrefetchAllRoutes.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const preloadRoute = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ preloadRoute }),
}));
const prefetchRouteDataOptimistic = vi.fn();
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/lib/routing/__tests__/usePrefetchAllRoutes.test.tsx`
Expected: FAIL — the first test fails because the current hook prefetches synchronously.

- [ ] **Step 3: Defer the loop to idle**

Replace the body of `apps/web/src/lib/routing/usePrefetchAllRoutes.ts` with:

```tsx
import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { getQueryClient } from "@/lib/api/queryClient";
import { prefetchRouteDataOptimistic } from "@/lib/routing/prefetch";
import { navSections } from "@/lib/routing/navigation";

const ALL_NAV_PATHS = navSections.flatMap((s) => s.items.map((i) => i.path));

function runWhenIdle(fn: () => void): void {
  if (typeof window === "undefined") return;
  const ric = (window as typeof window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (ric) ric(fn, { timeout: 3000 });
  else setTimeout(fn, 1500);
}

/**
 * Prefetch all nav routes — fire and forget, but DEFERRED to browser idle so
 * it never competes with the current page's critical render/data. Warms both
 * the lazy JS chunk (router.preloadRoute) and the React Query cache
 * (prefetchRouteDataOptimistic) for every nav item.
 */
export function usePrefetchAllRoutes() {
  const router = useRouter();

  return useCallback(() => {
    runWhenIdle(() => {
      const queryClient = getQueryClient();
      for (const path of ALL_NAV_PATHS) {
        void router.preloadRoute({ to: path });
        if (queryClient) prefetchRouteDataOptimistic(queryClient, path);
      }
    });
  }, [router]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bunx vitest run src/lib/routing/__tests__/usePrefetchAllRoutes.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `cd apps/web && bun run typecheck && bun run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/routing/usePrefetchAllRoutes.ts apps/web/src/lib/routing/__tests__/usePrefetchAllRoutes.test.tsx
git commit -m "perf(dashboard): defer all-routes prefetch to browser idle"
```

---

## Task 3: Lazy-load dashboard widget components

**Files:**
- Modify: `apps/web/src/pages/_component/widgetComponents.tsx`
- Modify: `apps/web/src/pages/_component/HomePage.tsx:100-114` (wrap widget render in `<Suspense>`)

Every widget is statically imported, so heavy widget deps live in the initial bundle — notably the Trackers widget, which imports the C411/LaCale/Torr9/YggReborn stats hooks (the 91 KB `_trackerIntegration` chunk). Convert widget entries to `React.lazy` so each widget's code loads on render, and wrap rendering in `<Suspense>`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/_component/__tests__/widgetComponents.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WIDGET_COMPONENTS } from "@/pages/_component/widgetComponents";

describe("WIDGET_COMPONENTS", () => {
  it("registers every widget id as a lazy (code-split) component", () => {
    const ids = Object.keys(WIDGET_COMPONENTS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const C = WIDGET_COMPONENTS[id as keyof typeof WIDGET_COMPONENTS];
      // React.lazy returns an exotic object with $$typeof === Symbol(react.lazy)
      expect((C as { $$typeof?: symbol }).$$typeof?.toString()).toBe(
        "Symbol(react.lazy)",
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bunx vitest run src/pages/_component/__tests__/widgetComponents.test.ts`
Expected: FAIL — current entries are plain function components, not lazy.

- [ ] **Step 3: Convert the registry to lazy components**

Replace `apps/web/src/pages/_component/widgetComponents.tsx` with:

```tsx
import { lazy } from "react";
import type { WidgetId } from "@hously/shared/constants";

const named = <K extends string>(p: Promise<Record<K, React.ComponentType<object>>>, key: K) =>
  p.then((m) => ({ default: m[key] }));

export const WIDGET_COMPONENTS: Record<WidgetId, React.LazyExoticComponent<React.ComponentType<object>>> = {
  weather: lazy(() => named(import("@/pages/_component/WeatherPanel"), "WeatherPanel")),
  quick_links: lazy(() => named(import("@/pages/_component/QuickLinksPanel"), "QuickLinksPanel")),
  chores: lazy(() => named(import("@/pages/_component/HomePanel"), "ChoresPanel")),
  jellyfin_shelf: lazy(() => named(import("@/pages/_component/JellyfinReadyPanel"), "JellyfinReadyPanel")),
  library_alerts: lazy(() => named(import("@/pages/_component/LibraryAttentionPanel"), "LibraryAttentionPanel")),
  homeassistant: lazy(() => named(import("@/pages/_component/HomeAssistantPanel"), "HomeAssistantPanel")),
  habits: lazy(() => named(import("@/pages/_component/HomePanel"), "HabitsPanel")),
  upcoming: lazy(() => named(import("@/pages/_component/MediaShelves"), "UpcomingShelf")),
  trackers: lazy(() => named(import("@/pages/_component/TrackersPanel"), "TrackersPanel")),
  jellyfin_random: lazy(() => named(import("@/pages/_component/JellyfinRandomPanel"), "JellyfinRandomPanel")),
  system: lazy(() => named(import("@/pages/_component/system"), "SystemPanel")),
  focus_timer: lazy(() => named(import("@/pages/_component/FocusTimerPanel"), "FocusTimerPanel")),
  downloads: lazy(() => named(import("@/pages/_component/DownloadsPanel"), "DownloadsPanel")),
  minecraft_compact: lazy(() => named(import("@/pages/_component/MinecraftCompactPanel"), "MinecraftCompactPanel")),
  rss: lazy(() => named(import("@/pages/_component/RssStatusPanel"), "RssStatusPanel")),
};
```

(`HomePanel` exports both `ChoresPanel` and `HabitsPanel`; `MediaShelves` exports `UpcomingShelf`. `system` is a directory with an `index.tsx` exporting `SystemPanel`.)

- [ ] **Step 4: Wrap the widget render in Suspense**

In `apps/web/src/pages/_component/HomePage.tsx`, add `Suspense` to the React import at the top of the file:

```tsx
import { Suspense, useEffect, useMemo, useState } from "react";
```

(Keep whatever other React imports already exist on that line — just add `Suspense`.)

Then change the two `<Component />` render sites (currently lines ~108 and ~111) so each is wrapped:

```tsx
            {isEditMode ? (
              <WidgetEditWrapper
                onMoveUp={() => moveWidget(id, "up")}
                onMoveDown={() => moveWidget(id, "down")}
                canMoveUp={!isFirst}
                canMoveDown={!isLast}
              >
                <Suspense fallback={<WidgetFallback />}>
                  <Component />
                </Suspense>
              </WidgetEditWrapper>
            ) : (
              <Suspense fallback={<WidgetFallback />}>
                <Component />
              </Suspense>
            )}
```

Add a small fallback component near the top of `HomePage.tsx` (after imports, before the component):

```tsx
function WidgetFallback() {
  return (
    <div className="h-40 rounded-xl border border-neutral-800 bg-neutral-900 animate-pulse" />
  );
}
```

- [ ] **Step 5: Run widget test + typecheck + lint**

Run: `cd apps/web && bunx vitest run src/pages/_component/__tests__/widgetComponents.test.ts && bun run typecheck && bun run lint`
Expected: PASS; typecheck + lint clean.

- [ ] **Step 6: Full web test run (no regressions)**

Run: `cd apps/web && bun run test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/_component/widgetComponents.tsx apps/web/src/pages/_component/HomePage.tsx apps/web/src/pages/_component/__tests__/widgetComponents.test.ts
git commit -m "perf(dashboard): lazy-load widget components (split heavy widget code out of initial bundle)"
```

---

## Task 4: Rebuild dev + verify the numbers improved

**Files:** none (verification only). Uses the existing measurement script.

This is the acceptance gate. Perf is verified empirically (a unit test can't prove transfer dropped).

- [ ] **Step 1: Rebuild + redeploy dev from this branch**

```bash
cd ~/sites/hously
docker build --build-arg APP_VERSION="perf-$(git rev-parse --short HEAD)" -t hously:dev .
cd ~/servers/hously-dev && docker compose up -d --force-recreate hously-dev
```
Expected: build exit 0; container `Up`, on the new image.

- [ ] **Step 2: Re-measure with the CDP script**

Have a Chrome with remote debugging open (logged in):
```bash
google-chrome --no-sandbox --remote-debugging-port=9222 '--remote-allow-origins=*' --user-data-dir=/tmp/hously-cdp --no-first-run https://hously-dev.samlo.cloud/
```
Then:
```bash
cd ~/sites/hously && node /tmp/hously-perf/cdp-perf.mjs
```

- [ ] **Step 3: Confirm targets**

Expected vs baseline (4 224 KB total):
- Images total **< ~300 KB** (no single Jellyfin image > ~80 KB).
- `/api/library` (898 KB) **absent** from the boot waterfall (now deferred to idle).
- JS initial transfer down (tiptap/calendar/forms route chunks + the 91 KB tracker chunk no longer in the first load).
- **Total transfer < ~1 MB**; FCP unchanged or better.

If a target is missed, capture which resource still dominates and open a follow-up task; do not silently accept.

---

## Self-Review

**Spec coverage:** Point 1 (Jellyfin images) → Task 1. Point 2 (`/api/library` 898 KB prefetch) → Task 2. Point 3 (JS bundle / heavy widget code) → Task 3. Verification → Task 4. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `appendJellyfinImageSizing(url: URL, imageType: "Primary" | "Backdrop")` defined in Task 1 and called with `candidate.imageType` (same literal union). `WIDGET_COMPONENTS` retyped to `LazyExoticComponent` in Task 3; `HomePage` already does `const Component = WIDGET_COMPONENTS[id]` and renders `<Component />`, compatible with lazy + Suspense. ✓

**Note on TDD scope:** Tasks 1–3 carry unit tests for the *logic* (sizing math, deferral behavior, lazy registry). The *performance outcome* itself is verified empirically in Task 4 (before/after transfer numbers) — the correct verification for a perf change.
