---
description: Import path conventions for the monorepo
globs: ["apps/**/*.ts", "apps/**/*.tsx"]
---

# Import Path Rules

## Web App (`apps/web`)

Always use the `@/` alias for local imports. Never use relative paths like `../../`.

```typescript
// Correct
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { CompleteCheckbox } from '@/components/CompleteCheckbox';

// Wrong
import { cn } from '../../lib/utils';
import { useAuth } from '../../../hooks/useAuth';
```

## API App (`apps/api`)

The API does **not** have path aliases. Use relative imports.

```typescript
// Correct
import { prisma } from '../db';
import { badRequest } from '../utils/errors';
```

## Shared Package (`@hously/shared`)

Always import shared types, hooks, utilities, and endpoints from `@hously/shared` — never reach into its internal file paths.

```typescript
// Correct
import { useChores, type Chore, CHORES_ENDPOINTS } from '@hously/shared';

// Wrong
import { Chore } from '@hously/shared/src/types/chores';
```
