---
description: DRY placement across apps
globs: ["apps/**/*.ts", "apps/**/*.tsx"]
---

# DRY / shared primitives

Code that must compile in **both** the Bun API and Vite web app belongs in `@hously/shared` (`types`, `utils`, `constants` export paths). Browser-only logic, React components, TanStack caches, and REST path fragments used solely by the SPA stay in `apps/web`.

Expose new helpers through `apps/shared/src/index.ts` or `package.json#exports`; never consume `apps/shared/src/**` internals from sibling packages.

Prefer light duplication inside a single app until a third copy emerges — consolidate only when the abstraction is obvious.
