---
description: TanStack Query patterns for the web SPA
paths: ["apps/web/**/*.tsx", "apps/web/**/*.ts"]
---

# TanStack Query

Hooks live beside their feature (`features/**`, relevant `pages/**`, optional `hooks/<domain>/`). Use `@tanstack/react-query` plus `import { queryKeys } from "@/lib/queryKeys"`.

Never hardcode tuple roots like `["dashboard"]` — extend `apps/web/src/lib/queryKeys.ts` and reuse factory entries everywhere (including invalidations against `queryKeys.dashboard` when dashboards care about your mutation).
