# elysia-react-ssr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `elysia-react-ssr` Elysia plugin and wire it into Hously so the server renders the authenticated app shell (layout + skeleton panels) before JavaScript executes on the client.

**Architecture:** A thin Elysia plugin in `packages/elysia-react-ssr/` gates itself on `NODE_ENV` — no-op in development, active in production. It reads Vite's manifest to resolve hashed asset filenames, serves static files, and delegates HTML requests to a user-supplied `render(request, ctx)` function. Hously's `apps/web/src/entry-server.tsx` implements that function: resolves the auth user from SSRContext, seeds the TanStack Query cache, creates a memory-history router, calls `router.load()` (which skips panel data prefetch due to `isSSR: true`), and streams the fully-rendered HTML shell. The client detects pre-rendered HTML and uses `hydrateRoot` instead of `createRoot`.

**Tech Stack:** Elysia 1.x, Bun, React 19 (`renderToReadableStream`), TanStack Router v1, TanStack Query v5, Vite, `@elysiajs/static`, `serialize-javascript`

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `packages/elysia-react-ssr/package.json` | Package manifest, peer deps |
| `packages/elysia-react-ssr/tsconfig.json` | TypeScript config for the package |
| `packages/elysia-react-ssr/src/types.ts` | `ReactSSROptions`, `SSRContext` types |
| `packages/elysia-react-ssr/src/prod.ts` | Production plugin: manifest reading, static serving, SSR handler |
| `packages/elysia-react-ssr/src/index.ts` | Factory export + `NODE_ENV` gate |
| `apps/web/src/entry-server.tsx` | SSR render function for Hously |

### Modified files
| Path | Change |
|---|---|
| `package.json` (root) | Add `packages/*` to workspaces |
| `apps/web/src/router.tsx` | Add `isSSR: false` to router context |
| `apps/web/src/pages/index.tsx` | Guard loader: skip prefetch when `context.isSSR` |
| `apps/web/src/main.tsx` | Detect SSR, call `hydrateRoot`, pre-seed TQ cache |
| `apps/web/src/vite-env.d.ts` | Replace `__HOUSLY_BOOTSTRAP__` with `__TQ_STATE__` |
| `apps/web/vite.config.ts` | Add `ssr: { noExternal: ['@hously/shared'] }` |
| `apps/web/package.json` | Add `serialize-javascript` dep |
| `apps/api/src/index.ts` | Replace bootstrap catch-all with `reactSSR` plugin |
| `Makefile` | Add `build:ssr` target; update `build` |
| `Dockerfile` | Add SSR Vite build + copy `dist/server` → `apps/api/ssr/` |

---

## Task 1: Bootstrap the `elysia-react-ssr` package

**Files:**
- Create: `packages/elysia-react-ssr/package.json`
- Create: `packages/elysia-react-ssr/tsconfig.json`
- Modify: `package.json` (root) — add `packages/*` to workspaces

- [ ] **Step 1: Create `packages/elysia-react-ssr/package.json`**

```json
{
  "name": "elysia-react-ssr",
  "version": "0.1.0",
  "description": "React SSR plugin for Elysia — TanStack Router aware",
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "peerDependencies": {
    "elysia": ">=1.0.0",
    "@elysiajs/static": ">=1.0.0",
    "vite": ">=5.0.0"
  },
  "devDependencies": {
    "typescript": "^6.0.0",
    "elysia": "^1.4.28",
    "@elysiajs/static": "^1.1.1",
    "vite": "^6.3.5"
  }
}
```

- [ ] **Step 2: Create `packages/elysia-react-ssr/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Add `packages/*` to root workspace**

In `package.json` at the repo root, change:
```json
"workspaces": [
  "apps/*"
]
```
to:
```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

- [ ] **Step 4: Install**

```bash
bun install
```

Expected: Bun resolves `elysia-react-ssr` as a workspace package. No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/elysia-react-ssr/package.json packages/elysia-react-ssr/tsconfig.json package.json
git commit -m "chore: bootstrap elysia-react-ssr package"
```

---

## Task 2: Implement plugin types

**Files:**
- Create: `packages/elysia-react-ssr/src/types.ts`

- [ ] **Step 1: Create `packages/elysia-react-ssr/src/types.ts`**

```typescript
export interface ReactSSROptions {
  /** Path to the compiled SSR bundle (relative to cwd). Used in production. */
  entry: string
  /** Directory of Vite client build output. Default: './public' */
  assetsDir?: string
  /** Manifest lookup key for the client entry. Default: 'src/main.tsx' */
  clientEntry?: string
  /** Called per request; return value is merged into SSRContext alongside bootstrapModules. */
  resolveContext?: (request: Request) => Promise<Record<string, unknown>>
  /** URL patterns to skip SSR (passed directly to Elysia). Default: [/^\/api\//] */
  exclude?: RegExp[]
}

export interface SSRContext {
  /** Hashed client entry module paths resolved from Vite manifest. */
  bootstrapModules: string[]
  /** Any extra fields returned by resolveContext. */
  [key: string]: unknown
}

export type RenderFn = (request: Request, ctx: SSRContext) => Promise<Response>
```

- [ ] **Step 2: Commit**

```bash
git add packages/elysia-react-ssr/src/types.ts
git commit -m "feat(elysia-react-ssr): add plugin types"
```

---

## Task 3: Implement production plugin + unit tests

**Files:**
- Create: `packages/elysia-react-ssr/src/prod.ts`
- Create: `packages/elysia-react-ssr/src/__tests__/prod.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/elysia-react-ssr/src/__tests__/prod.test.ts`:

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { Elysia } from 'elysia'

// We import after mocking so module-level reads don't run
async function loadProd() {
  const { createProdPlugin } = await import('../prod')
  return createProdPlugin
}

describe('createProdPlugin', () => {
  it('resolves bootstrapModules from Vite manifest', async () => {
    const manifest = JSON.stringify({
      'src/main.tsx': { file: 'assets/main-AbC123.js', isEntry: true },
    })
    mock.module('node:fs/promises', () => ({
      readFile: async () => manifest,
    }))

    const createProdPlugin = await loadProd()
    const plugin = createProdPlugin({
      entry: './ssr/entry-server.js',
      assetsDir: './public',
      clientEntry: 'src/main.tsx',
    })

    // Spy: replace render so we can inspect SSRContext
    let capturedCtx: unknown
    mock.module('./ssr/entry-server.js', () => ({
      render: async (_req: Request, ctx: unknown) => {
        capturedCtx = ctx
        return new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })
      },
    }))

    const app = new Elysia().use(await plugin)
    await app.handle(new Request('http://localhost/'))

    expect((capturedCtx as { bootstrapModules: string[] }).bootstrapModules).toEqual([
      '/assets/main-AbC123.js',
    ])
  })

  it('merges resolveContext output into SSRContext', async () => {
    const manifest = JSON.stringify({
      'src/main.tsx': { file: 'assets/main-XyZ.js', isEntry: true },
    })
    mock.module('node:fs/promises', () => ({
      readFile: async () => manifest,
    }))

    const createProdPlugin = await loadProd()
    let capturedCtx: unknown
    mock.module('./ssr/entry-server.js', () => ({
      render: async (_req: Request, ctx: unknown) => {
        capturedCtx = ctx
        return new Response('<html/>', { headers: { 'Content-Type': 'text/html' } })
      },
    }))

    const plugin = createProdPlugin({
      entry: './ssr/entry-server.js',
      resolveContext: async () => ({ user: { id: '1', email: 'a@b.com' } }),
    })

    const app = new Elysia().use(await plugin)
    await app.handle(new Request('http://localhost/'))

    expect((capturedCtx as Record<string, unknown>).user).toEqual({ id: '1', email: 'a@b.com' })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd packages/elysia-react-ssr && bun test src/__tests__/prod.test.ts
```

Expected: fail with `Cannot find module '../prod'`

- [ ] **Step 3: Implement `packages/elysia-react-ssr/src/prod.ts`**

```typescript
import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReactSSROptions, SSRContext, RenderFn } from './types'

interface ViteManifest {
  [key: string]: { file: string; isEntry?: boolean }
}

async function readManifest(assetsDir: string): Promise<ViteManifest> {
  const manifestPath = join(assetsDir, '.vite', 'manifest.json')
  const raw = await readFile(manifestPath, 'utf-8')
  return JSON.parse(raw) as ViteManifest
}

export function createProdPlugin(options: ReactSSROptions) {
  const assetsDir = options.assetsDir ?? './public'
  const clientEntry = options.clientEntry ?? 'src/main.tsx'
  const excludePatterns = options.exclude ?? [/^\/api\//]

  return async (app: Elysia) => {
    const manifest = await readManifest(assetsDir)
    const entryChunk = manifest[clientEntry]
    if (!entryChunk) throw new Error(`[elysia-react-ssr] Entry '${clientEntry}' not found in Vite manifest`)
    const bootstrapModules = [`/${entryChunk.file}`]

    const { render } = (await import(join(process.cwd(), options.entry))) as { render: RenderFn }

    return app
      .use(
        staticPlugin({
          assets: assetsDir,
          prefix: '/',
          ignorePatterns: [/\.html$/],
        }),
      )
      .get('*', async ({ request }) => {
        const url = new URL(request.url)

        // Skip SSR for excluded patterns
        if (excludePatterns.some((p) => p.test(url.pathname))) return

        const extra = options.resolveContext ? await options.resolveContext(request) : {}
        const ctx: SSRContext = { bootstrapModules, ...extra }

        return render(request, ctx)
      })
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd packages/elysia-react-ssr && bun test src/__tests__/prod.test.ts
```

Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
git add packages/elysia-react-ssr/src/prod.ts packages/elysia-react-ssr/src/__tests__/prod.test.ts
git commit -m "feat(elysia-react-ssr): implement production plugin with manifest resolution"
```

---

## Task 4: Implement plugin index with NODE_ENV gate

**Files:**
- Create: `packages/elysia-react-ssr/src/index.ts`
- Create: `packages/elysia-react-ssr/src/__tests__/index.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/elysia-react-ssr/src/__tests__/index.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { Elysia } from 'elysia'
import { reactSSR } from '../index'

describe('reactSSR', () => {
  it('is a no-op when NODE_ENV is not production', async () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const app = new Elysia().use(reactSSR({ entry: './ssr/entry-server.js' }))
    const res = await app.handle(new Request('http://localhost/'))

    // No catch-all registered → 404
    expect(res.status).toBe(404)
    process.env.NODE_ENV = original
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd packages/elysia-react-ssr && bun test src/__tests__/index.test.ts
```

Expected: fail with `Cannot find module '../index'`

- [ ] **Step 3: Implement `packages/elysia-react-ssr/src/index.ts`**

```typescript
import type { Elysia } from 'elysia'
import { createProdPlugin } from './prod'
import type { ReactSSROptions } from './types'

export function reactSSR(options: ReactSSROptions) {
  return async (app: Elysia) => {
    if (process.env.NODE_ENV !== 'production') {
      return app
    }
    const plugin = await createProdPlugin(options)
    return plugin(app)
  }
}

export type { ReactSSROptions, SSRContext } from './types'
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd packages/elysia-react-ssr && bun test src/__tests__/index.test.ts
```

Expected: 1 passing

- [ ] **Step 5: Commit**

```bash
git add packages/elysia-react-ssr/src/index.ts packages/elysia-react-ssr/src/__tests__/index.test.ts
git commit -m "feat(elysia-react-ssr): add plugin factory with NODE_ENV gate"
```

---

## Task 5: Add `serialize-javascript` to web app

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the dependency**

```bash
cd apps/web && bun add serialize-javascript && bun add -D @types/serialize-javascript
```

- [ ] **Step 2: Verify it resolves**

```bash
cd apps/web && bun -e "import serialize from 'serialize-javascript'; console.log(typeof serialize)"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore(web): add serialize-javascript for SSR state serialization"
```

---

## Task 6: Create `entry-server.tsx`

**Files:**
- Create: `apps/web/src/entry-server.tsx`

The entry-server mirrors the component tree from `main.tsx` so React hydration sees identical DOM output. It pre-seeds only `queryKeys.auth.me` from SSRContext. Route loaders skip data prefetch when `isSSR: true` (added in Task 7).

- [ ] **Step 1: Create `apps/web/src/entry-server.tsx`**

```tsx
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { renderToReadableStream } from "react-dom/server";
import serialize from "serialize-javascript";
import { FetcherProvider } from "@/lib/api/context";
import { webFetcher } from "@/lib/api/fetcher";
import { NotificationToastContainer } from "@/components/NotificationToastContainer";
import { routeTree } from "@/routeTree.gen";
import { queryKeys } from "@/lib/queryKeys";
import type { SSRContext } from "elysia-react-ssr";
import type { User } from "@hously/shared/types";

interface HouslySSRContext extends SSRContext {
  user: User | null;
}

export async function render(request: Request, ctx: HouslySSRContext): Promise<Response> {
  const url = new URL(request.url);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: 0,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
      },
    },
  });

  // Pre-seed auth — the only server-side data. Panel queries load client-side.
  queryClient.setQueryData(queryKeys.auth.me, ctx.user);

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url.pathname + url.search] }),
    context: { queryClient, isSSR: true },
    defaultPreload: "intent",
  });

  // Runs route matching + loaders. Loaders exit early when context.isSSR === true.
  await router.load();

  const dehydratedState = dehydrate(queryClient);

  const stream = await renderToReadableStream(
    <QueryClientProvider client={queryClient}>
      <FetcherProvider fetcher={webFetcher}>
        <RouterProvider router={router} />
        <NotificationToastContainer />
      </FetcherProvider>
    </QueryClientProvider>,
    {
      bootstrapModules: ctx.bootstrapModules,
      bootstrapScriptContent: `window.__TQ_STATE__=${serialize(dehydratedState, { isJSON: true })}`,
    },
  );

  await stream.allReady;

  return new Response(stream, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd apps/web && bun run typecheck 2>&1 | grep entry-server || echo "no errors in entry-server"
```

Expected: no TypeScript errors for `entry-server.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/entry-server.tsx
git commit -m "feat(web): add SSR entry-server with auth-only prefetch"
```

---

## Task 7: Update router context with `isSSR`

**Files:**
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Update `apps/web/src/router.tsx`**

Current:
```typescript
export const router = createRouter({
  routeTree,
  context: {
    queryClient: undefined!,
  },
  defaultPreload: "intent",
});
```

Replace with:
```typescript
export const router = createRouter({
  routeTree,
  context: {
    queryClient: undefined!,
    isSSR: false,
  },
  defaultPreload: "intent",
});
```

- [ ] **Step 2: Verify type-check still passes**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/router.tsx
git commit -m "feat(web): add isSSR flag to router context"
```

---

## Task 8: Guard home page loader

**Files:**
- Modify: `apps/web/src/pages/index.tsx`

- [ ] **Step 1: Add `isSSR` guard to loader**

Current loader in `apps/web/src/pages/index.tsx`:
```typescript
  loader: ({ context }) => {
    prefetchRouteDataOptimistic(context.queryClient, "/");
  },
```

Replace with:
```typescript
  loader: ({ context }) => {
    if (context.isSSR) return;
    prefetchRouteDataOptimistic(context.queryClient, "/");
  },
```

- [ ] **Step 2: Write unit test for the guard**

Create `apps/web/src/__tests__/homeLoader.test.ts`:

```typescript
import { describe, it, expect, mock } from 'bun:test'

describe('home route loader isSSR guard', () => {
  it('skips prefetch when isSSR is true', async () => {
    const mockPrefetch = mock(() => {})
    mock.module('@/lib/routing/prefetch', () => ({
      prefetchRouteDataOptimistic: mockPrefetch,
    }))

    // Simulate loader call with isSSR: true
    const { loader } = await import('@/pages/index').then(m => m.Route.options)
    if (typeof loader !== 'function') throw new Error('loader not found')

    await loader({ context: { queryClient: {} as any, isSSR: true } } as any)

    expect(mockPrefetch).not.toHaveBeenCalled()
  })

  it('calls prefetch when isSSR is false', async () => {
    const mockPrefetch = mock(() => {})
    mock.module('@/lib/routing/prefetch', () => ({
      prefetchRouteDataOptimistic: mockPrefetch,
    }))

    const { loader } = await import('@/pages/index').then(m => m.Route.options)
    if (typeof loader !== 'function') throw new Error('loader not found')

    await loader({ context: { queryClient: {} as any, isSSR: false } } as any)

    expect(mockPrefetch).toHaveBeenCalledWith(expect.anything(), '/')
  })
})
```

- [ ] **Step 3: Run the test**

```bash
cd apps/web && bun test src/__tests__/homeLoader.test.ts
```

Expected: 2 passing

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/index.tsx apps/web/src/__tests__/homeLoader.test.ts
git commit -m "feat(web): guard home loader — skip prefetch during SSR"
```

---

## Task 9: Update `main.tsx` for SSR hydration

**Files:**
- Modify: `apps/web/src/main.tsx`

- [ ] **Step 1: Update imports in `apps/web/src/main.tsx`**

Remove this import:
```typescript
import { bootstrapAuthFromWindow } from "@/lib/auth";
```

Add this import alongside existing `@tanstack/react-query` import:
```typescript
import { hydrate } from "@tanstack/react-query";
```

- [ ] **Step 2: Remove `bootstrapAuthFromWindow` call and add TQ hydration**

Remove:
```typescript
bootstrapAuthFromWindow(queryClient);
```

Replace with:
```typescript
// Pre-seed TQ cache from SSR dehydrated state if available
if (window.__TQ_STATE__) {
  hydrate(queryClient, window.__TQ_STATE__);
}
```

- [ ] **Step 3: Replace `ReactDOM.createRoot` with SSR-aware render**

Current (near bottom of file):
```typescript
// Render immediately to avoid blank screens if optional bootstrapping hangs.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FetcherProvider fetcher={webFetcher}>
          <AppWithServiceWorkerIntegration />
        </FetcherProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```

Replace with:
```typescript
const rootEl = document.getElementById("root")!;
const app = (
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FetcherProvider fetcher={webFetcher}>
          <AppWithServiceWorkerIntegration />
        </FetcherProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

// If the server pre-rendered HTML, hydrate instead of creating fresh
if (rootEl.hasChildNodes()) {
  ReactDOM.hydrateRoot(rootEl, app);
} else {
  ReactDOM.createRoot(rootEl).render(app);
}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/main.tsx
git commit -m "feat(web): add SSR hydration — hydrateRoot when server HTML detected"
```

---

## Task 10: Update `vite-env.d.ts`

**Files:**
- Modify: `apps/web/src/vite-env.d.ts`

- [ ] **Step 1: Replace the Window declaration**

Current:
```typescript
declare global {
  interface Window {
    __HOUSLY_BOOTSTRAP__?: {
      user: User | null;
    };
  }
}
```

Replace with:
```typescript
import type { DehydratedState } from "@tanstack/react-query";

declare global {
  interface Window {
    __TQ_STATE__?: DehydratedState;
  }
}
```

Also remove the `import type { User } from "@hously/shared/types"` line if it was only used for the bootstrap type (check the file — if it's only used there, remove it).

- [ ] **Step 2: Type-check**

```bash
cd apps/web && bun run typecheck 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/vite-env.d.ts
git commit -m "feat(web): replace __HOUSLY_BOOTSTRAP__ with __TQ_STATE__ in Window type"
```

---

## Task 11: Update Vite config for SSR build

**Files:**
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add `ssr` config block to `apps/web/vite.config.ts`**

Inside `defineConfig(({ mode }) => { ... return { plugins, resolve, server, test } })`, add `ssr` at the top level:

```typescript
return {
  plugins,
  resolve: { ... },
  server: { ... },
  test: { ... },
  ssr: {
    noExternal: ["@hously/shared"],
  },
};
```

- [ ] **Step 2: Add `build:ssr` script to `apps/web/package.json`**

In the `scripts` section, add:
```json
"build:ssr": "vite build --ssr src/entry-server.tsx --outDir dist/server"
```

- [ ] **Step 3: Verify the SSR build runs (without a full production build)**

```bash
cd apps/web && bun run build:ssr 2>&1 | tail -5
```

Expected: completes with `dist/server/entry-server.js` created, no fatal errors. (There may be warnings about `react-dom/server` — these are acceptable.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/vite.config.ts apps/web/package.json
git commit -m "feat(web): add SSR Vite build config and build:ssr script"
```

---

## Task 12: Wire `reactSSR` into the Elysia API

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add `elysia-react-ssr` to API dependencies**

```bash
cd apps/api && bun add elysia-react-ssr
```

- [ ] **Step 2: Update `apps/api/src/index.ts` — replace the static serving block**

Remove the top-level declarations (lines near the top of the file):
```typescript
const serveStatic = Bun.env.SERVE_STATIC === "true";
const spaIndexHtmlPromise: Promise<string> = serveStatic
  ? Bun.file("./public/index.html").text()
  : Promise.resolve("");

function escapeInlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}
```

Remove the import of `staticPlugin` (it's now used inside the plugin):
```typescript
import { staticPlugin } from "@elysiajs/static";
```

Add the import:
```typescript
import { reactSSR } from "elysia-react-ssr";
```

Replace the entire `.use((app) => { if (serveStatic) { ... } return app })` block:
```typescript
  .use(
    reactSSR({
      entry: "./ssr/entry-server.js",
      resolveContext: async (req) => ({
        user: await resolveUser(req).catch(() => null),
      }),
    }),
  )
```

- [ ] **Step 3: Type-check the API**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 0 errors

- [ ] **Step 4: Verify dev server still starts**

```bash
cd apps/api && bun run dev &
sleep 3
curl -s http://localhost:5001/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/package.json bun.lock
git commit -m "feat(api): replace bootstrap catch-all with elysia-react-ssr plugin"
```

---

## Task 13: Update build pipeline

**Files:**
- Modify: `Makefile`
- Modify: `Dockerfile`

- [ ] **Step 1: Read current Makefile build targets**

```bash
grep -n "build\|SERVE_STATIC" Makefile | head -20
```

- [ ] **Step 2: Update Makefile**

Find the `build` or `build-web` target and update it to run both builds. The SSR bundle must be built after the client bundle (client manifest is required for prod, SSR bundle is separate):

```makefile
build-web:
	cd apps/web && bun run build && bun run build:ssr

build: build-web
```

Also remove any `SERVE_STATIC` references from the Makefile.

- [ ] **Step 3: Update `Dockerfile`**

Find the web build step and update it to also build the SSR bundle. Add a copy step for the SSR bundle.

Locate the line that runs the web build (something like `RUN cd apps/web && bun run build`) and replace with:
```dockerfile
RUN cd apps/web && bun run build && bun run build:ssr
```

After the step that copies the client build to `apps/api/public/`, add:
```dockerfile
COPY --from=builder /app/apps/web/dist/server ./apps/api/ssr/
```

Remove any `ENV SERVE_STATIC=true` line if present (the plugin no longer reads it).

- [ ] **Step 4: Commit**

```bash
git add Makefile Dockerfile
git commit -m "chore: update build pipeline for SSR bundle"
```

---

## Task 14: End-to-end verification

- [ ] **Step 1: Run a full production build locally**

```bash
make build-web
```

Expected: creates both `apps/web/dist/client/` and `apps/web/dist/server/entry-server.js`

- [ ] **Step 2: Copy build artifacts to API**

```bash
cp -r apps/web/dist/client/. apps/api/public/
mkdir -p apps/api/ssr
cp apps/web/dist/server/entry-server.js apps/api/ssr/
```

- [ ] **Step 3: Start API in production mode**

```bash
NODE_ENV=production cd apps/api && bun run src/index.ts &
sleep 2
```

- [ ] **Step 4: Verify SSR HTML is returned**

```bash
curl -s http://localhost:5001/ | grep -c 'id="root">'
```

Expected: `0` — the root div should have SSR-rendered children, not be self-closing or empty.

```bash
curl -s http://localhost:5001/ | grep 'id="root"' | head -1
```

Expected output contains children after `id="root">`, not `id="root"></div>`.

- [ ] **Step 5: Check `__TQ_STATE__` is injected**

```bash
curl -s http://localhost:5001/ | grep -c '__TQ_STATE__'
```

Expected: `1`

- [ ] **Step 6: Stop the test server**

```bash
kill %1
```

- [ ] **Step 7: Add Playwright SSR smoke test**

Create `apps/web/e2e/ssr.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

test('SSR: initial HTML contains server-rendered content', async ({ request }) => {
  const response = await request.get('/')
  const html = await response.text()

  // Root element must not be empty — SSR rendered children into it
  expect(html).not.toMatch(/<div id="root"><\/div>/)

  // Dehydrated TQ state must be injected
  expect(html).toContain('__TQ_STATE__')
})

test('SSR: page layout visible without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')

  // Root element is non-empty (SSR rendered the shell)
  const root = page.locator('#root')
  await expect(root).not.toBeEmpty()

  await context.close()
})
```

- [ ] **Step 8: Run Playwright SSR tests**

```bash
cd apps/web && npx playwright test e2e/ssr.spec.ts
```

Expected: 2 passing

- [ ] **Step 9: Commit**

```bash
git add apps/web/e2e/ssr.spec.ts
git commit -m "test(web): add Playwright SSR smoke tests"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `elysia-react-ssr` npm package | Tasks 1–4 |
| `NODE_ENV` gate (no-op in dev) | Task 4 |
| Vite manifest resolution for `bootstrapModules` | Task 3 |
| `resolveContext` merged into SSRContext | Task 3 |
| Static asset serving via `staticPlugin` | Task 3 |
| `exclude` patterns | Task 3 (`prod.ts`) |
| `entry-server.tsx` with auth-only prefetch | Task 6 |
| `isSSR` context flag in router | Task 7 |
| Home page loader guard | Task 8 |
| `hydrateRoot` detection + TQ state hydration | Task 9 |
| `__TQ_STATE__` Window type | Task 10 |
| Vite SSR build config | Task 11 |
| API catch-all replaced with `reactSSR` | Task 12 |
| `SERVE_STATIC` eliminated | Tasks 12 + 13 |
| Makefile + Dockerfile updated | Task 13 |
| E2E verification | Task 14 |
