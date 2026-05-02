---
description: Import path conventions for the monorepo
paths: ["apps/**/*.ts", "apps/**/*.tsx"]
---

# Import Path Rules

## Web App (`apps/web`)

Always use the `@/` alias for local imports. Never use relative paths like `../../`.

```typescript
// Correct
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/auth/useAuth";
import { CompleteCheckbox } from "@/components/CompleteCheckbox";

// Wrong
import { cn } from "../../lib/utils";
import { useAuth } from "../../../hooks/auth/useAuth";
```

## API App (`apps/api`)

Use the `@hously/api/` alias for internal imports within `apps/api`. This alias is configured in `tsconfig.json` and `bunfig.toml` and resolves to `apps/api/src/`.

```typescript
// Correct
import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";
import { badRequest } from "@hously/api/utils/errors";

// Wrong — do not use relative paths
import { prisma } from "../db";
import { badRequest } from "../../utils/errors";
```

## Shared Package (`@hously/shared`)

Always import shared types, hooks, utilities, and endpoints from `@hously/shared` — never reach into its internal file paths.

```typescript
// Correct
import { useChores, type Chore, CHORES_ENDPOINTS } from "@hously/shared";

// Wrong
import { Chore } from "@hously/shared/src/types/chores";
```
