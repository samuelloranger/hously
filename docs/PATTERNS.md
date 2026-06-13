# Patterns

Concrete recurring code patterns in Hously with short snippets. Use these as templates when adding new features.

Last verified: 2026-06-11

## Elysia Route Plugin Shape

Every feature area exports an Elysia plugin from `apps/api/src/routes/<area>/index.ts` and is composed in `apps/api/src/index.ts` via `.use()`. Plugins set their `prefix` so route paths stay localized.

```typescript
// apps/api/src/routes/releases/index.ts
import { Elysia } from "elysia";
import { requireAdmin } from "@hously/api/middleware/auth";
import { serverError } from "@hously/api/errors";
import { getCachedGitHubReleases } from "@hously/api/services/githubReleases";

export const releasesRoutes = new Elysia({ prefix: "/api/releases" })
  .use(requireAdmin)
  .get("/", async ({ set }) => {
    try {
      return await getCachedGitHubReleases();
    } catch {
      return serverError(set, "Failed to load GitHub releases");
    }
  });
```

Sub-plugins for large feature areas keep `index.ts` thin and let each domain own its own file (see `apps/api/src/routes/library/index.ts` — list, meta, grab, files, jobs).

For admin-only routes use `requireAdmin` from the same middleware (`apps/api/src/middleware/auth.ts`).

## Route Handler + snake_case Mapping

Handlers query Prisma directly, catch errors, map camelCase → snake_case before returning.

```typescript
.get("/", async ({ user, set }) => {
  try {
    const items = await prisma.libraryMedia.findMany({
      orderBy: { addedAt: "desc" },
    });
    return {
      items: items.map((item) => ({
        id: item.id,
        tmdb_id: item.tmdbId,
        poster_url: item.posterUrl,
        added_at: item.addedAt.toISOString(),
      })),
    };
  } catch {
    return serverError(set, "Failed to fetch library");
  }
});
```

Mapper functions for non-trivial entities live alongside the route or in a domain utility such as `apps/api/src/utils/medias/mappers.ts`.

## TanStack Query Hook (Read)

Web hooks live next to their feature (`apps/web/src/pages/<area>/use*.ts` or `apps/web/src/features/<area>/`). They always pull the query key from the factory and the URL from the local endpoints map.

```typescript
// apps/web/src/features/medias/hooks/useLibrary.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { LIBRARY_ENDPOINTS } from "@/lib/endpoints";
import type { LibraryListResponse } from "@hously/shared/types";

export function useLibrary(filters?: { type?: string; status?: string }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.library.list(filters),
    queryFn: () => fetcher<LibraryListResponse>(LIBRARY_ENDPOINTS.LIST),
    placeholderData: keepPreviousData,
  });
}
```

For mutations, invalidate the matching root after success: `queryClient.invalidateQueries({ queryKey: queryKeys.library.all })`. If a mutation affects a dashboard widget, invalidate the relevant `queryKeys.dashboard.*` key too.

## Feature Folder Layout (Web)

Two valid placements depending on domain size:

- Large domains with a separate data layer: `apps/web/src/features/<name>/hooks/` plus page UI under `apps/web/src/pages/<name>/`.
- Route-owned domains: `apps/web/src/pages/<name>/index.tsx` with `_component/`, optional `_hooks/`, and colocated `use*.ts` files.

Do not create a `features/` split for a small page unless it removes real complexity.

Modal pattern: search params drive modal state (for example a media detail ID). The route's `validateSearch` narrows the params and the page component renders the corresponding modal.

## SSE Stream (Server)

Use the helper rather than hand-rolling a stream — it gives you JSON dedup, abort handling, and a 15s heartbeat for free.

```typescript
return createJsonSseResponse({
  request,
  intervalMs: 2000,
  poll: async () => fetchTorrentSpeed(),
  onError: (err) => ({ speed_bytes: 0, error: String(err) }),
  logLabel: "downloads-speed",
});
```

Defined in `apps/api/src/utils/sse.ts`. Stateful web consumers can use `apps/web/src/lib/realtime/useEventSourceState.ts`; notification and library streams have domain-specific hooks.

## Background Job (Cron)

Repeatable jobs are registered once at startup in `apps/api/src/services/queueService.ts:setupScheduledJobs()`. The processor file lives under `apps/api/src/workers/` and is wired into `apps/api/src/services/jobs/scheduledTasksWorker.ts`.

To add a new cron job:

1. Add a constant to `SCHEDULED_JOB_NAMES` in `queueService.ts`.
2. Add it to the `jobs` array with a cron pattern.
3. Implement the processor in `apps/api/src/workers/<name>.ts` (export a function).
4. Map the job name → processor in `scheduledTasksWorker.ts`.

## Webhook Handler

Inbound webhooks for a new third-party service go in `apps/api/src/services/webhookHandlers/<name>.ts` and register in `registry.ts`. The dispatch lives at `POST /api/webhooks/:serviceName` (`apps/api/src/routes/webhooks/index.ts`).

qBittorrent uses dedicated endpoints under `/api/webhooks/qbittorrent/*` because they're auto-configured into qBittorrent's "Run external program on torrent finished" hook with a shared bearer secret.

## Changelog

- 2026-06-11 — Replaced removed chores/board examples with current library and release patterns.
