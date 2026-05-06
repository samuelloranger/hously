# Design: `elysia-react-ssr` — React SSR Plugin for Elysia

**Date:** 2026-05-06  
**Status:** Approved

## Goal

Eliminate the gap between HTML received and visible layout by server-rendering the authenticated app shell. Panel data continues to load client-side. The win is structural: users see the layout (greeting, nav, panel grid with skeletons) from the first byte instead of waiting for JS to download, parse, and mount.

**Before:** HTML (empty shell) → JS downloads/parses → React mounts → layout paints → panels fetch  
**After:** HTML (rendered layout + skeletons) → JS downloads → hydrates → panels fetch

## Scope

Two deliverables:

1. **`elysia-react-ssr`** — standalone npm package (new, published separately)
2. **Hously web/API changes** — wires the plugin in, adds `entry-server.tsx`, small guards in loaders

Option C (CLI scaffold) is explicitly deferred to a future release.

## Prior Art

No existing package covers this combination. Closest alternatives reviewed:

| Package                     | Why it doesn't apply                          |
| --------------------------- | --------------------------------------------- |
| `elysia-react-router` (87★) | React Router/Remix only, not TanStack Router  |
| `elysia-react-ssr` (1★)     | Proof-of-concept, no Vite, no TanStack Router |
| `elysia-vite` (77★)         | Asset serving only, no SSR                    |
| `elysia-vite-server` (14★)  | Vue example, v0.0.1, no TanStack Router       |

TanStack Router's own `hydrate()`/`dehydrate()` APIs are undocumented and tightly coupled to TanStack Start internals — this design avoids them. Route state is encoded in the URL; only TanStack Query cache needs dehydration, which has a stable public API.

---

## Package: `elysia-react-ssr`

### Public API

```typescript
import { reactSSR } from 'elysia-react-ssr'

app.use(reactSSR({
  entry: string                                            // source path (dev) or compiled path (prod)
  resolveContext?: (req: Request) => Promise<Record<string, unknown>>  // merged into SSRContext
  exclude?: RegExp[]                                       // paths to skip SSR (default: [/^\/api\//])
  clientEntry?: string                                     // manifest lookup key (default: "src/main.tsx")
  viteConfig?: string                                      // default: auto-detected
}))
```

### Entry-Server Contract

The plugin calls one export from the entry-server on every HTML request:

```typescript
export async function render(
  request: Request,
  ctx: SSRContext,
): Promise<Response>;

// SSRContext = { bootstrapModules: string[] } merged with resolveContext output
```

The plugin forwards whatever `Response` the entry-server returns — streaming, headers, and status code pass through untouched. The plugin has no opinion about the render logic inside.

### Dev Mode

1. Creates a Vite dev server via `createViteServer({ appType: 'custom', server: { middlewareMode: true } })`
2. Asset requests (`/@vite/`, `/@fs/`, `/src/`, `node_modules/.vite/`) → `vite.transformRequest(url)`
3. HTML requests → `vite.ssrLoadModule(entry)` on every request (hot — picks up edits without restart)
4. `bootstrapModules` = `["/src/main.tsx"]` (Vite transforms on-demand, no hashing)

`ssrLoadModule` and `transformRequest` are pure async JS APIs that don't require Node's `http.IncomingMessage`, so Bun compat is not a concern. Vite's HMR websocket runs on Vite's own port alongside Elysia.

### Prod Mode

1. Reads `public/.vite/manifest.json` at startup → resolves hashed `bootstrapModules`
2. Imports the pre-built SSR bundle once → caches `render`
3. Per request: calls `resolveContext`, merges result with `bootstrapModules`, calls `render(request, ctx)`, returns `Response`

### Package Structure

```
elysia-react-ssr/
├── src/
│   ├── index.ts       # plugin factory export
│   ├── dev.ts         # dev mode: vite.ssrLoadModule + asset serving
│   ├── prod.ts        # prod mode: load pre-built SSR bundle + manifest
│   └── types.ts       # ReactSSROptions, SSRContext
└── package.json
```

---

## Hously Changes

### New File: `apps/web/src/entry-server.tsx`

```typescript
import { createRouter } from '@tanstack/react-router'
import { createMemoryHistory } from '@tanstack/react-router'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, dehydrate } from '@tanstack/react-query'
import { HydrationBoundary, QueryClientProvider } from '@tanstack/react-query'
import { renderToReadableStream } from 'react-dom/server'
import { serialize } from 'serialize-javascript'  // new dep: bun add serialize-javascript
import { routeTree } from '@/routeTree.gen'
import { queryKeys } from '@/lib/queryKeys'
import type { User } from '@hously/shared/types'

interface SSRContext {
  bootstrapModules: string[]
  user: User | null
}

export async function render(request: Request, ctx: SSRContext): Promise<Response> {
  const url = new URL(request.url)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30 * 1000, retry: 0 } },
  })

  // Pre-seed auth cache — the only server-side data
  queryClient.setQueryData(queryKeys.auth.me, ctx.user)

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [url.pathname + url.search] }),
    context: { queryClient, isSSR: true },
  })

  await router.load()  // matches route + runs loaders; loaders skip prefetch when isSSR

  const dehydratedState = dehydrate(queryClient)  // tiny: only auth.me

  const stream = await renderToReadableStream(
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <RouterProvider router={router} />
      </HydrationBoundary>
    </QueryClientProvider>,
    {
      bootstrapModules: ctx.bootstrapModules,
      bootstrapScriptContent: `window.__TQ_STATE__=${serialize(dehydratedState)}`,
    }
  )
  await stream.allReady

  return new Response(stream, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
```

`await stream.allReady` waits for full render before flushing. Streaming (flushing as Suspense resolves) is deferred to a future iteration.

### `apps/web/src/router.ts`

Add `isSSR` to context:

```typescript
context: { queryClient: undefined!, isSSR: false }
```

### `apps/web/src/pages/index.tsx` (and any other prefetching loaders)

Skip prefetch in SSR context — render skeleton layout instead:

```typescript
loader: ({ context }) => {
  if (context.isSSR) return
  prefetchRouteDataOptimistic(context.queryClient, '/')
},
```

### `apps/web/src/main.tsx`

Detect SSR (root has server-rendered children) and hydrate instead of creating fresh:

New import needed: `import { hydrate } from '@tanstack/react-query'`

```typescript
// Hydrate TQ cache from server dehydrated state before React mounts
if (window.__TQ_STATE__) hydrate(queryClient, window.__TQ_STATE__)

const rootEl = document.getElementById('root')!
rootEl.hasChildNodes()
  ? ReactDOM.hydrateRoot(rootEl, <App />)
  : ReactDOM.createRoot(rootEl).render(<App />)
```

The existing `bootstrapAuthFromWindow` call is removed — auth state now arrives via `window.__TQ_STATE__` as `queryKeys.auth.me`.

### `apps/web/vite.config.ts`

Add SSR config block:

```typescript
ssr: {
  noExternal: ['@hously/shared'],
}
```

### `apps/api/src/index.ts`

Replace the current `*` catch-all handler with the plugin:

```typescript
import { reactSSR } from "elysia-react-ssr";
import { resolveUser } from "./middleware/auth";

// Plugin only activates when SERVE_STATIC=true (production).
// In dev, the frontend is served by the separate Vite dev server on port 5173 as today.
if (serveStatic) {
  app.use(
    reactSSR({
      entry: "./ssr/entry-server.js",
      resolveContext: async (req) => ({
        user: await resolveUser(req).catch(() => null),
      }),
    }),
  );
}
```

`spaIndexHtmlPromise`, `escapeInlineScriptJson`, and `window.__HOUSLY_BOOTSTRAP__` are removed — superseded by SSR.

### Build Pipeline

Two Vite passes instead of one:

```makefile
build-web:
    cd apps/web && vite build && vite build --ssr src/entry-server.tsx --outDir dist/server
```

**Output layout:**

```
apps/web/dist/client/     → copied to apps/api/public/  (static assets, unchanged)
apps/web/dist/server/     → copied to apps/api/ssr/     (SSR bundle, never served publicly)
```

**Dockerfile additions:**

```dockerfile
RUN cd apps/web && bun run build && bun run build:ssr
COPY apps/web/dist/server ./apps/api/ssr/
```

### File Change Summary

| File                            | Change                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/entry-server.tsx` | New — ~40 lines                                                               |
| `apps/web/src/main.tsx`         | `hydrateRoot` detection, TQ state hydration, remove `bootstrapAuthFromWindow` |
| `apps/web/src/router.ts`        | Add `isSSR: false` to context                                                 |
| `apps/web/src/pages/index.tsx`  | Add `if (context.isSSR) return` guard in loader                               |
| `apps/web/src/vite-env.d.ts`    | Add `__TQ_STATE__` to `Window`, remove `__HOUSLY_BOOTSTRAP__`                 |
| `apps/web/vite.config.ts`       | Add `ssr: { noExternal: ['@hously/shared'] }`                                 |
| `apps/api/src/index.ts`         | Replace catch-all with `reactSSR(...)`, remove bootstrap helpers              |
| `Makefile`                      | Add `build:ssr` target                                                        |
| `Dockerfile`                    | Add SSR build pass + bundle copy                                              |

---

## Data Flow Summary

```
Request arrives at Elysia
  → plugin calls resolveContext(request) → { user }
  → plugin calls render(request, { bootstrapModules, user })
    → entry-server seeds queryClient with user (auth.me only)
    → createMemoryHistory(url.pathname)
    → router.load() → loaders see isSSR=true → skip HTTP prefetch
    → renderToReadableStream → layout + skeleton panels
    → dehydrate(queryClient) → tiny JSON (auth.me only)
    → stream.allReady → flush full HTML with inline __TQ_STATE__ script
  → Response(stream) returned to browser

Browser receives HTML (layout visible immediately)
  → JS bundle downloads
  → main.tsx: hydrate(queryClient, window.__TQ_STATE__)
  → hydrateRoot(rootEl, <App />)
  → TanStack Router attaches, panels begin their own data fetches
  → panels fill in with data
```

## Deferred

- Streaming SSR (flush before `allReady`, inject dehydrated chunks inline)
- CLI scaffold (`bunx elysia-react-ssr init`) — Option C
- SSR for routes beyond `/` (other pages have their own loaders; same `isSSR` guard pattern applies)
- SSR dev mode HMR for entry-server changes
