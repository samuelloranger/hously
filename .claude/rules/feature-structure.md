---
description: Feature-based folder structure for frontend and API patterns
globs: ["apps/web/src/features/**", "apps/api/src/routes/**"]
---

# Feature & Route Structure

## Frontend features (`apps/web/src/features/`)

Each feature is self-contained with its own components:

```
features/<name>/
├── index.tsx              # Main page component
├── components/
│   ├── <Name>Row.tsx      # List item component
│   ├── Create<Name>Modal.tsx
│   ├── Edit<Name>Modal.tsx
│   └── ...
```

- Feature-specific components go inside `features/<name>/components/`
- Shared/reusable components go in `src/components/`
- UI primitives (Button, Dialog, etc.) go in `src/components/ui/`

## API routes (`apps/api/src/routes/`)

Each route file exports an Elysia plugin with a prefix:

```typescript
export const featureRoutes = new Elysia({ prefix: '/api/feature' })
  .use(auth)
  .use(requireUser)
  .get('/', async ({ user, set }) => {
    try {
      // ... prisma query
      return { items };
    } catch (error) {
      return serverError(set, 'Failed to fetch items');
    }
  });
```

- Use error helpers from `src/utils/errors.ts` (`badRequest`, `notFound`, `serverError`, etc.)
- Always wrap route handlers in try/catch
- Map Prisma results to snake_case response format
- Compose routes in `src/index.ts` via `.use()`
