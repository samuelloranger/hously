# Widget Registry Design

**Date:** 2026-05-19
**Status:** Approved

## Problem

The dashboard and its settings are disconnected in three ways:

1. `DashboardWidgetVisibility` only tracks 6 widgets but 13+ panels render on the dashboard — the 3 new widgets (QuickLinks, JellyfinRandom, FocusTimer) have no visibility toggle at all.
2. Visibility flags exist in AppSettings but are never read at render time — all panels render unconditionally regardless of user preferences.
3. Adding a new widget requires manual, error-prone changes in 3+ places: the shared type, the API default, the Elysia schema, and the React component tree.

## Goal

A single source of truth (`WIDGETS` registry in `apps/shared`) from which the API schema, frontend render loop, and settings UI all derive — type-safe end-to-end.

Secondary goal: lay the groundwork for future per-user widget ordering and visibility customisation.

## Approach

Flat `as const` array in shared with derived TypeScript types. No registry class, no framework imports in shared.

## Design

### 1. Shared Registry

**File:** `apps/shared/src/constants/widgets.ts`

```ts
export const WIDGETS = [
  {
    id: "weather",
    column: 1,
    order: 0,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "quick_links",
    column: 1,
    order: 1,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "chores", column: 1, order: 2, defaultVisible: true, adminOnly: false },
  {
    id: "jellyfin_shelf",
    column: 1,
    order: 3,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "library_stats",
    column: 1,
    order: 4,
    defaultVisible: true,
    adminOnly: true,
  },
  {
    id: "library_alerts",
    column: 1,
    order: 5,
    defaultVisible: true,
    adminOnly: true,
  },
  {
    id: "homeassistant",
    column: 2,
    order: 0,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "habits", column: 2, order: 1, defaultVisible: true, adminOnly: false },
  {
    id: "upcoming",
    column: 2,
    order: 2,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "trackers",
    column: 2,
    order: 3,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "jellyfin_random",
    column: 2,
    order: 4,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "system", column: 3, order: 0, defaultVisible: true, adminOnly: false },
  {
    id: "focus_timer",
    column: 3,
    order: 1,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "downloads",
    column: 3,
    order: 2,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "minecraft_compact",
    column: 3,
    order: 3,
    defaultVisible: true,
    adminOnly: false,
  },
  {
    id: "minecraft_cards",
    column: 3,
    order: 4,
    defaultVisible: true,
    adminOnly: false,
  },
  { id: "rss", column: 3, order: 5, defaultVisible: true, adminOnly: false },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
export type WidgetVisibility = Record<WidgetId, boolean>;
export type WidgetMeta = (typeof WIDGETS)[number];
```

Labels are never stored in the registry. The web derives them as `t(`widgets.${widget.id}`)` at render time. New widgets get a label automatically once translation keys are added.

`DashboardWidgetVisibility` in `apps/shared/src/types/settings.ts` becomes a type alias for `WidgetVisibility`.

The new export path must be added to `apps/shared/src/index.ts` (or `package.json#exports`).

### 2. API Integration

**File:** `apps/api/src/routes/settings/index.ts`

Replace the hardcoded `DEFAULT_WIDGET_VISIBILITY` object and Elysia `t.Object` schema with derivations from the registry:

```ts
import { WIDGETS, WidgetId } from "@hously/shared/constants/widgets";

export const DEFAULT_WIDGET_VISIBILITY = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w.defaultVisible]),
) as Record<WidgetId, boolean>;

export const widgetVisibilitySchema = t.Object(
  Object.fromEntries(WIDGETS.map((w) => [w.id, t.Optional(t.Boolean())])),
);
```

The Prisma column (`dashboardWidgetVisibility`) remains a JSON blob — no migration needed. The existing `mapSettings()` merge-with-defaults pattern handles rows that predate new widget IDs gracefully.

### 3. Web — Component Map

**File:** `apps/web/src/pages/_component/widgetComponents.tsx` _(new)_

```ts
import { WidgetId } from "@hously/shared/constants/widgets";

export const WIDGET_COMPONENTS: Record<WidgetId, React.ComponentType> = {
  weather: WeatherPanel,
  quick_links: QuickLinksPanel,
  chores: ChoresPanel,
  jellyfin_shelf: JellyfinShelf,
  library_stats: LibraryStatsPanel,
  library_alerts: LibraryAttentionPanel,
  homeassistant: HomeAssistantPanel,
  habits: HabitsPanel,
  upcoming: UpcomingShelf,
  trackers: TrackersPanel,
  jellyfin_random: JellyfinRandomPanel,
  system: SystemPanel,
  focus_timer: FocusTimerPanel,
  downloads: DownloadsPanel,
  minecraft_compact: MinecraftCompactPanel,
  minecraft_cards: MinecraftCardsPanel,
  rss: RssStatusPanel,
};
```

`Record<WidgetId, ...>` is exhaustive — TypeScript errors if a widget ID in the registry is missing from this map.

### 4. Web — HomePage Render Loop

**File:** `apps/web/src/pages/_component/HomePage.tsx`

Replace the hardcoded per-panel JSX with a data-driven loop. `isAdmin` is sourced from the existing `useAuth()` hook (already used in `HomePage` to gate `LibraryAttentionPanel` and `RssStatusPanel`):

```tsx
const { data: settings } = useAppSettings();
const { isAdmin } = useAuth();
const visibility = settings?.dashboard_widget_visibility ?? {};

const columns = [1, 2, 3].map((col) =>
  WIDGETS.filter((w) => w.column === col)
    .sort((a, b) => a.order - b.order)
    .filter((w) => !w.adminOnly || isAdmin)
    .filter((w) => visibility[w.id] !== false)
    .map((w) => {
      const Component = WIDGET_COMPONENTS[w.id];
      return <Component key={w.id} />;
    }),
);
```

`visibility[w.id] !== false` ensures a widget renders when its key is absent from an old settings row — matching existing graceful-default behaviour.

### 5. Web — Settings UI

**File:** `apps/web/src/pages/settings/_component/GeneralSettingsTab.tsx`

Replace the hardcoded widget checkbox list with an iteration over `WIDGETS`. Each label resolves via `t(`widgets.${w.id}`)`.

### 6. i18n

17 new translation keys required in both EN (`apps/web/src/locales/en.json`) and FR (`apps/web/src/locales/fr.json`) under a `widgets` namespace:

```
widgets.weather, widgets.quick_links, widgets.chores, widgets.jellyfin_shelf,
widgets.library_stats, widgets.library_alerts, widgets.homeassistant, widgets.habits,
widgets.upcoming, widgets.trackers, widgets.jellyfin_random, widgets.system,
widgets.focus_timer, widgets.downloads, widgets.minecraft_compact,
widgets.minecraft_cards, widgets.rss
```

## What Changes / What Stays the Same

|                    |                                                                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New files**      | `apps/shared/src/constants/widgets.ts`, `apps/web/src/pages/_component/widgetComponents.tsx`                                                                                                          |
| **Modified files** | `settings.ts` (type alias), `routes/settings/index.ts` (derived schema/defaults), `HomePage.tsx` (render loop), `GeneralSettingsTab.tsx` (derived list), EN/FR locale files (17 keys), shared exports |
| **Unchanged**      | Prisma schema, `mapSettings()`, all panel components, `useAppSettings`, `useUpdateAppSettings`, `queryKeys`                                                                                           |

## Future

The `column` and `order` fields on each widget are designed to support per-user ordering. When that feature is built, the registry values become the fallback defaults and user preferences override them at render time.
