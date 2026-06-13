---
description: Naming conventions across the monorepo
globs: ["apps/**/*.ts", "apps/**/*.tsx", "apps/api/prisma/**"]
---

# Naming Conventions

## Files

| Context             | Convention                  | Example                                                  |
| ------------------- | --------------------------- | -------------------------------------------------------- |
| React components    | PascalCase                  | `LibraryItemRow.tsx`, `AddToLibraryModal.tsx`            |
| Hooks               | camelCase with `use` prefix | `useLibrary.ts`, `useAuth.ts`                            |
| Utilities           | camelCase                   | `formatDate.ts`, `sanitize.ts`                           |
| Route modules (API) | camelCase + `Routes`        | `notificationsRoutes` in `routes/notifications/index.ts` |
| Type files          | camelCase                   | `library.ts`, `notification.ts`                          |

## Code

| Context                   | Convention           | Example                                           |
| ------------------------- | -------------------- | ------------------------------------------------- |
| Types / Interfaces        | PascalCase           | `LibraryMedia`, `LibraryListResponse`             |
| Hooks                     | `use` + PascalCase   | `useLibrary()`, `useLibraryItem()`                |
| Endpoint constants        | UPPER_SNAKE_CASE     | `LIBRARY_ENDPOINTS`, `NOTIFICATIONS_ENDPOINTS`    |
| Route plugins             | camelCase + `Routes` | `libraryRoutes`, `notificationsRoutes`            |
| Database columns (Prisma) | camelCase            | `posterUrl`, `addedAt`                            |
| API response fields       | snake_case           | `poster_url`, `added_at`, `created_at`            |
| URL paths                 | kebab-case           | `/api/quality-profiles`, `/api/library/downloads` |

## API response mapping

The API always maps Prisma's camelCase fields to snake_case in responses:

```typescript
const response = {
  id: item.id,
  item_name: item.itemName, // camelCase -> snake_case
  added_by: item.addedBy,
  created_at: formatIso(item.createdAt),
};
```
