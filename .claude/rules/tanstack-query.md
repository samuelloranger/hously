---
description: TanStack Query patterns for the web SPA
paths: ["apps/web/**/*.tsx", "apps/web/**/*.ts"]
---

# TanStack Query

Use `@tanstack/react-query` plus `import { queryKeys } from "@/lib/queryKeys"`. Place a new hook by _who consumes it_, top-down (first match wins):

1. **Server-state hook in a domain that owns a `features/<name>/` module** → `apps/web/src/features/<name>/hooks/` (today: `medias`, `downloadsImport` — medias is the reference shape).
2. **Consumed across unrelated areas, or a domain-level utility owned by no single page** → `apps/web/src/hooks/<domain>/`.
3. **Otherwise it belongs to one page** → colocate under `apps/web/src/pages/<area>/` (a `_hooks/` subfolder when there are many, like board; `_component/` for page-local UI state).

Don't replicate the medias `features/` + `pages/` split for small domains — `board`, `chores`, `habits` keep everything under `pages/<area>/`. Never export hooks from `@hously/shared`.

Never hardcode tuple roots like `["dashboard"]` — extend `apps/web/src/lib/queryKeys.ts` and reuse factory entries everywhere (including invalidations against `queryKeys.dashboard` when dashboards care about your mutation).
