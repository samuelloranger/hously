# Patterns

Concrete recurring code patterns in Hously with short snippets. Use these as templates when adding new features.

Last verified: 2026-05-25

## Elysia Route Plugin Shape

Every feature area exports an Elysia plugin from `apps/api/src/routes/<area>/index.ts` and is composed in `apps/api/src/index.ts` via `.use()`. Plugins set their `prefix` so route paths stay localized.

```typescript
// apps/api/src/routes/chores/index.ts
import { Elysia } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { choreCrudRoutes } from "./choreCrudRoutes";

export const choresRoutes = new Elysia({ prefix: "/api/chores" })
  .use(auth)         // resolves { user } into context (may be null)
  .use(requireUser)  // returns 401 if no user
  .use(choreCrudRoutes);
```

Sub-plugins for large feature areas keep `index.ts` thin and let each domain own its own file (see `apps/api/src/routes/library/index.ts` — list, meta, grab, files, jobs).

For admin-only routes use `requireAdmin` from the same middleware (`apps/api/src/middleware/auth.ts`).

## Route Handler + snake_case Mapping

Handlers query Prisma directly, catch errors, map camelCase → snake_case before returning.

```typescript
.get("/", async ({ user, set }) => {
  try {
    const items = await prisma.chore.findMany({ orderBy: { createdAt: "desc" } });
    return {
      items: items.map((c) => ({
        id: c.id,
        chore_name: c.choreName,
        added_by: c.addedBy,
        created_at: c.createdAt?.toISOString() ?? null,
      })),
    };
  } catch {
    return serverError(set, "Failed to fetch chores");
  }
});
```

Mapper functions for non-trivial entities live alongside the route (`choreMappers.ts`) or in `apps/api/src/utils/mappers.ts` when reused.

## TanStack Query Hook (Read)

Web hooks live next to their feature (`apps/web/src/pages/<area>/use*.ts` or `apps/web/src/features/<area>/`). They always pull the query key from the factory and the URL from the local endpoints map.

```typescript
// apps/web/src/pages/chores/useChores.ts
import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { ChoresResponse } from "@hously/shared/types";

export function useChores() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.chores.list(),
    queryFn: () => fetcher<ChoresResponse>(CHORES_ENDPOINTS.LIST),
  });
}
```

For mutations, invalidate the matching list key after success: `queryClient.invalidateQueries({ queryKey: queryKeys.chores.all })`. If a mutation affects a dashboard widget, invalidate `queryKeys.dashboard.*` too.

## Feature Folder Layout (Web)

Two valid placements depending on age:

- New self-contained features: `apps/web/src/features/<name>/index.tsx` + `components/` (matches `.claude/rules/feature-structure.md`).
- Legacy pages still under: `apps/web/src/pages/<name>/index.tsx` with `_component/`, `_hooks/`, and colocated `use*.ts` files at the same level.

Both patterns coexist; prefer `features/` for new work.

Modal pattern: search params drive modal state (e.g. `?modal=create` or `?modal=edit&choreId=42`). The route's `validateSearch` narrows the params and the page component renders the corresponding modal lazily.

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

Defined in `apps/api/src/utils/sse.ts`. Consumed in the web app via `apps/web/src/lib/realtime/useEventSource.ts`.

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
