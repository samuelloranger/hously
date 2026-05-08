# AGENTS.md

Agent instructions for the **Hously** monorepo. Read this before writing any code.

---

## Project Overview

Hously is a self-hosted command center for homelab enthusiasts — unified dashboard for infrastructure monitoring, media pipelines, and life management.

**Monorepo layout:**

| App    | Path          | Stack                                                    |
| ------ | ------------- | -------------------------------------------------------- |
| API    | `apps/api`    | Bun + Elysia + Prisma + PostgreSQL + Redis               |
| Web    | `apps/web`    | React 19 + Vite + TanStack Router/Query + Tailwind CSS 4 |
| Shared | `apps/shared` | Types, utilities, constants shared across apps           |

In production, the frontend is built into `apps/api/public/` and served by the API (`SERVE_STATIC=true`). A single `Dockerfile` builds both.

---

## Development Setup

**Bun** is the package manager and runtime. Never use `npm` or `yarn`.

```bash
make install           # Bun workspaces (root) — installs api, web, shared
make dev-services      # Start PostgreSQL + Redis (Terminal 1)
make dev-api           # Start API with hot reload (Terminal 2)
make dev-web           # Start Vite frontend (Terminal 3)
```

From the repo root you can also run `bun run dev:services` (same Compose services as `make dev-services`).

Always use `make` targets for database operations — never run Prisma CLI directly:

```bash
make migrate-dev       # Create a new migration
make migrate-deploy    # Apply pending migrations (prod)
make migrate-push      # Push schema without migration file (dev only)
```

---

## Architecture

### API (`apps/api/src/`)

| Directory              | Purpose                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `routes/`              | Elysia plugins (`routes/<feature>/index.ts`, nested areas like `integrations/` or `dashboard/`) |
| `services/`            | Business logic (images, notifications, webhooks, …)                                             |
| `jobs/`                | Cron jobs via `@elysiajs/cron`                                                                  |
| `middleware/`          | Rate limiting, auth helpers, etc.                                                               |
| `db/`                  | Prisma client singleton                                                                         |
| `auth.ts`              | Auth-related HTTP routes wiring                                                                 |
| `prisma/schema.prisma` | Database schema                                                                                 |

Imports use the `@hously/api/*` path alias (see **Imports** below). Routes are composed in `src/index.ts` via `.use()`.

### Web (`apps/web/src/`)

| Directory         | Purpose                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `features/`       | Feature modules (auth, chores, medias, torrents, …)                                   |
| `components/`     | Shared components; `ui/` for Radix/CVA primitives                                     |
| `routes/`         | File-based routing (TanStack Router)                                                  |
| `hooks/<domain>/` | Cross-cutting hooks; features often colocate `use*.ts` beside `pages/` or `features/` |
| `lib/`            | API client, TanStack `queryKeys`, query client, utilities                             |
| `locales/`        | i18next translation files                                                             |
| `sw/`             | Service Worker (PWA)                                                                  |

### Shared (`apps/shared/src/`)

| Directory    | Purpose                                           |
| ------------ | ------------------------------------------------- |
| `types/`     | TypeScript interfaces shared by API and Web       |
| `utils/`     | Pure helpers (dates, validation, media paths, …)  |
| `constants/` | Small shared constants (e.g. qBittorrent helpers) |

Anything used by **both** apps belongs here — TanStack hooks, web-only URLs, and the query-key factory live **under `apps/web`** (see **TanStack Query**).

---

## Coding Conventions

### Imports

- **Web** — always use the `@/` alias for app code. Never use relative paths like `../../`.
- **API** — use the `@hously/api/*` alias (maps to `apps/api/src/*` via `tsconfig.json` / `bunfig.toml`).
- **Shared** — import from `@hously/shared`; use subpaths like `@hously/shared/types` when appropriate. Never reach into internal `src/` paths.

```typescript
// Web ✓
import { cn } from "@/lib/utils";
import { useChores } from "@/pages/chores/useChores";

// API ✓
import { prisma } from "@hously/api/db";
import { badRequest } from "@hously/api/utils/errors";

// Wrong anywhere
import { Chore } from "@hously/shared/src/types/chores";
```

### Naming

| Context                     | Convention           | Example                                                    |
| --------------------------- | -------------------- | ---------------------------------------------------------- |
| React components            | PascalCase           | `ChoreRow.tsx`, `CreateChoreModal.tsx`                     |
| Hooks                       | `use` + PascalCase   | `useChores.ts`, `useDeleteChore.ts`                        |
| Utilities                   | camelCase            | `formatDate.ts`                                            |
| API route plugins           | camelCase + `Routes` | `choresRoutes`, `calendarRoutes`                           |
| TypeScript types/interfaces | PascalCase           | `Chore`, `CreateChoreRequest`                              |
| Endpoint constants          | UPPER_SNAKE_CASE     | Colocate with web hooks / `lib/` unless shared across apps |
| Database columns (Prisma)   | camelCase            | `choreName`, `addedBy`                                     |
| API response fields         | snake_case           | `chore_name`, `added_by`, `created_at`                     |
| URL paths                   | kebab-case           | `/api/chores`, `/api/clear-completed`                      |

### Feature Structure

Frontend features are self-contained:

```
features/<name>/
├── index.tsx
└── components/
```

API routes expose an Elysia plugin per area:

```typescript
export const choresRoutes = new Elysia({ prefix: "/api/chores" })
  .use(auth)
  .use(requireUser)
  .get("/", async ({ user, set }) => {
    try {
      /* prisma query + snake_case mapping */
    } catch {
      return serverError(set, "Failed to fetch items");
    }
  });
```

Use error helpers from `src/utils/errors.ts`, compose in `src/index.ts`.

### TanStack Query

- **Hooks** — under `apps/web/src/features/`, `apps/web/src/pages/`, or `apps/web/src/hooks/<domain>/`; not in `@hously/shared`.
- **Query keys** — `apps/web/src/lib/queryKeys.ts` (import via `@/lib/queryKeys`).

```typescript
import { queryKeys } from "@/lib/queryKeys";
queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
```

### DRY / Shared Code

Promote **types**, **pure utilities**, and **cross-app constants** to `apps/shared/`. Keep web-only hooks, URL builders, and `queryKeys` in `apps/web` until something else consumes them.

---

## Adding a New Feature

1. **Schema** — `apps/api/prisma/schema.prisma`, then `make migrate-dev`
2. **Types** — `apps/shared/src/types/`; re-export from `types/index.ts` / package root when needed
3. **Query keys** — `apps/web/src/lib/queryKeys.ts`
4. **API routes** — `apps/api/src/routes/<area>/…` (`index.ts` per plugin), compose in `apps/api/src/index.ts`
5. **Hooks** — `apps/web` (feature/pages/hooks)
6. **UI** — routes under `apps/web/src/routes/` plus screens in `features/` / `pages/` / `components/`

---

## Global Settings (AppSettings)

Singleton `AppSettings` table (row id=1):

| Field                         | Type    | Default  | Purpose                                                 |
| ----------------------------- | ------- | -------- | ------------------------------------------------------- |
| `country_code`                | VARCHAR | US       | Calendar holidays and TMDB release dates                |
| `calendar_subdivision_code`   | VARCHAR | NULL     | State/province for holiday calendars                    |
| `upcoming_window_months`      | INT     | 12       | Upcoming movies/TV horizon (3/6/12/24)                  |
| `upcoming_languages`          | STRING  | en,fr    | Comma-separated TMDB language codes                     |
| `dashboard_widget_visibility` | JSON    | all true | Toggles: Weather, HomeAssistant, System, Downloads, RSS |

**API:** `PATCH /api/settings` (admin), `GET /api/settings`. **Worker:** `src/workers/refreshUpcoming.ts`. **Route:** `src/routes/dashboard/upcoming/`. **UI:** Settings → General.

---

## Common Commands

```bash
make test              # Root script: web + api + shared tests
make lint              # ESLint on apps/web only (matches CI)
make typecheck         # Each workspace that defines `typecheck`
make build             # Production web build
docker build -t hously:latest .   # Unified image

docker compose up -d                                     # Repo file: PostgreSQL + Redis only
docker compose -f docker-compose.prod.yml up -d         # Full stack: your prod compose file
```

---

## Important Notes

- **Bun only** — do not use `npm`, `yarn`, or `pnpm`
- **Unstable** — breaking changes happen
- **Access control** — `ALLOWED_EMAILS` / `ADMIN_EMAILS`
- **Image storage** — `IMAGE_STORAGE_DIR` (default `./data/images`)
- **Push** — Web Push (VAPID)
- **Rate limiting** — 1000 req/hour per IP
- **Production configs** — e.g. `~/servers/hously` vs dev `~/sites/hously`
