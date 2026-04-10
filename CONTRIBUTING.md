# Contributing to Hously

Thanks for your interest in contributing! This guide covers the essentials for getting started.

## Development Setup

**Requirements:** [Bun](https://bun.sh) v1.3+, [Docker](https://docs.docker.com/get-docker/)

```bash
git clone https://github.com/samuelloranger/hously.git
cd hously
cp .env.example .env
# Edit .env: set ALLOWED_EMAILS, ADMIN_EMAILS, SECRET_KEY
```

Start the dev environment in three terminals:

```bash
make install          # Install dependencies + git hooks
make dev-services     # Terminal 1: PostgreSQL + MinIO + Redis
make dev-api          # Terminal 2: API with hot reload
make dev-web          # Terminal 3: Frontend with Vite
```

Run `make migrate-dev` after changing the Prisma schema.

## Project Structure

```
apps/
  api/       Elysia API server (Bun) + Prisma ORM
  web/       React 19 SPA (TanStack Router + Query, Tailwind CSS 4)
  shared/    Types, hooks, utilities, endpoints shared across apps
```

## Workflow

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run checks before pushing:
   ```bash
   make typecheck    # Type check all workspaces
   make lint         # Lint
   make test         # Run all tests
   ```
4. Open a pull request against `main`

CI runs typecheck, lint, format check, and tests on every push and PR.

## Conventions

### Naming

| Context             | Convention                  | Example            |
| ------------------- | --------------------------- | ------------------ |
| React components    | PascalCase                  | `ChoreRow.tsx`     |
| Hooks               | camelCase with `use` prefix | `useChores.ts`     |
| API route plugins   | camelCase + `Routes`        | `choresRoutes`     |
| API response fields | snake_case                  | `created_at`       |
| URL paths           | kebab-case                  | `/api/shopping`    |
| Endpoint constants  | UPPER_SNAKE_CASE            | `CHORES_ENDPOINTS` |

### Imports

- **Web app:** use `@/` alias (never relative `../../`)
- **API:** use relative imports (no aliases)
- **Cross-app code:** import from `@hously/shared`

### Shared Code

Any type, hook, utility, or endpoint constant used by both `api` and `web` must live in `apps/shared/src/` and be re-exported from `apps/shared/src/index.ts`.

### Frontend Features

Each feature is self-contained under `apps/web/src/features/<name>/` with its own `components/` directory. Shared UI primitives live in `apps/web/src/components/ui/`.

### API Routes

Each route file exports an Elysia plugin composed in `src/index.ts`:

```typescript
export const featureRoutes = new Elysia({ prefix: "/api/feature" })
  .use(auth)
  .use(requireUser)
  .get("/", async ({ user, set }) => {
    // ...
  });
```

- Wrap handlers in try/catch using error helpers (`badRequest`, `notFound`, `serverError`)
- Map Prisma camelCase fields to snake_case in responses

### TanStack Query

- All query/mutation hooks live in `apps/shared/src/hooks/`
- Query keys use the centralized factory in `apps/shared/src/queryKeys.ts`
- Invalidate related query keys (e.g. dashboard) in mutation `onSuccess`

## Adding a New Integration

Hously has a plugin system for homelab integrations. To add one:

1. **API:** Create a route plugin in `apps/api/src/routes/plugins/` with GET (config) and PUT (save) endpoints
2. **API:** Add a normalizer in `apps/api/src/utils/plugins/normalizers.ts` to decrypt/validate stored config
3. **Shared:** Add types in `apps/shared/src/types/plugins.ts` and endpoint constant in `apps/shared/src/endpoints/plugins.ts`
4. **Shared:** Add query/mutation hooks in `apps/shared/src/hooks/`
5. **Web:** Create a settings section component in `apps/web/src/pages/settings/_component/plugins/`
6. **Web:** Add locale strings in `apps/web/src/locales/{en,fr}/common.json`

## Database Changes

Edit `apps/api/prisma/schema.prisma`, then:

```bash
make migrate-dev     # Creates a migration file
# Review the generated SQL in prisma/migrations/
```

## Reporting Issues

Use [GitHub Issues](https://github.com/samuelloranger/hously/issues). Include:

- Steps to reproduce
- Expected vs actual behavior
- Docker or local dev setup
- Browser/OS if frontend-related
