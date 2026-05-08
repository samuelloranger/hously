---
description: Feature-based folder layout + API routing structure
globs: ["apps/web/src/features/**", "apps/api/src/routes/**"]
---

# Feature & route layout

## Frontend (`apps/web`)

```
features/<name>/
├── index.tsx
├── components/
└── hooks/        # optional TanStack/query helpers for that feature
```

Shared building blocks sit in `src/components/` (with `src/components/ui/` for primitives).

## API (`apps/api`)

Prefer `routes/<area>/index.ts`, with nesting for large domains (`integrations/*`, `dashboard/*`). Export `<name>Routes`, set `.prefix("/api/...")`, reuse auth/middleware helpers, map DB models to snake_case JSON, append via `.use()` inside `apps/api/src/index.ts`.
