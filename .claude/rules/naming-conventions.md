---
description: Naming conventions across the monorepo
globs: ["apps/**/*.ts", "apps/**/*.tsx", "apps/api/prisma/**"]
---

# Naming Conventions

## Files

| Context | Convention | Example |
|---------|-----------|---------|
| React components | PascalCase | `ChoreRow.tsx`, `CreateChoreModal.tsx` |
| Hooks | camelCase with `use` prefix | `useChores.ts`, `useAuth.ts` |
| Utilities | camelCase | `formatDate.ts`, `sanitize.ts` |
| Route modules (API) | camelCase | `chores.ts`, `shopping.ts` |
| Type files | camelCase | `chores.ts`, `calendar.ts` |

## Code

| Context | Convention | Example |
|---------|-----------|---------|
| Types / Interfaces | PascalCase | `Chore`, `CreateChoreRequest` |
| Hooks | `use` + PascalCase | `useChores()`, `useDeleteChore()` |
| Endpoint constants | UPPER_SNAKE_CASE | `CHORES_ENDPOINTS`, `SHOPPING_ENDPOINTS` |
| Route plugins | camelCase + `Routes` | `shoppingRoutes`, `choresRoutes` |
| Database columns (Prisma) | camelCase | `choreName`, `addedBy` |
| API response fields | snake_case | `chore_name`, `added_by`, `created_at` |
| URL paths | kebab-case | `/api/shopping`, `/api/clear-completed` |

## API response mapping

The API always maps Prisma's camelCase fields to snake_case in responses:

```typescript
const response = {
  id: item.id,
  item_name: item.itemName,       // camelCase -> snake_case
  added_by: item.addedBy,
  created_at: formatIso(item.createdAt),
};
```
