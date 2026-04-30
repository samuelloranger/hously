# Remove Shopping List Feature

**Date:** 2026-04-27
**Motivation:** Hously's core identity is a homelab command center. The shopping list is a personal life management feature that falls outside that scope and adds maintenance surface without contributing to the product's focus.

---

## Scope

Full removal of the shopping list feature: API routes, shared types, frontend pages and components, tests, navigation references, and database table.

---

## Files to Delete

| Path                                     | Reason                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/routes/shopping/index.ts`  | API route plugin                                        |
| `apps/api/test/shopping.test.ts`         | API integration tests                                   |
| `apps/shared/src/types/shopping.ts`      | Shared TypeScript types                                 |
| `apps/web/src/pages/shopping/`           | Entire page directory (index, components, hooks, tests) |
| `apps/web/src/lib/endpoints/shopping.ts` | Frontend endpoint constants                             |

---

## Files to Clean Up (references removed)

| Path                                                       | What to remove                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/api/src/index.ts`                                    | `import { shoppingRoutes }` and `.use(shoppingRoutes)`                         |
| `apps/shared/src/index.ts`                                 | Re-export of shopping types                                                    |
| `apps/web/src/lib/endpoints/index.ts`                      | Re-export of shopping endpoints                                                |
| `apps/web/src/lib/queryKeys.ts`                            | Shopping query key entry                                                       |
| `apps/web/src/lib/routing/navigation.ts`                   | Shopping nav entry                                                             |
| `apps/web/src/lib/routing/prefetch.ts`                     | Shopping route prefetch                                                        |
| `apps/web/src/components/RouteDataRefetcher.tsx`           | Shopping refetch logic                                                         |
| `apps/web/src/components/NotificationMenuRow.tsx`          | Shopping notification action                                                   |
| `apps/web/src/components/QuickActionPalette.tsx`           | Shopping quick action                                                          |
| `apps/web/src/pages/_component/HomePage.tsx`               | Shopping widget or shortcut                                                    |
| `apps/web/src/pages/_component/GreetingCard.tsx`           | Shopping reference                                                             |
| `apps/web/src/pages/settings/_component/DataExportTab.tsx` | Shopping export section                                                        |
| `apps/web/src/pages/privacy.tsx`                           | Shopping data mention                                                          |
| `apps/web/src/pages/settings/useAdmin.ts`                  | Shopping admin reset (if present)                                              |
| `apps/web/src/test-utils/mocks.ts`                         | Shopping mock data                                                             |
| `apps/web/src/routeTree.gen.ts`                            | Auto-regenerated — delete shopping route, then run `bun run dev` to regenerate |

---

## Database

Create a new Prisma migration that:

1. Drops the `shopping_items` table
2. Removes the `shoppingItemsAdded` and `shoppingItemsCompleted` relations from the `User` model in `schema.prisma`

Run with `make migrate-dev` to generate the migration file.

---

## Testing

- Run `make test` to confirm no remaining test references to shopping pass
- Run `make typecheck` to confirm no TypeScript errors
- Run `make lint` to confirm no dangling imports
- Start `make dev-web` and verify the shopping route is gone from navigation and no 404s appear on the home page

---

## Out of Scope

- No feature flags or deprecation notices — hard delete only
- No data export utility — this is a self-hosted personal instance
- No other personal life features are touched in this change
