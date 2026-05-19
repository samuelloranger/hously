# Widget Edit Mode Design

**Date:** 2026-05-19
**Status:** Approved

## Problem

Dashboard widgets have a fixed layout defined in the WIDGETS registry. Users cannot reorder them without editing source code. The GreetingCard lives above the grid as a full-width header, disconnected from the widget column layout.

## Goal

- Add an edit mode where users can reorder widgets using up/down arrow buttons
- Moving up at index 0 shifts the widget to the end of the previous column; moving down at the last position shifts it to the start of the next column
- Changes persist immediately to the server via `useUpdateAppSettings`
- GreetingCard moves inside the grid at column 1, position 0 (non-movable)
- Edit mode is toggled by a button inside the GreetingCard

## Data Model

### New type — `apps/shared/src/types/settings.ts`

```ts
export type WidgetLayout = [WidgetId[], WidgetId[], WidgetId[]];
```

Three ordered arrays — index 0 = column 1, index 1 = column 2, index 2 = column 3. Position in the array is the render order. Widget IDs not present in the layout (new widgets added after a user saved a layout) are appended to their registry-default column at the end.

`AppSettings` gains a new nullable field:

```ts
dashboard_widget_layout: WidgetLayout | null;
```

`null` means "use registry defaults." `UpdateAppSettingsRequest` gains:

```ts
dashboard_widget_layout?: WidgetLayout;
```

### Default derivation — `apps/shared/src/constants/widgets.ts`

```ts
export function getDefaultLayout(): WidgetLayout {
  return [1, 2, 3].map((col) =>
    WIDGETS.filter((w) => w.column === col)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((w) => w.id),
  ) as WidgetLayout;
}
```

Exported from shared so the API and web both use the same default.

## API Changes

### Prisma migration

New nullable JSON column on `AppSettings`:

```prisma
dashboardWidgetLayout Json? @map("dashboard_widget_layout")
```

### `mapSettings()` addition

```ts
dashboard_widget_layout: (row.dashboardWidgetLayout as WidgetLayout | null) ?? null,
```

### PATCH body schema addition

```ts
dashboard_widget_layout: t.Optional(
  t.Tuple([
    t.Array(t.String()),
    t.Array(t.String()),
    t.Array(t.String()),
  ])
),
```

### Update handler addition

```ts
if (body.dashboard_widget_layout !== undefined) {
  updateData.dashboardWidgetLayout = body.dashboard_widget_layout;
}
```

No new cache invalidation needed — existing `queryKeys.settings.all` invalidation in `useUpdateAppSettings` covers this.

## Frontend Changes

### GreetingCard in the grid

The full-width GreetingCard above the grid is removed. GreetingCard is rendered as the first child of column 1's `<motion.div>`, before `widgetColumns[0]`. It is never part of `WIDGETS`, never gated by visibility or admin flags, and cannot be moved.

GreetingCard receives two new props:

```ts
interface GreetingCardProps {
  // ...existing...
  isEditMode: boolean;
  onToggleEditMode: () => void;
}
```

A small button (pencil icon + "Edit layout" / "Done" label) appears inside the card's header and calls `onToggleEditMode`.

### New component — `WidgetEditWrapper`

**File:** `apps/web/src/pages/_component/WidgetEditWrapper.tsx`

A thin wrapper that renders its children with an overlay containing two icon buttons (ChevronUp / ChevronDown) positioned at the top-right corner of the widget. Props:

```ts
interface WidgetEditWrapperProps {
  children: React.ReactNode;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean; // false when first widget in first column
  canMoveDown: boolean; // false when last widget in last column
}
```

Disabled-state buttons are rendered with reduced opacity rather than hidden, so the layout doesn't shift.

### Layout state in `HomePage`

```tsx
const updateMut = useUpdateAppSettings();

const [layout, setLayout] = useState<WidgetLayout>(() =>
  getEffectiveLayout(data?.settings.dashboard_widget_layout ?? null),
);

useEffect(() => {
  setLayout(getEffectiveLayout(data?.settings.dashboard_widget_layout ?? null));
}, [data?.settings.dashboard_widget_layout]);
```

Where `getEffectiveLayout` handles new widgets not present in a stored layout by appending them to their registry-default column:

```ts
function getEffectiveLayout(stored: WidgetLayout | null): WidgetLayout {
  if (!stored) return getDefaultLayout();
  // Append any new widget IDs missing from stored layout
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

### `moveWidget` function

```ts
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
    // colIdx === 0 && pos === 0 → no-op
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
    // colIdx === 2 && last pos → no-op
  }

  setLayout(next);
  updateMut.mutate({ dashboard_widget_layout: next });
}
```

The local state updates immediately (optimistic). The server mutation fires in parallel. `useUpdateAppSettings` already invalidates `queryKeys.settings.all` on success, which re-syncs `data?.settings.dashboard_widget_layout`.

### Updated `widgetColumns` render loop

```tsx
const [isEditMode, setIsEditMode] = useState(false);

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
```

## File Map

| Status  | File                                                  | Change                                                                             |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Modify  | `apps/shared/src/types/settings.ts`                   | Add `WidgetLayout` type, update `AppSettings` + `UpdateAppSettingsRequest`         |
| Modify  | `apps/shared/src/constants/widgets.ts`                | Export `getDefaultLayout()`                                                        |
| Migrate | `apps/api/prisma/schema.prisma`                       | Add `dashboardWidgetLayout Json?`                                                  |
| Migrate | `apps/api/prisma/migrations/`                         | New migration file                                                                 |
| Modify  | `apps/api/src/routes/settings/index.ts`               | Add layout to `mapSettings()`, PATCH schema, update handler                        |
| Modify  | `apps/web/src/pages/_component/GreetingCard.tsx`      | Add `isEditMode` + `onToggleEditMode` props, render toggle button                  |
| Create  | `apps/web/src/pages/_component/WidgetEditWrapper.tsx` | Up/down overlay wrapper                                                            |
| Modify  | `apps/web/src/pages/_component/HomePage.tsx`          | Move GreetingCard inside grid, add layout state + `moveWidget`, update render loop |

## What Stays the Same

- `WIDGETS` registry — read-only source of defaults and metadata
- `dashboard_widget_visibility` — unchanged, visibility gating still applied after layout ordering
- All panel components — zero changes to internals
- `queryKeys`, `useUpdateAppSettings` — unchanged
- Admin gating logic — unchanged
