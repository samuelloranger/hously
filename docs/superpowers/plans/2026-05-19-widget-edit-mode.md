# Widget Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an edit mode to the dashboard where users can reorder widgets via up/down arrows, with order persisted immediately to the server. GreetingCard moves inside the 3-column grid as a fixed first item in column 1.

**Architecture:** `WidgetLayout` is a 3-tuple of `WidgetId[]` stored as a nullable JSON column on `AppSettings`. The frontend holds local layout state (optimistic), fires `useUpdateAppSettings` on every arrow click, and wraps each widget in a `WidgetEditWrapper` overlay when in edit mode. GreetingCard hosts the edit toggle button and is rendered as a non-movable first child of column 1.

**Tech Stack:** Bun, Elysia, Prisma, React 19, TanStack Query, motion/react, lucide-react, TypeBox

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify | `apps/shared/src/constants/widgets.ts` | Add `WidgetLayout` type + `getDefaultLayout()` |
| Modify | `apps/shared/src/types/settings.ts` | Import `WidgetLayout`; add field to `AppSettings` + `UpdateAppSettingsRequest` |
| Modify | `apps/shared/src/__tests__/widgets.test.ts` | Add `getDefaultLayout()` tests |
| Modify | `apps/api/prisma/schema.prisma` | Add `dashboardWidgetLayout Json?` |
| Create | `apps/api/prisma/migrations/20260519000000_add_dashboard_widget_layout/migration.sql` | New migration |
| Modify | `apps/api/src/routes/settings/index.ts` | `mapSettings()`, PATCH schema, update handler |
| Modify | `apps/web/src/pages/_component/GreetingCard.tsx` | Add `isEditMode`/`onToggleEditMode` props + edit toggle button |
| Create | `apps/web/src/pages/_component/WidgetEditWrapper.tsx` | Up/down overlay wrapper |
| Modify | `apps/web/src/pages/_component/HomePage.tsx` | Layout state, `moveWidget()`, GreetingCard inside grid, updated render loop |

---

### Task 1: Shared types — WidgetLayout + getDefaultLayout()

**Files:**
- Modify: `apps/shared/src/constants/widgets.ts`
- Modify: `apps/shared/src/types/settings.ts`
- Modify: `apps/shared/src/__tests__/widgets.test.ts`

> Note: `WidgetLayout` is defined in `widgets.ts` (not `settings.ts` as the spec suggests) to avoid a circular import. `settings.ts` already imports from `widgets.ts`, so placing `WidgetLayout` there keeps the dependency one-directional.

- [ ] **Step 1: Write failing tests for getDefaultLayout()**

In `apps/shared/src/__tests__/widgets.test.ts`, add a new `describe` block after the existing ones:

```ts
import { describe, expect, it } from "bun:test";
import { WIDGETS, getDefaultLayout } from "../constants/widgets";

// ... existing describe("WIDGETS registry", ...) block stays ...

describe("getDefaultLayout", () => {
  it("returns a tuple of exactly 3 arrays", () => {
    const layout = getDefaultLayout();
    expect(layout).toHaveLength(3);
  });

  it("column 0 contains all widgets with column === 1, sorted by order", () => {
    const layout = getDefaultLayout();
    const expected = WIDGETS.filter((w) => w.column === 1)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
    expect(layout[0]).toEqual(expected);
  });

  it("column 1 contains all widgets with column === 2, sorted by order", () => {
    const layout = getDefaultLayout();
    const expected = WIDGETS.filter((w) => w.column === 2)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
    expect(layout[1]).toEqual(expected);
  });

  it("column 2 contains all widgets with column === 3, sorted by order", () => {
    const layout = getDefaultLayout();
    const expected = WIDGETS.filter((w) => w.column === 3)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id);
    expect(layout[2]).toEqual(expected);
  });

  it("contains every widget ID exactly once across all columns", () => {
    const layout = getDefaultLayout();
    const all = layout.flat();
    expect(all).toHaveLength(WIDGETS.length);
    expect(new Set(all).size).toBe(WIDGETS.length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/shared && bun test src/__tests__/widgets.test.ts
```

Expected: `FAIL` — `getDefaultLayout is not a function`

- [ ] **Step 3: Add WidgetLayout type and getDefaultLayout() to widgets.ts**

In `apps/shared/src/constants/widgets.ts`, append after the existing type exports:

```ts
export type WidgetLayout = [WidgetId[], WidgetId[], WidgetId[]];

export function getDefaultLayout(): WidgetLayout {
  return [1, 2, 3].map((col) =>
    WIDGETS.filter((w) => w.column === col)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id),
  ) as WidgetLayout;
}
```

- [ ] **Step 4: Update settings.ts to include WidgetLayout in AppSettings and UpdateAppSettingsRequest**

In `apps/shared/src/types/settings.ts`, update the import at the top to include `WidgetLayout`:

```ts
import type { WidgetVisibility, WidgetLayout } from "../constants/widgets";
```

Then add `dashboard_widget_layout: WidgetLayout | null;` to `AppSettings`:

```ts
export interface AppSettings {
  country_code: string;
  calendar_subdivision_code: string | null;
  upcoming_window_months: number;
  upcoming_languages: string;
  dashboard_widget_visibility: DashboardWidgetVisibility;
  dashboard_widget_layout: WidgetLayout | null;
  quick_links: QuickLink[];
  updated_at: string;
}
```

And `dashboard_widget_layout?: WidgetLayout;` to `UpdateAppSettingsRequest`:

```ts
export interface UpdateAppSettingsRequest {
  country_code?: string;
  calendar_subdivision_code?: string | null;
  upcoming_window_months?: number;
  upcoming_languages?: string;
  dashboard_widget_visibility?: DashboardWidgetVisibility;
  dashboard_widget_layout?: WidgetLayout;
}
```

Also re-export `WidgetLayout` from `apps/shared/src/types/index.ts` if it isn't already (check the file — if it has `export * from "./settings"` it's covered automatically).

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/shared && bun test src/__tests__/widgets.test.ts
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/shared/src/constants/widgets.ts apps/shared/src/types/settings.ts apps/shared/src/__tests__/widgets.test.ts
git commit -m "feat(shared): add WidgetLayout type and getDefaultLayout()"
```

---

### Task 2: Prisma migration — add dashboardWidgetLayout column

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260519000000_add_dashboard_widget_layout/migration.sql`

- [ ] **Step 1: Add field to schema.prisma**

In `apps/api/prisma/schema.prisma`, inside the `AppSettings` model, add after `dashboardWidgetVisibility`:

```prisma
dashboardWidgetLayout    Json?    @map("dashboard_widget_layout")
```

The AppSettings model should look like:

```prisma
model AppSettings {
  id                         Int      @id @default(1)
  countryCode                String   @default("US") @map("country_code") @db.VarChar(2)
  calendarSubdivisionCode    String?  @map("calendar_subdivision_code") @db.VarChar(16)
  upcomingWindowMonths       Int      @default(12) @map("upcoming_window_months")
  upcomingLanguages          String   @default("en,fr") @map("upcoming_languages")
  dashboardWidgetVisibility  Json     @default("{...}") @map("dashboard_widget_visibility")
  dashboardWidgetLayout      Json?    @map("dashboard_widget_layout")
  quickLinks                 Json     @default("[]") @map("quick_links")
  updatedAt                  DateTime @updatedAt @map("updated_at")

  @@map("app_settings")
}
```

- [ ] **Step 2: Run migration**

```bash
make migrate-dev
```

When prompted for a name, enter: `add_dashboard_widget_layout`

Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 3: Verify migration file was created**

```bash
ls apps/api/prisma/migrations/ | grep dashboard
```

Expected: `20260519000000_add_dashboard_widget_layout` directory

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add dashboard_widget_layout nullable JSON column to app_settings"
```

---

### Task 3: API settings route — layout in mapSettings, PATCH schema, update handler

**Files:**
- Modify: `apps/api/src/routes/settings/index.ts`

- [ ] **Step 1: Update the import to include WidgetLayout**

In `apps/api/src/routes/settings/index.ts`, update the import from `@hously/shared/constants` to include `WidgetLayout`:

```ts
import { WIDGETS, type WidgetId, type WidgetLayout } from "@hously/shared/constants";
```

- [ ] **Step 2: Add dashboard_widget_layout to mapSettings()**

In the `mapSettings()` function, add after the `dashboard_widget_visibility` line:

```ts
dashboard_widget_layout: (row.dashboardWidgetLayout as WidgetLayout | null) ?? null,
```

The full `mapSettings` should now include:

```ts
function mapSettings(row: AppSettingsRow) {
  return {
    // ...existing fields...
    dashboard_widget_visibility: {
      ...DEFAULT_WIDGET_VISIBILITY,
      ...(row.dashboardWidgetVisibility ?? {}),
    } as WidgetVisibility,
    dashboard_widget_layout: (row.dashboardWidgetLayout as WidgetLayout | null) ?? null,
    quick_links: (row.quickLinks ?? []) as QuickLink[],
    updated_at: row.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 3: Add dashboard_widget_layout to the PATCH body schema**

In the Elysia route body schema for the PATCH handler, add:

```ts
dashboard_widget_layout: t.Optional(
  t.Tuple([
    t.Array(t.String()),
    t.Array(t.String()),
    t.Array(t.String()),
  ]),
),
```

- [ ] **Step 4: Add dashboard_widget_layout to the update handler**

In the PATCH handler, add the conditional update for layout alongside the other fields:

```ts
if (body.dashboard_widget_layout !== undefined) {
  updateData.dashboardWidgetLayout = body.dashboard_widget_layout;
}
```

- [ ] **Step 5: Run the full test suite**

```bash
make test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/settings/index.ts
git commit -m "feat(api): add dashboard_widget_layout to settings route"
```

---

### Task 4: GreetingCard — add edit mode toggle button

**Files:**
- Modify: `apps/web/src/pages/_component/GreetingCard.tsx`

- [ ] **Step 1: Add isEditMode and onToggleEditMode props to the interface**

In `apps/web/src/pages/_component/GreetingCard.tsx`, update the interface:

```ts
interface GreetingCardProps {
  userName: string;
  pendingChores: number | undefined;
  eventsToday: number | undefined;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}
```

Update the function signature to destructure the new props:

```ts
export function GreetingCard({ userName, pendingChores, eventsToday, isEditMode, onToggleEditMode }: GreetingCardProps) {
```

- [ ] **Step 2: Add the Pencil import from lucide-react**

Add `Pencil` to the lucide-react import at the top of the file:

```ts
import { Pencil } from "lucide-react";
```

- [ ] **Step 3: Add the edit toggle button to the return JSX**

The current return renders a `<div>` with `<h1>` and `<p>`. Wrap the content in a relative container and add the toggle button:

```tsx
return (
  <div className="relative">
    <h1 className="text-lg md:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
      {greeting}, {userName}
    </h1>
    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{subtext}</p>
    <button
      type="button"
      onClick={onToggleEditMode}
      className="absolute top-0 right-0 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      <Pencil size={11} />
      {isEditMode ? "Done" : "Edit layout"}
    </button>
  </div>
);
```

- [ ] **Step 4: Run typecheck to verify no errors**

```bash
make typecheck
```

Expected: TypeScript error in `HomePage.tsx` because it now passes GreetingCard without the new required props. This is expected — it will be fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/_component/GreetingCard.tsx
git commit -m "feat(web): add edit mode toggle button to GreetingCard"
```

---

### Task 5: WidgetEditWrapper — up/down overlay component

**Files:**
- Create: `apps/web/src/pages/_component/WidgetEditWrapper.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/pages/_component/WidgetEditWrapper.tsx`:

```tsx
import { ChevronUp, ChevronDown } from "lucide-react";

interface WidgetEditWrapperProps {
  children: React.ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function WidgetEditWrapper({
  children,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: WidgetEditWrapperProps) {
  return (
    <div className="relative">
      {children}
      <div className="absolute top-2 right-2 flex flex-col gap-0.5 z-10">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="flex items-center justify-center w-6 h-6 rounded bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 shadow-sm transition-opacity disabled:opacity-30"
          aria-label="Move widget up"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="flex items-center justify-center w-6 h-6 rounded bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 shadow-sm transition-opacity disabled:opacity-30"
          aria-label="Move widget down"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/_component/WidgetEditWrapper.tsx
git commit -m "feat(web): add WidgetEditWrapper overlay component"
```

---

### Task 6: HomePage — layout state, moveWidget, GreetingCard inside grid

**Files:**
- Modify: `apps/web/src/pages/_component/HomePage.tsx`

This is the largest change. Read the current file before editing.

- [ ] **Step 1: Update imports**

Replace the current imports at the top of `apps/web/src/pages/_component/HomePage.tsx` with:

```tsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { CalendarDays, CheckSquare2, Flame } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { PageLayout } from "@/components/PageLayout";
import { CardErrorBoundary } from "@/components/ErrorBoundary";
import { useCurrentUser } from "@/lib/auth/useAuth";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import type { DashboardStats } from "@hously/shared/types";
import { getUserFirstName } from "@/lib/utils/format";
import { GreetingCard } from "@/pages/_component/GreetingCard";
import { WidgetEditWrapper } from "@/pages/_component/WidgetEditWrapper";
import { WIDGETS, getDefaultLayout } from "@hously/shared/constants";
import type { WidgetVisibility, WidgetLayout } from "@hously/shared/constants";
import { useAppSettings, useUpdateAppSettings } from "@/pages/settings/useAppSettings";
import { WIDGET_COMPONENTS } from "@/pages/_component/widgetComponents";
```

- [ ] **Step 2: Add getEffectiveLayout helper function**

Add this function after the motion variants (before `StatsRow`):

```ts
function getEffectiveLayout(stored: WidgetLayout | null): WidgetLayout {
  if (!stored) return getDefaultLayout();
  const allStored = new Set(stored.flat());
  const result = stored.map((col) => [...col]) as WidgetLayout;
  WIDGETS.forEach((w) => {
    if (!allStored.has(w.id)) {
      result[w.column - 1].push(w.id);
    }
  });
  return result;
}
```

- [ ] **Step 3: Rewrite the HomePage function body**

Replace the entire `HomePage` function body (everything from `const { t }` through the `return`) with:

```tsx
export function HomePage() {
  const { t } = useTranslation("common");
  const { data: user } = useCurrentUser();
  const { data: statsData, isPending: statsLoading } = useDashboardStats();
  const stats = statsData?.stats;

  const { data } = useAppSettings();
  const updateMut = useUpdateAppSettings();
  const visibility =
    data?.settings.dashboard_widget_visibility ?? ({} as WidgetVisibility);
  const isAdmin = !!user?.is_admin;

  const [isEditMode, setIsEditMode] = useState(false);

  const [layout, setLayout] = useState<WidgetLayout>(() =>
    getEffectiveLayout(data?.settings.dashboard_widget_layout ?? null),
  );

  useEffect(() => {
    setLayout(getEffectiveLayout(data?.settings.dashboard_widget_layout ?? null));
  }, [data?.settings.dashboard_widget_layout]);

  function moveWidget(id: WidgetId, direction: "up" | "down") {
    const next = layout.map((col) => [...col]) as WidgetLayout;
    const colIdx = next.findIndex((col) => col.includes(id));
    const pos = next[colIdx].indexOf(id);

    if (direction === "up") {
      if (pos > 0) {
        [next[colIdx][pos - 1], next[colIdx][pos]] = [
          next[colIdx][pos],
          next[colIdx][pos - 1],
        ];
      } else if (colIdx > 0) {
        next[colIdx].splice(pos, 1);
        next[colIdx - 1].push(id);
      }
    } else {
      if (pos < next[colIdx].length - 1) {
        [next[colIdx][pos + 1], next[colIdx][pos]] = [
          next[colIdx][pos],
          next[colIdx][pos + 1],
        ];
      } else if (colIdx < 2) {
        next[colIdx].splice(pos, 1);
        next[colIdx + 1].unshift(id);
      }
    }

    setLayout(next);
    updateMut.mutate({ dashboard_widget_layout: next });
  }

  const widgetColumns = layout.map((col, colIdx) =>
    col
      .filter((id) => {
        const w = WIDGETS.find((w) => w.id === id)!;
        return (!w.adminOnly || isAdmin) && visibility[id] !== false;
      })
      .map((id, idx, arr) => {
        const Component = WIDGET_COMPONENTS[id];
        const isFirst = colIdx === 0 && idx === 0;
        const isLast = colIdx === 2 && idx === arr.length - 1;
        return (
          <motion.div key={id} variants={panelVariants}>
            <CardErrorBoundary>
              {isEditMode ? (
                <WidgetEditWrapper
                  onMoveUp={() => moveWidget(id, "up")}
                  onMoveDown={() => moveWidget(id, "down")}
                  canMoveUp={!isFirst}
                  canMoveDown={!isLast}
                >
                  <Component />
                </WidgetEditWrapper>
              ) : (
                <Component />
              )}
            </CardErrorBoundary>
          </motion.div>
        );
      }),
  );

  return (
    <PageLayout fullWidth>
      <div className="space-y-4">
        {/* 3-column widget layout:
            <768px  → single column
            768–999px → 2 columns (col1 left, col2+col3 stacked right)
            1000px+ → 3 equal columns */}
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          {/* Column 1 — GreetingCard always first, non-movable */}
          <motion.div
            className="flex flex-col gap-4 flex-1 min-w-0"
            variants={columnVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={panelVariants}>
              <GreetingCard
                userName={getUserFirstName(user, t("dashboard.user"))}
                pendingChores={stats?.chores_count}
                eventsToday={stats?.events_today}
                isEditMode={isEditMode}
                onToggleEditMode={() => setIsEditMode((v) => !v)}
              />
              <StatsRow stats={stats} isLoading={statsLoading} />
            </motion.div>
            {widgetColumns[0]}
          </motion.div>

          {/* Columns 2 + 3: stacked at 768–999px, side-by-side at 1000px+ */}
          <div className="flex flex-col min-[1000px]:flex-row gap-4 [flex:2_1_0%] min-w-0">
            {/* Column 2 */}
            <motion.div
              className="flex flex-col gap-4 flex-1 min-w-0"
              variants={columnVariants}
              initial="hidden"
              animate="show"
            >
              {widgetColumns[1]}
            </motion.div>

            {/* Column 3 */}
            <motion.div
              className="flex flex-col gap-4 flex-1 min-w-0"
              variants={columnVariants}
              initial="hidden"
              animate="show"
            >
              {widgetColumns[2]}
            </motion.div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
```

Note: `WidgetId` is needed for the `moveWidget` parameter type. Add it to the import from `@hously/shared/constants`:
```ts
import type { WidgetVisibility, WidgetLayout, WidgetId } from "@hously/shared/constants";
```

- [ ] **Step 4: Run typecheck**

```bash
make typecheck
```

Expected: No errors.

- [ ] **Step 5: Run the full test suite**

```bash
make test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/_component/HomePage.tsx
git commit -m "feat(web): dashboard edit mode — layout state, moveWidget, GreetingCard in grid"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run all checks**

```bash
make typecheck && make test && make lint
```

Expected: All pass with no errors or warnings.

- [ ] **Step 2: Start the dev server and manually verify**

```bash
make dev-api &
make dev-web
```

Open the dashboard. Verify:
- GreetingCard appears at the top of column 1
- "Edit layout" button is visible in the GreetingCard
- Clicking "Edit layout" shows up/down arrow overlays on every widget
- The label changes to "Done"
- Clicking an up arrow moves the widget up in the column (or to end of previous column if at index 0)
- Clicking a down arrow moves the widget down (or to start of next column if at last position)
- The first widget in column 1 has a disabled up arrow (opacity-30); the last widget in column 3 has a disabled down arrow
- Refreshing the page preserves the order
- Clicking "Done" hides the overlays

- [ ] **Step 3: Commit any lint/typecheck fixes if needed**

```bash
git add -p
git commit -m "fix(web): address lint/typecheck issues in widget edit mode"
```
