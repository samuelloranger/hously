# Conventions

Cross-references the canonical rule files in `.claude/rules/` (also mirrored as `.cursor/rules/*.mdc`). This file only adds practical notes not already captured there.

Last verified: 2026-05-25

## Canonical Rule Files

Read these first — do not duplicate them here:

- [`.claude/rules/imports.md`](../.claude/rules/imports.md) — `@/` for web, `@hously/api/*` for api, `@hously/shared` for cross-app
- [`.claude/rules/naming-conventions.md`](../.claude/rules/naming-conventions.md) — PascalCase / camelCase / snake_case / kebab-case rules
- [`.claude/rules/feature-structure.md`](../.claude/rules/feature-structure.md) — frontend feature folder layout and API route plugin shape
- [`.claude/rules/dry-and-shared-code.md`](../.claude/rules/dry-and-shared-code.md) — what belongs in `apps/shared`
- [`.claude/rules/tanstack-query.md`](../.claude/rules/tanstack-query.md) — query hook placement and query-key factory

`CLAUDE.md` and `AGENTS.md` at the repo root summarize the same rules; prefer the rule files when there's any drift.

## API Response Mapping (snake_case)

**Always** map Prisma camelCase columns to snake_case in API responses. This is enforced by convention, not by a layer — every route does it manually.

```typescript
const response = {
  id: chore.id,
  chore_name: chore.choreName,
  added_by: chore.addedBy,
  created_at: chore.createdAt?.toISOString() ?? null,
};
```

Mapper helpers live next to the route module they serve — see `apps/api/src/routes/chores/choreMappers.ts` for `mapChore()`, or `apps/api/src/utils/mappers.ts` for shared mappers like `mapUser()`. Larger feature areas (library, dashboard) keep their own mappers under `src/utils/medias/`, `src/services/library/`, etc.

Why: snake_case keeps response keys aligned with the URL convention (`/api/added-by` style) and gives any non-JS client a clean, language-agnostic shape. camelCase Prisma is just an ORM artifact.

## Query Keys Live in `apps/web`, Not `apps/shared`

`AGENTS.md` overrides what early documentation may say: the query-key factory and TanStack Query hooks live under `apps/web/src/`, not under `@hously/shared`. Import from `@/lib/queryKeys`:

```typescript
import { queryKeys } from "@/lib/queryKeys";
queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
```

Why kept web-only: TanStack Query has no consumer in `apps/api`. Promoting hooks to shared would force the API to ship React as a transitive dep for no gain.

## Endpoint Constants Are Web-Local

`CHORES_ENDPOINTS`, `LIBRARY_ENDPOINTS`, etc. live under `apps/web/src/lib/endpoints/`. They are not shared, because the API doesn't reverse-construct its own URLs.

## Error Helpers, Not Thrown Exceptions

Route handlers wrap business logic in `try/catch` and return error helpers from `apps/api/src/errors.ts`: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `serverError`, `badGateway`, `serviceUnavailable`. Each sets `set.status` and returns `{ error: string }`.

```typescript
.get("/", async ({ user, set }) => {
  try {
    /* ... */
  } catch {
    return serverError(set, "Failed to fetch items");
  }
})
```

Why: Elysia's `onError` only catches uncaught throws; explicit returns keep the response shape predictable for the client.

## URL Conventions

Route paths are kebab-case (`/api/clear-completed`, `/api/library/downloads`). Verbs come from HTTP methods, not from URL segments. Avoid `/api/getChores` — use `GET /api/chores`.

## Changelog

- 2026-05-25 — Initial bootstrap pass.
