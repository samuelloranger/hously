# Design: Remove the Hously task board

**Date:** 2026-06-08
**Status:** Approved (design); pending spec review
**Author:** Samuel Loranger (with Claude)
**Branch:** Stacks on top of `remove-chores-custom-events-holidays` (the in-flight
downgrade removing chores/habits/custom-events/holidays). The board removal is an
additional commit on that same branch and ships in the same release. The board is
independent of that work — no overlap in features, only in shared files
(`schema.prisma`, `apps/api/src/index.ts`, `search`, `navigation`, `prefetch`,
`queryKeys`, `QuickActionPalette`, locales, `CLAUDE.md`), which this work edits
on top of the existing uncommitted changes. A **separate** Prisma migration is
added for the board-table drops (alongside the existing
`20260608000000_remove_chores_custom_events_holidays_habits` migration).

## Context

Hously's custom Kanban task board has been superseded by a dedicated self-hosted
Kan instance (`kan.samlo.cloud`). The board is no longer needed inside Hously and
should be fully removed — code, API routes, shared types, and database tables.

Hously is a Bun monorepo (`apps/web`, `apps/api`, `apps/shared`) using TanStack
file-based routing, Elysia (API), and Prisma/PostgreSQL. The production image is
built by GitHub Actions on release and auto-deployed to `~/servers/hously`.

## Goal

Remove **only the task board**. Media features (library, medias, watchlist,
collections, explore, release calendar) and chore/habit analytics stay untouched.

## Non-goals

- No data migration or export — existing board data is dropped outright (decided).
- No changes to the release calendar, chores, habits, or any media feature.
- No unrelated refactoring.

## Scope analysis

The board is self-contained. Verified findings:

- **DB models are isolated.** The five `board_*` models reference only `User`
  (back-relations). `TaskCompletion` and `ActivityLog` are chore-scoped
  (`taskType`/`type` filtered on `"chore"`), **not** board-scoped — dropping the
  board does not touch them.
- **Routing is file-based.** Deleting `apps/web/src/pages/board/` removes the
  `/board` route automatically (TanStack regenerates the route tree).
- **Locales:** `en` and `fr` only.

## Removal surface

### 1. Code deletion

Web (`apps/web`):
- `src/pages/board/` (entire directory — page, components, utils, `__tests__`)
- `src/lib/endpoints/boardTasks.ts`, `src/lib/endpoints/boardTags.ts`
- `e2e/board.spec.ts`

API (`apps/api`):
- `src/routes/board-tasks/` (entire directory)
- `src/routes/board-tags/` (entire directory)
- `test/boardTasks.test.ts`

Shared (`apps/shared`):
- `src/types/boardTasks.ts`

### 2. Reference unwiring

API:
- `src/index.ts` — remove the `boardTasksRoutes` / `boardTagsRoutes` imports and
  their `.use(...)` registrations.
- `src/routes/search/index.ts` — remove the `board_tasks` search branch
  (`board-tasks/mappers` import, `prisma.boardTask.findMany`, `board_tasks` in the
  response). Users/medias search must keep working.

Web:
- `src/lib/routing/navigation.ts` — remove the `/board` nav entry.
- `src/lib/routing/prefetch.ts` — remove the `BOARD_TASKS_ENDPOINTS` prefetch and
  the `/board` route prefetch entry.
- `src/lib/queryKeys.ts` — remove board query keys.
- `src/components/QuickActionPalette.tsx` — remove the `board_tasks` section type,
  `boardTaskActions`, the `board_tasks` search-result consumption, and the
  `board_tasks` section label.
- `src/locales/en/common.json` and `src/locales/fr/common.json` — remove
  `nav.board` and the `board.*` key namespace.

### 3. Database

`apps/api/prisma/schema.prisma`:
- Remove models: `BoardTask`, `BoardTimeLog`, `BoardTaskDependency`, `BoardTag`,
  `BoardTaskActivity`.
- Remove enums: `BoardTaskStatus`, `BoardTaskPriority`, `BoardTaskActivityType`.
- Remove the corresponding back-relation fields on `User`
  (`BoardTaskCreatedBy`, `BoardTaskAssignee`, board time logs, board activities).

Generate one migration (`make migrate-dev`) that `DROP`s the `board_*` tables and
their enums. `task_completions` / `activity_logs` are untouched.

### 4. Docs

- `CLAUDE.md:106` — drop the board mention from the feature list.

## Verification

Before merge:
- `make typecheck` — green
- `make lint` — green
- `make test` — green (web + api + shared)
- `bun run knip` — no newly-orphaned exports introduced by the removal

## Deploy pipeline (no manual migrate step)

1. Land all changes on a branch; generate the DROP migration locally.
2. Merge to `main` — `ci.yml` runs tests/lint/typecheck.
3. Publish a GitHub Release — `docker-publish.yml` builds and pushes
   `ghcr.io/samuelloranger/hously:latest`, then emits a `package published`
   webhook.
4. The server's `deployer` (webhook listener) runs `deploy.sh`:
   `docker compose -p hously pull hously && up -d hously`.
5. On container start, `apps/api/entrypoint.sh` runs `bunx prisma migrate deploy`,
   which applies the DROP migration automatically.

## Rollback

The DROP migration is irreversible (data is gone by design). Rollback before
release = revert the branch. After release, reverting code restores the app but
not the dropped tables; a fresh `migrate deploy` would recreate empty `board_*`
tables if the models were restored.

## Risks

- **Missed reference** causing a typecheck/test failure — mitigated by running the
  full verification suite + `knip` before merge.
- **Search regression** if the `board_tasks` branch is removed carelessly —
  covered by API search tests.
