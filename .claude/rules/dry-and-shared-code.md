---
description: DRY principles and shared code usage
globs: ["apps/**/*.ts", "apps/**/*.tsx"]
---

# DRY Code Principles

## Use `@hously/shared` for cross-app code

Any type, utility, hook, endpoint constant, or API factory used by more than one app **must** live in `apps/shared/src/`. Never duplicate logic between `apps/web` and `apps/api`.

### Where shared code lives

| What | Location |
|------|----------|
| TypeScript interfaces | `apps/shared/src/types/` |
| API endpoint constants | `apps/shared/src/endpoints/` |
| TanStack Query hooks | `apps/shared/src/hooks/` |
| Utility functions | `apps/shared/src/utils/` |
| Query key factory | `apps/shared/src/queryKeys.ts` |
| API client factories | `apps/shared/src/api.ts` |

### Adding new shared code

1. Create or edit the relevant file in `apps/shared/src/`
2. Re-export it from `apps/shared/src/index.ts`
3. Import via `@hously/shared` in consuming apps

### Query keys

Always define query keys in the centralized factory (`apps/shared/src/queryKeys.ts`). Never hardcode query key strings in components or hooks.

```typescript
// Correct
import { queryKeys } from '@hously/shared';
queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });

// Wrong
queryClient.invalidateQueries({ queryKey: ['chores'] });
```

## Within an app, extract only when reused

Don't prematurely abstract. Extract a helper only when the same logic appears in 3+ places within the same app. Three similar lines are better than a premature abstraction.
