# Remove Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully remove the shopping list feature — all routes, types, UI, tests, and the database table — leaving no dead references.

**Architecture:** Work layer by layer: delete the shopping files first, then scrub references in every file that imported or used them, update shared types, and finish with a Prisma migration to drop the table. Each task ends in a commit; the branch stays green throughout.

**Tech Stack:** Bun, Elysia, Prisma, PostgreSQL, React 19, TanStack Router, i18next

---

## File Map

| Action   | Path                                                       |
| -------- | ---------------------------------------------------------- |
| Delete   | `apps/api/src/routes/shopping/index.ts`                    |
| Delete   | `apps/api/test/shopping.test.ts`                           |
| Delete   | `apps/shared/src/types/shopping.ts`                        |
| Delete   | `apps/web/src/pages/shopping/` (whole directory)           |
| Delete   | `apps/web/src/lib/endpoints/shopping.ts`                   |
| Modify   | `apps/api/src/index.ts`                                    |
| Modify   | `apps/api/src/utils/activityLogs.ts`                       |
| Modify   | `apps/api/src/routes/analytics/index.ts`                   |
| Modify   | `apps/api/src/routes/admin/index.ts`                       |
| Modify   | `apps/api/src/routes/dashboard/stats/index.ts`             |
| Modify   | `apps/api/src/routes/dashboard/activities/index.ts`        |
| Modify   | `apps/api/src/routes/search/index.ts`                      |
| Modify   | `apps/shared/src/types/dashboard.ts`                       |
| Modify   | `apps/web/src/lib/endpoints/index.ts`                      |
| Modify   | `apps/web/src/lib/queryKeys.ts`                            |
| Modify   | `apps/web/src/lib/routing/navigation.ts`                   |
| Modify   | `apps/web/src/lib/routing/prefetch.ts`                     |
| Modify   | `apps/web/src/components/RouteDataRefetcher.tsx`           |
| Modify   | `apps/web/src/components/NotificationMenuRow.tsx`          |
| Modify   | `apps/web/src/components/QuickActionPalette.tsx`           |
| Modify   | `apps/web/src/pages/_component/HomePage.tsx`               |
| Modify   | `apps/web/src/pages/_component/GreetingCard.tsx`           |
| Modify   | `apps/web/src/pages/settings/_component/DataExportTab.tsx` |
| Modify   | `apps/web/src/pages/privacy.tsx`                           |
| Modify   | `apps/web/src/pages/settings/useAdmin.ts`                  |
| Modify   | `apps/web/src/test-utils/mocks.ts`                         |
| Modify   | `apps/web/src/locales/en/common.json`                      |
| Modify   | `apps/web/src/locales/fr/common.json`                      |
| Modify   | `apps/api/prisma/schema.prisma`                            |
| Generate | `apps/web/src/routeTree.gen.ts` (auto via `bun run dev`)   |

---

### Task 1: Delete shopping files

**Files:**

- Delete: `apps/api/src/routes/shopping/index.ts`
- Delete: `apps/api/test/shopping.test.ts`
- Delete: `apps/shared/src/types/shopping.ts`
- Delete: `apps/web/src/pages/shopping/` (directory)
- Delete: `apps/web/src/lib/endpoints/shopping.ts`

- [ ] **Step 1: Delete the files**

```bash
rm apps/api/src/routes/shopping/index.ts
rm apps/api/test/shopping.test.ts
rm apps/shared/src/types/shopping.ts
rm -rf apps/web/src/pages/shopping/
rm apps/web/src/lib/endpoints/shopping.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore(shopping): delete shopping route, types, page, and endpoint files"
```

---

### Task 2: Clean up API entry point and routes

**Files:**

- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/routes/analytics/index.ts`
- Modify: `apps/api/src/routes/admin/index.ts`
- Modify: `apps/api/src/routes/dashboard/stats/index.ts`
- Modify: `apps/api/src/routes/search/index.ts`

- [ ] **Step 1: Remove shoppingRoutes from `apps/api/src/index.ts`**

Remove the import line:

```typescript
import { shoppingRoutes } from "./routes/shopping";
```

And remove the usage:

```typescript
  .use(shoppingRoutes)
```

- [ ] **Step 2: Remove the `/shopping` analytics endpoint from `apps/api/src/routes/analytics/index.ts`**

Delete the entire block starting with the comment `// GET /api/analytics/shopping - Get shopping analytics` through its closing `.get("/shopping", ...)` brace (lines ~437–506).

- [ ] **Step 3: Remove shopping from the admin export/import in `apps/api/src/routes/admin/index.ts`**

In the export handler, remove:

```typescript
const allShoppingItems = await prisma.shoppingItem.findMany();
```

And remove from the return object:

```typescript
shopping_items: allShoppingItems.map((item) => ({
  ...item,
  added_by_email: item.addedBy ? idToEmail.get(item.addedBy) : null,
  completed_by_email: item.completedBy
    ? idToEmail.get(item.completedBy)
    : null,
})),
```

In the import body schema, remove:

```typescript
shopping_items: t.Optional(t.Array(t.Any())),
```

- [ ] **Step 4: Remove shoppingCount from `apps/api/src/routes/dashboard/stats/index.ts`**

Remove:

```typescript
const shoppingCount = await prisma.shoppingItem.count({
  where: {
    OR: [{ completed: false }, { completed: null }],
    deletedAt: null,
  },
});
```

And remove from the return object:

```typescript
shopping_count: shoppingCount,
```

- [ ] **Step 5: Remove shopping from `apps/api/src/routes/search/index.ts`**

Remove `shopping: []` from the default results object, remove the `prisma.shoppingItem.findMany(...)` call from the parallel queries (and its corresponding destructured variable), and remove the `shopping: shopping.map(...)` block from the return value.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/routes/analytics/index.ts apps/api/src/routes/admin/index.ts apps/api/src/routes/dashboard/stats/index.ts apps/api/src/routes/search/index.ts
git commit -m "chore(shopping): remove shopping from API routes and analytics"
```

---

### Task 3: Clean up activityLogs utility and dashboard activities

**Files:**

- Modify: `apps/api/src/utils/activityLogs.ts`
- Modify: `apps/api/src/routes/dashboard/activities/index.ts`

- [ ] **Step 1: Remove shopping from `apps/api/src/utils/activityLogs.ts`**

In the `ActivityType` union, remove all shopping variants:

```typescript
| "shopping_item_added"
| "shopping_item_completed"
| "shopping_item_toggled"
| "shopping_item_updated"
| "shopping_item_deleted"
| "shopping_bulk_deleted"
| "shopping_reordered"
| "shopping_list_cleared"
```

In the `task_type` union on `ActivityRecord`, change:

```typescript
task_type?: "chore" | "shopping";
```

to:

```typescript
task_type?: "chore";
```

Remove `shopping_item_id` from `ActivityRecord`:

```typescript
shopping_item_id?: number;
```

In the `getActivityType` switch, remove:

```typescript
case "shopping":
  return "shopping_completed";
```

In the `getActivityCategory` switch, remove:

```typescript
case "shopping":
  return "shopping";
```

Remove the routing shortcut:

```typescript
if (type.startsWith("shopping_")) return "shopping";
```

In `mapTaskCompletion`, change the type cast:

```typescript
task_type: completion.taskType as "chore" | "shopping",
```

to:

```typescript
task_type: completion.taskType as "chore",
```

Remove from `parseActivityPayload`:

```typescript
shopping_item_id: parseIntNumber(payload?.shopping_item_id),
item_name: parseString(payload?.item_name),
```

Only remove `shopping_item_id` — keep `item_name` if it is used by other activity types (verify before removing).

- [ ] **Step 2: Remove shopping from `apps/api/src/routes/dashboard/activities/index.ts`**

Remove `shopping_item_id` from the `ActivityRecord` type reference and remove `task_type: "chore" | "shopping"` → change to `task_type: "chore"` if this file has its own local type definition. Otherwise the fix from Step 1 propagates automatically.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/utils/activityLogs.ts apps/api/src/routes/dashboard/activities/index.ts
git commit -m "chore(shopping): remove shopping activity types and log entries"
```

---

### Task 4: Clean up shared types

**Files:**

- Modify: `apps/shared/src/types/dashboard.ts`

- [ ] **Step 1: Remove `shopping_count` from `DashboardStats` in `apps/shared/src/types/dashboard.ts`**

Remove:

```typescript
shopping_count: number;
```

Also remove shopping activity type variants from the `ActivityType` union (lines ~10–11, ~23–25):

```typescript
| "shopping_added"
| "shopping_completed"
| "shopping_item_added"
| "shopping_item_completed"
| "shopping_list_cleared"
```

Remove `shopping_item_id` from the activity payload type:

```typescript
shopping_item_id?: number;
```

Remove `"shopping"` from the `task_type` union:

```typescript
task_type?: "chore" | "shopping";
```

becomes:

```typescript
task_type?: "chore";
```

- [ ] **Step 2: Commit**

```bash
git add apps/shared/src/types/dashboard.ts
git commit -m "chore(shopping): remove shopping types from shared dashboard types"
```

---

### Task 5: Clean up web endpoints, query keys, and routing

**Files:**

- Modify: `apps/web/src/lib/endpoints/index.ts`
- Modify: `apps/web/src/lib/queryKeys.ts`
- Modify: `apps/web/src/lib/routing/navigation.ts`
- Modify: `apps/web/src/lib/routing/prefetch.ts`

- [ ] **Step 1: Remove shopping export from `apps/web/src/lib/endpoints/index.ts`**

Remove:

```typescript
export * from "./shopping";
```

- [ ] **Step 2: Remove shopping query keys from `apps/web/src/lib/queryKeys.ts`**

Remove the entire `shopping` block:

```typescript
shopping: {
  all: ["shopping"] as const,
  items: () => [...queryKeys.shopping.all, "items"] as const,
  syncStatus: () => [...queryKeys.shopping.all, "sync-status"] as const,
},
```

- [ ] **Step 3: Remove shopping from `apps/web/src/lib/routing/navigation.ts`**

Remove the nav entry:

```typescript
{
  path: "/shopping",
  translationKey: "nav.shopping",
  icon: ShoppingCart,
},
```

Remove the `ShoppingCart` import from `lucide-react` (only if it's not used elsewhere in this file).

- [ ] **Step 4: Remove shopping from `apps/web/src/lib/routing/prefetch.ts`**

Remove `SHOPPING_ENDPOINTS` from the import at the top of the file.

Remove the route query definition:

```typescript
"/shopping": () => [
  {
    queryKey: queryKeys.shopping.items(),
    queryFn: () => webFetcher(SHOPPING_ENDPOINTS.LIST),
  },
],
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/endpoints/index.ts apps/web/src/lib/queryKeys.ts apps/web/src/lib/routing/navigation.ts apps/web/src/lib/routing/prefetch.ts
git commit -m "chore(shopping): remove shopping from web endpoints, query keys, and routing"
```

---

### Task 6: Clean up shared web components

**Files:**

- Modify: `apps/web/src/components/RouteDataRefetcher.tsx`
- Modify: `apps/web/src/components/NotificationMenuRow.tsx`
- Modify: `apps/web/src/components/QuickActionPalette.tsx`

- [ ] **Step 1: Remove shopping case from `apps/web/src/components/RouteDataRefetcher.tsx`**

Remove:

```typescript
case "/shopping":
  // Shopping list
  await queryClient.refetchQueries({
    queryKey: queryKeys.shopping.all,
  });
  break;
```

- [ ] **Step 2: Remove shopping icon from `apps/web/src/components/NotificationMenuRow.tsx`**

Remove from the icon map object:

```typescript
shopping: {
  icon: <ShoppingCart size={16} />,
  bg: "bg-sky-100 dark:bg-sky-900/30",
},
```

Remove `ShoppingCart` from the `lucide-react` import if unused elsewhere.

- [ ] **Step 3: Remove shopping from `apps/web/src/components/QuickActionPalette.tsx`**

Remove `"shopping"` from the result type union:

```typescript
| "shopping"
```

Remove the destructured `shopping` variable from `searchQuery.data`:

```typescript
shopping = [],
```

Remove the `shoppingActions` block:

```typescript
const shoppingActions: QuickAction[] = shopping.map((item) => ({
  id: `shopping-${item.id}`,
  title: item.item_name,
  description: item.notes ?? t("shopping.title"),
  icon: item.completed ? (
    <CheckCircle size={20} />
  ) : (
    <ShoppingCart size={20} />
  ),
  section: "shopping" as const,
  action: () => {
    navigate({ to: "/shopping" });
    handleClose();
  },
}));
```

Remove `...shoppingActions,` from the `allActions` array.

Remove from the section labels object:

```typescript
shopping: t("shopping.title"),
```

Remove `ShoppingCart` from the `lucide-react` import if unused elsewhere.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/RouteDataRefetcher.tsx apps/web/src/components/NotificationMenuRow.tsx apps/web/src/components/QuickActionPalette.tsx
git commit -m "chore(shopping): remove shopping from shared web components"
```

---

### Task 7: Clean up pages — GreetingCard, HomePage, settings, privacy

**Files:**

- Modify: `apps/web/src/pages/_component/GreetingCard.tsx`
- Modify: `apps/web/src/pages/_component/HomePage.tsx`
- Modify: `apps/web/src/pages/settings/_component/DataExportTab.tsx`
- Modify: `apps/web/src/pages/privacy.tsx`
- Modify: `apps/web/src/pages/settings/useAdmin.ts`

- [ ] **Step 1: Remove `shoppingItems` from `GreetingCard.tsx`**

Remove from the `GreetingCardProps` interface:

```typescript
shoppingItems: number;
```

Remove from the internal context type:

```typescript
shoppingItems: number;
```

Remove from the destructured props:

```typescript
shoppingItems,
```

Remove from the context object:

```typescript
shoppingItems,
```

Remove the condition that references it:

```typescript
} else if (pendingChores === 0 && shoppingItems === 0) {
  subtext = t("dashboard.subtexts.allClear", { ... });
```

Replace with a simpler condition (e.g. just `pendingChores === 0`):

```typescript
} else if (pendingChores === 0) {
  subtext = t("dashboard.subtexts.allClear", {
    defaultValue: "Everything's in order. Nice work!",
  });
```

Remove:

```typescript
} else if (shoppingItems > 5) {
  subtext = t("dashboard.subtexts.shoppingNeeded", {
    defaultValue: "Shopping list is growing. Time to plan a trip?",
  });
```

Remove `shoppingItems` from the `useMemo` dependency array.

Remove `ShoppingCart` from the `lucide-react` import if unused.

- [ ] **Step 2: Remove shopping from `HomePage.tsx`**

In the stat card array, remove:

```typescript
{
  href: "/shopping" as const,
  icon: <ShoppingCart size={11} />,
  value: stats.shopping_count,
  label: t("dashboard.home.statsShopping", { count: stats.shopping_count }),
  color: "hover:text-blue-600 dark:hover:text-blue-400",
},
```

Remove `ShoppingCart` from the `lucide-react` import if unused.

Remove from the `GreetingCard` call:

```typescript
shoppingItems={stats?.shopping_count || 0}
```

- [ ] **Step 3: Remove shoppingItems from `DataExportTab.tsx`**

In the import summary translation call, remove `shoppingItems: counts.shopping_items` from the interpolation object passed to `t("settings.dataExport.importSummary", {...})`.

- [ ] **Step 4: Remove shopping from `privacy.tsx`**

Change:

```
chores, shopping, and reminders
```

to:

```
chores and reminders
```

Also update the user content list item to remove `shopping items,`.

- [ ] **Step 5: Remove shopping invalidation from `useAdmin.ts`**

Remove:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/_component/GreetingCard.tsx apps/web/src/pages/_component/HomePage.tsx apps/web/src/pages/settings/_component/DataExportTab.tsx apps/web/src/pages/privacy.tsx apps/web/src/pages/settings/useAdmin.ts
git commit -m "chore(shopping): remove shopping from pages and admin utilities"
```

---

### Task 8: Clean up test mocks and locales

**Files:**

- Modify: `apps/web/src/test-utils/mocks.ts`
- Modify: `apps/web/src/locales/en/common.json`
- Modify: `apps/web/src/locales/fr/common.json`

- [ ] **Step 1: Remove shopping mocks from `apps/web/src/test-utils/mocks.ts`**

Remove the `ShoppingItem` import from `@hously/shared` (or wherever it imports from).

Remove:

```typescript
export const mockShoppingItem: ShoppingItem = {
  id: 1,
  position: 1,
  item_name: "Milk",
  // ... rest of object
};
```

Remove `shopping_count: 5` from `mockDashboardStats` — replace with remaining fields only.

Remove the shopping activity mock:

```typescript
export const mockActivity: Activity = {
  description: "testuser added shopping item: Milk",
  time: "2 hours ago",
  icon: "🛒",
  type: "shopping_added",
};
```

Remove:

```typescript
export const mockShoppingItemCompletedActivity: Activity = {
  type: "shopping_item_completed",
  shopping_item_id: 1,
  item_name: "Milk",
  completed_at: "2024-01-01T00:00:00Z",
};
```

- [ ] **Step 2: Remove shopping keys from `apps/web/src/locales/en/common.json`**

Remove the top-level `"shopping"` namespace (the object starting at line ~419).

Remove from `nav`: `"shopping": "Shopping"`.

Remove from notification/activity types: `"shopping_completed"`, `"shopping_item_added"`, `"shopping_item_completed"`, `"shopping_list_cleared"`.

Remove from activity messages: `"shoppingItemAdded"`, `"shoppingItemCompleted"`, `"shoppingCleared"`.

Remove from dashboard subtexts: `"shoppingNeeded"`.

Remove from data export import summary: remove `{{shoppingItems}}` from the `importSummary` string and its label entry if present.

- [ ] **Step 3: Apply the same removals to `apps/web/src/locales/fr/common.json`**

Mirror the same key removals as Step 2 in the French locale file.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/test-utils/mocks.ts apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
git commit -m "chore(shopping): remove shopping from test mocks and locales"
```

---

### Task 9: Prisma schema — remove ShoppingItem model and User relations

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Remove `ShoppingItem` model from `apps/api/prisma/schema.prisma`**

Delete the entire model block (lines ~275–290):

```prisma
model ShoppingItem {
  id          Int       @id @default(autoincrement())
  // ... all fields
  @@map("shopping_items")
}
```

- [ ] **Step 2: Remove shopping relations from the `User` model**

Remove from the `User` model:

```prisma
shoppingItemsAdded     ShoppingItem[]       @relation("ShoppingItemAddedBy")
shoppingItemsCompleted ShoppingItem[]       @relation("ShoppingItemCompletedBy")
```

- [ ] **Step 3: Create the migration**

```bash
make migrate-dev
```

When prompted for a migration name, enter: `remove_shopping_items`

Expected: Prisma generates a migration file in `apps/api/prisma/migrations/` that drops the `shopping_items` table.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "chore(shopping): drop shopping_items table and remove Prisma model"
```

---

### Task 10: Verify and regenerate router

- [ ] **Step 1: Run type check**

```bash
make typecheck
```

Expected: zero errors. If errors remain, they point to a missed shopping reference — fix and re-run.

- [ ] **Step 2: Run lint**

```bash
make lint
```

Expected: zero errors or warnings related to shopping.

- [ ] **Step 3: Run tests**

```bash
make test
```

Expected: all tests pass. No shopping test files remain, so no shopping tests should appear.

- [ ] **Step 4: Start dev server to regenerate route tree**

```bash
make dev-web
```

TanStack Router will regenerate `apps/web/src/routeTree.gen.ts` on startup, removing the `/shopping` route. Verify in the browser that the shopping nav item is gone and the home page loads without errors.

- [ ] **Step 5: Commit the regenerated route tree**

```bash
git add apps/web/src/routeTree.gen.ts
git commit -m "chore(shopping): regenerate route tree after shopping route removal"
```
