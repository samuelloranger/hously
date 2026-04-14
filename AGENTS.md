# AGENTS.md

Agent instructions for the **Hously** monorepo. Read this before writing any code.

---

## Project Overview

Hously is a self-hosted command center for homelab enthusiasts — unified dashboard for infrastructure monitoring, media pipelines, and life management.

**Monorepo layout:**

| App | Path | Stack |
|-----|------|-------|
| API | `apps/api` | Bun + Elysia + Prisma + PostgreSQL + Redis |
| Web | `apps/web` | React 19 + Vite + TanStack Router/Query + Tailwind CSS 4 |
| Shared | `apps/shared` | Types, hooks, endpoints, utilities shared across apps |

In production, the frontend is built into `apps/api/public/` and served by the API (`SERVE_STATIC=true`). A single `Dockerfile` builds both.

---

## Development Setup

**Bun** is the package manager and runtime. Never use `npm` or `yarn`.

```bash
make install           # Install all dependencies
make dev-services      # Start PostgreSQL + MinIO + Redis (Terminal 1)
make dev-api           # Start API with hot reload (Terminal 2)
make dev-web           # Start Vite frontend (Terminal 3)
```

Always use `make` targets for database operations — never run Prisma CLI directly:

```bash
make migrate-dev       # Create a new migration
make migrate-deploy    # Apply pending migrations (prod)
make migrate-push      # Push schema without migration file (dev only)
```

---

## Architecture

### API (`apps/api/src/`)

| Directory | Purpose |
|-----------|---------|
| `routes/` | Elysia route plugins, one file per feature |
| `services/` | Business logic (S3, images, notifications, webhooks) |
| `jobs/` | Cron jobs via `@elysiajs/cron` |
| `middleware/` | Rate limiting, etc. |
| `db/` | Prisma client singleton |
| `auth.ts` | JWT auth with HTTP-only cookies |
| `prisma/schema.prisma` | Database schema |

Routes are composed in `src/index.ts` via `.use()`.

### Web (`apps/web/src/`)

| Directory | Purpose |
|-----------|---------|
| `features/` | Feature modules (auth, chores, shopping, medias, torrents, …) |
| `components/` | Shared components; `ui/` for Radix/CVA primitives |
| `routes/` | File-based routing (TanStack Router) |
| `hooks/<domain>/` | App-specific TanStack Query hooks grouped by domain |
| `lib/` | API client, query client, utilities |
| `locales/` | i18next translation files |
| `sw/` | Service Worker (PWA) |

### Shared (`apps/shared/src/`)

| Directory | Purpose |
|-----------|---------|
| `types/` | TypeScript interfaces shared by API and Web |
| `endpoints/` | API endpoint constants (`CHORES_ENDPOINTS`, etc.) |
| `hooks/` | TanStack Query hooks usable in any app |
| `utils/` | Date, sanitize, media URL helpers |
| `queryKeys.ts` | Centralized TanStack Query key factory |
| `api.ts` | API client factories |

---

## Coding Conventions

### Imports

- **Web** — always use the `@/` alias. Never use relative paths like `../../`.
- **API** — no aliases; use relative imports.
- **Shared** — always import from `@hously/shared`, never reach into internal paths.

```typescript
// Web ✓
import { cn } from "@/lib/utils";
import { useChores } from "@hously/shared";

// API ✓
import { prisma } from "../db";
import { badRequest } from "../utils/errors";

// Wrong anywhere
import { Chore } from "@hously/shared/src/types/chores";
import { cn } from "../../lib/utils";
```

### Naming

| Context | Convention | Example |
|---------|------------|---------|
| React components | PascalCase | `ChoreRow.tsx`, `CreateChoreModal.tsx` |
| Hooks | `use` + PascalCase | `useChores.ts`, `useDeleteChore.ts` |
| Utilities | camelCase | `formatDate.ts` |
| API route modules | camelCase + `Routes` | `choresRoutes`, `shoppingRoutes` |
| TypeScript types/interfaces | PascalCase | `Chore`, `CreateChoreRequest` |
| Endpoint constants | UPPER_SNAKE_CASE | `CHORES_ENDPOINTS` |
| Database columns (Prisma) | camelCase | `choreName`, `addedBy` |
| API response fields | snake_case | `chore_name`, `added_by`, `created_at` |
| URL paths | kebab-case | `/api/shopping`, `/api/clear-completed` |

The API always maps Prisma's camelCase fields to snake_case in responses:

```typescript
return {
  id: item.id,
  item_name: item.itemName,
  created_at: formatIso(item.createdAt),
};
```

### Feature Structure

Frontend features are self-contained:

```
features/<name>/
├── index.tsx
└── components/
    ├── <Name>Row.tsx
    ├── Create<Name>Modal.tsx
    └── Edit<Name>Modal.tsx
```

API routes export an Elysia plugin with a prefix:

```typescript
export const featureRoutes = new Elysia({ prefix: "/api/feature" })
  .use(auth)
  .use(requireUser)
  .get("/", async ({ user, set }) => {
    try {
      // prisma query + snake_case mapping
    } catch (error) {
      return serverError(set, "Failed to fetch items");
    }
  });
```

- Use error helpers from `src/utils/errors.ts` (`badRequest`, `notFound`, `serverError`)
- Always wrap handlers in try/catch
- Compose new routes in `src/index.ts` via `.use()`

### TanStack Query

- App-specific hooks → `apps/web/src/hooks/<domain>/`
- Shared hooks → `apps/shared/src/hooks/` (imported via `@hously/shared`)
- Never define query/mutation hooks inline in components

Query key factory pattern:

```typescript
// Always use the centralized factory
import { queryKeys } from "@hously/shared";
queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });

// Never hardcode strings
queryClient.invalidateQueries({ queryKey: ["chores"] }); // ✗
```

Query hook pattern:

```typescript
export function useFeature() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.feature.list(),
    queryFn: () => fetcher<FeatureResponse>(FEATURE_ENDPOINTS.LIST),
  });
}
```

Mutation hook pattern — invalidate all affected query keys on success:

```typescript
export function useCreateFeature() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFeatureRequest) =>
      fetcher<ApiResult<{ id: number }>>(FEATURE_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feature.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }); // if dashboard shows this data
    },
  });
}
```

### DRY / Shared Code

- Any type, hook, utility, or endpoint constant used by more than one app **must** live in `apps/shared/src/`.
- Re-export new shared code from `apps/shared/src/index.ts`.
- Within a single app, extract a helper only when the same logic appears in 3+ places. Prefer three similar lines over a premature abstraction.

---

## Adding a New Feature

1. **Schema** — add models to `apps/api/prisma/schema.prisma`, run `make migrate-dev`
2. **Types** — add interfaces to `apps/shared/src/types/<feature>.ts`, re-export from `index.ts`
3. **Endpoints** — add constants to `apps/shared/src/endpoints/<feature>.ts`, re-export
4. **Query keys** — add to `apps/shared/src/queryKeys.ts`
5. **API routes** — create `apps/api/src/routes/<feature>.ts`, compose in `src/index.ts`
6. **Hooks** — add TanStack Query hooks to `apps/web/src/hooks/<domain>/` or `apps/shared/src/hooks/` if shared
7. **UI** — create `apps/web/src/features/<name>/` with `index.tsx` and `components/`
8. **Route** — add a route file to `apps/web/src/routes/`

---

## Common Commands

```bash
make test              # Run all tests
make lint              # Lint all packages
make typecheck         # Type-check the frontend
make build             # Build web for production
docker build -t hously:latest .   # Build unified image
docker compose up -d   # Start all services
```

---

## Important Notes

- **Bun only** — do not use `npm`, `yarn`, or `pnpm` anywhere in this repo
- **Unstable** — early-stage project, breaking changes are expected
- **Access control** — `ALLOWED_EMAILS` gates registration; `ADMIN_EMAILS` gates admin routes
- **Image storage** — MinIO (S3-compatible) for avatars, chore images, recipe photos
- **Push notifications** — Web Push (VAPID) + APNs (iOS via `../hously-ios`)
- **Rate limiting** — 1000 requests/hour per IP
- **Production** — configs live in `~/servers/hously`, separate from the dev repo at `~/sites/hously`
