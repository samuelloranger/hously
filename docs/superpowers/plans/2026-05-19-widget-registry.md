# Widget Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered, hand-maintained widget definitions with a single `WIDGETS` registry in `apps/shared` from which the API schema, frontend render loop, and settings UI all derive — closing the gap between dashboard widget settings and actual dashboard rendering.

**Architecture:** A `WIDGETS` `as const` array in `apps/shared/src/constants/widgets.ts` carries the authoritative list of widget IDs, column assignments, render orders, visibility defaults, and admin-only flags. The API route derives `DEFAULT_WIDGET_VISIBILITY` and its Elysia validation schema from that array. The web adds a `WIDGET_COMPONENTS` map (type-checked exhaustive via `Record<WidgetId, ComponentType>`) and rewrites `HomePage` to render widgets by iterating the registry filtered by column, order, and visibility.

**Tech Stack:** TypeScript `as const` + mapped types, Elysia/TypeBox (`t.Object`/`t.Boolean`), React 19, react-i18next, TanStack Query, Bun test.

---

## File Map

| Status | File                                                            | Change                                                         |
| ------ | --------------------------------------------------------------- | -------------------------------------------------------------- |
| Create | `apps/shared/src/constants/widgets.ts`                          | The registry — WIDGETS array + derived types                   |
| Modify | `apps/shared/src/constants/index.ts`                            | Re-export from widgets.ts                                      |
| Modify | `apps/shared/src/types/settings.ts`                             | Replace `DashboardWidgetVisibility` interface with type alias  |
| Create | `apps/shared/src/__tests__/widgets.test.ts`                     | Registry integrity tests                                       |
| Modify | `apps/api/src/routes/settings/index.ts`                         | Derive DEFAULT_WIDGET_VISIBILITY + Elysia schema from registry |
| Modify | `apps/web/src/locales/en/common.json`                           | Add `widgets` key with 17 EN labels                            |
| Modify | `apps/web/src/locales/fr/common.json`                           | Add `widgets` key with 17 FR labels                            |
| Create | `apps/web/src/pages/_component/widgetComponents.tsx`            | Exhaustive WidgetId → ComponentType map                        |
| Modify | `apps/web/src/pages/_component/HomePage.tsx`                    | Replace hardcoded panel JSX with data-driven render loop       |
| Modify | `apps/web/src/pages/settings/_component/GeneralSettingsTab.tsx` | Replace hardcoded widget list with registry iteration          |

---

## Task 1: Create the shared widget registry

**Files:**

- Create: `apps/shared/src/constants/widgets.ts`
- Modify: `apps/shared/src/constants/index.ts`
- Modify: `apps/shared/src/types/settings.ts`
- Create: `apps/shared/src/__tests__/widgets.test.ts`

- [ ] **Step 1: Write the failing registry integrity test**

Create `apps/shared/src/__tests__/widgets.test.ts`:

```ts
import { describe, expect, it } from "bun:test";
import { WIDGETS } from "../constants/widgets";

describe("WIDGETS registry", () => {
  it("contains exactly 17 widgets", () => {
    expect(WIDGETS.length).toBe(17);
  });

  it("has no duplicate IDs", () => {
    const ids = WIDGETS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate column+order pairs", () => {
    const keys = WIDGETS.map((w) => `${w.column}:${w.order}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("assigns all widgets to column 1, 2, or 3", () => {
    for (const w of WIDGETS) {
      expect([1, 2, 3]).toContain(w.column);
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd apps/shared && bun test src/__tests__/widgets.test.ts
```

Expected: error — `Cannot find module '../constants/widgets'`

- [ ] **Step 3: Create the registry file**

Create `apps/shared/src/constants/widgets.ts`:

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

- [ ] **Step 4: Export from the constants barrel**

Edit `apps/shared/src/constants/index.ts` — append the new export:

```ts
export * from "./qbittorrent";
export * from "./widgets";
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
cd apps/shared && bun test src/__tests__/widgets.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 6: Replace DashboardWidgetVisibility with a type alias**

In `apps/shared/src/types/settings.ts`, replace the `DashboardWidgetVisibility` interface with a type alias. The file currently reads:

```ts
export interface DashboardWidgetVisibility {
  weather: boolean;
  homeassistant: boolean;
  system: boolean;
  downloads: boolean;
  rss: boolean;
  minecraft: boolean;
}
```

Replace it with:

```ts
import type { WidgetVisibility } from "../constants/widgets";

export type DashboardWidgetVisibility = WidgetVisibility;
```

Keep all other exports (`QuickLink`, `AppSettings`, `AppSettingsResponse`, `UpdateAppSettingsRequest`) unchanged.

- [ ] **Step 7: Typecheck shared**

```bash
cd apps/shared && bun run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/shared/src/constants/widgets.ts \
        apps/shared/src/constants/index.ts \
        apps/shared/src/types/settings.ts \
        apps/shared/src/__tests__/widgets.test.ts
git commit -m "feat(shared): add WIDGETS registry with derived WidgetId and WidgetVisibility types"
```

---

## Task 2: Update the API settings route

**Files:**

- Modify: `apps/api/src/routes/settings/index.ts`

- [ ] **Step 1: Update the imports**

At the top of `apps/api/src/routes/settings/index.ts`, add the import for WIDGETS after the existing imports:

```ts
import { WIDGETS } from "@hously/shared/constants";
import type { WidgetId } from "@hously/shared/constants";
```

- [ ] **Step 2: Replace DEFAULT_WIDGET_VISIBILITY**

Find and delete this block:

```ts
const DEFAULT_WIDGET_VISIBILITY = {
  weather: true,
  homeassistant: true,
  system: true,
  downloads: true,
  rss: true,
  minecraft: true,
};
```

Replace it with:

```ts
const DEFAULT_WIDGET_VISIBILITY = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w.defaultVisible]),
) as Record<WidgetId, boolean>;
```

- [ ] **Step 3: Replace the hardcoded Elysia widget schema**

Find and replace the `dashboard_widget_visibility` body schema inside the `.patch()` call. The existing block is:

```ts
dashboard_widget_visibility: t.Optional(
  t.Object({
    weather: t.Boolean(),
    homeassistant: t.Boolean(),
    system: t.Boolean(),
    downloads: t.Boolean(),
    rss: t.Boolean(),
    minecraft: t.Boolean(),
  }),
),
```

Replace it with:

```ts
dashboard_widget_visibility: t.Optional(
  t.Object(
    Object.fromEntries(WIDGETS.map((w) => [w.id, t.Boolean()])),
  ),
),
```

- [ ] **Step 4: Typecheck the API**

```bash
cd apps/api && bun run typecheck
```

Expected: no errors. If TypeScript reports a type error on the `mapSettings()` return — because spreading `Record<WidgetId, boolean>` with a `Record<string, boolean>` widens the inferred type — add an explicit cast on that object:

```ts
dashboard_widget_visibility: {
  ...DEFAULT_WIDGET_VISIBILITY,
  ...((row.dashboardWidgetVisibility as Record<string, boolean>) ?? {}),
} as Record<WidgetId, boolean>,
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/settings/index.ts
git commit -m "feat(api): derive widget visibility schema and defaults from shared WIDGETS registry"
```

---

## Task 3: Add i18n translation keys

**Files:**

- Modify: `apps/web/src/locales/en/common.json`
- Modify: `apps/web/src/locales/fr/common.json`

- [ ] **Step 1: Add EN widget labels**

Open `apps/web/src/locales/en/common.json`. Add a `"widgets"` key at the top level (alongside existing keys like `"nav"`, `"dashboard"`, etc.):

```json
"widgets": {
  "weather": "Weather",
  "quick_links": "Quick Links",
  "chores": "Chores",
  "jellyfin_shelf": "Jellyfin Shelf",
  "library_stats": "Library Stats",
  "library_alerts": "Library Alerts",
  "homeassistant": "Home Assistant",
  "habits": "Habits",
  "upcoming": "Upcoming",
  "trackers": "Trackers",
  "jellyfin_random": "Jellyfin Random",
  "system": "System",
  "focus_timer": "Focus Timer",
  "downloads": "Downloads",
  "minecraft_compact": "Minecraft (Compact)",
  "minecraft_cards": "Minecraft (Cards)",
  "rss": "RSS"
}
```

- [ ] **Step 2: Add FR widget labels**

Open `apps/web/src/locales/fr/common.json`. Add the same `"widgets"` key:

```json
"widgets": {
  "weather": "Météo",
  "quick_links": "Liens rapides",
  "chores": "Tâches ménagères",
  "jellyfin_shelf": "Bibliothèque Jellyfin",
  "library_stats": "Statistiques de bibliothèque",
  "library_alerts": "Alertes de bibliothèque",
  "homeassistant": "Home Assistant",
  "habits": "Habitudes",
  "upcoming": "À venir",
  "trackers": "Trackers",
  "jellyfin_random": "Jellyfin aléatoire",
  "system": "Système",
  "focus_timer": "Minuteur de concentration",
  "downloads": "Téléchargements",
  "minecraft_compact": "Minecraft (Compact)",
  "minecraft_cards": "Minecraft (Cartes)",
  "rss": "RSS"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
git commit -m "feat(i18n): add widget display name translations for all 17 dashboard widgets"
```

---

## Task 4: Create the component map

**Files:**

- Create: `apps/web/src/pages/_component/widgetComponents.tsx`

- [ ] **Step 1: Create the component map file**

Create `apps/web/src/pages/_component/widgetComponents.tsx`:

```tsx
import type { WidgetId } from "@hously/shared/constants";
import { ChoresPanel, HabitsPanel } from "@/pages/_component/HomePanel";
import { DownloadsPanel } from "@/pages/_component/DownloadsPanel";
import { FocusTimerPanel } from "@/pages/_component/FocusTimerPanel";
import { HomeAssistantPanel } from "@/pages/_component/HomeAssistantPanel";
import { JellyfinRandomPanel } from "@/pages/_component/JellyfinRandomPanel";
import { JellyfinShelf, UpcomingShelf } from "@/pages/_component/MediaShelves";
import { LibraryAttentionPanel } from "@/pages/_component/LibraryAttentionPanel";
import { LibraryStatsPanel } from "@/pages/_component/LibraryStatsPanel";
import { MinecraftCardsPanel } from "@/pages/_component/MinecraftCardsPanel";
import { MinecraftCompactPanel } from "@/pages/_component/MinecraftCompactPanel";
import { QuickLinksPanel } from "@/pages/_component/QuickLinksPanel";
import { RssStatusPanel } from "@/pages/_component/RssStatusPanel";
import { SystemPanel } from "@/pages/_component/system";
import { TrackersPanel } from "@/pages/_component/TrackersPanel";
import { WeatherPanel } from "@/pages/_component/WeatherPanel";

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

`Record<WidgetId, React.ComponentType>` is exhaustive — TypeScript will error if any registry ID is missing from this map.

- [ ] **Step 2: Typecheck web**

```bash
cd apps/web && bun run typecheck
```

Expected: no errors. If a widget ID is missing from the map, TypeScript will report it here — add the missing entry.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/_component/widgetComponents.tsx
git commit -m "feat(web): add exhaustive WIDGET_COMPONENTS map derived from WidgetId"
```

---

## Task 5: Rewrite the HomePage render loop

**Files:**

- Modify: `apps/web/src/pages/_component/HomePage.tsx`

The current file mounts all 17 panels as hardcoded JSX with `user?.is_admin` guards on two of them. The goal is to replace that JSX with a data-driven loop using the registry.

- [ ] **Step 1: Add the new imports**

At the top of `apps/web/src/pages/_component/HomePage.tsx`, add these imports alongside the existing ones (keep all existing panel imports — they are now used by `widgetComponents.tsx` but can be removed from here once the render loop is in place):

```ts
import { WIDGETS } from "@hously/shared/constants";
import { useAppSettings } from "@/pages/settings/useAppSettings";
import { WIDGET_COMPONENTS } from "@/pages/_component/widgetComponents";
```

- [ ] **Step 2: Replace the 3-column panel JSX with the render loop**

Inside the `HomePage` component, find the block that renders the three columns. It currently looks like this (abbreviated):

```tsx
<div /* column 1 */>
  <WeatherPanel />
  <QuickLinksPanel />
  ...
</div>
<div /* column 2 */>
  <HomeAssistantPanel />
  ...
</div>
<div /* column 3 */>
  <SystemPanel />
  ...
</div>
```

Replace the contents of the three column `<div>` elements with the data-driven loop. First, add these variables inside the `HomePage` function body, after the existing `useCurrentUser` and `useDashboardStats` calls:

```tsx
const { data } = useAppSettings();
const visibility = data?.settings.dashboard_widget_visibility ?? {};
const isAdmin = !!user?.is_admin;

const widgetColumns = [1, 2, 3].map((col) =>
  WIDGETS.filter((w) => w.column === col)
    .slice()
    .sort((a, b) => a.order - b.order)
    .filter((w) => !w.adminOnly || isAdmin)
    .filter((w) => visibility[w.id] !== false)
    .map((w) => {
      const Component = WIDGET_COMPONENTS[w.id];
      return <Component key={w.id} />;
    }),
);
```

Then replace the three column contents with `{widgetColumns[0]}`, `{widgetColumns[1]}`, `{widgetColumns[2]}` respectively.

- [ ] **Step 3: Remove the now-unused individual panel imports**

Remove all the direct panel component imports from `HomePage.tsx` that are now imported inside `widgetComponents.tsx`:

```ts
// Remove these (they're now in widgetComponents.tsx):
import { DownloadsPanel } from "@/pages/_component/DownloadsPanel";
import { WeatherPanel } from "@/pages/_component/WeatherPanel";
import { HomeAssistantPanel } from "@/pages/_component/HomeAssistantPanel";
import { SystemPanel } from "@/pages/_component/system";
import { JellyfinShelf, UpcomingShelf } from "@/pages/_component/MediaShelves";
import { LibraryAttentionPanel } from "@/pages/_component/LibraryAttentionPanel";
import { LibraryStatsPanel } from "@/pages/_component/LibraryStatsPanel";
import { TrackersPanel } from "@/pages/_component/TrackersPanel";
import { RssStatusPanel } from "@/pages/_component/RssStatusPanel";
import { ChoresPanel, HabitsPanel } from "@/pages/_component/HomePanel";
import { MinecraftCardsPanel } from "@/pages/_component/MinecraftCardsPanel";
import { MinecraftCompactPanel } from "@/pages/_component/MinecraftCompactPanel";
import { QuickLinksPanel } from "@/pages/_component/QuickLinksPanel";
import { JellyfinRandomPanel } from "@/pages/_component/JellyfinRandomPanel";
import { FocusTimerPanel } from "@/pages/_component/FocusTimerPanel";
```

- [ ] **Step 4: Typecheck and lint**

```bash
cd apps/web && bun run typecheck
make lint
```

Expected: no errors. If lint flags unused imports, they were missed in step 3 — remove them.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/_component/HomePage.tsx
git commit -m "feat(web): replace hardcoded dashboard panels with data-driven registry render loop"
```

---

## Task 6: Update the Settings UI

**Files:**

- Modify: `apps/web/src/pages/settings/_component/GeneralSettingsTab.tsx`

- [ ] **Step 1: Update the imports**

In `GeneralSettingsTab.tsx`, replace the existing shared type import:

```ts
// Remove:
import type { DashboardWidgetVisibility } from "@hously/shared";

// Add:
import { WIDGETS } from "@hously/shared/constants";
import type { WidgetVisibility } from "@hously/shared/constants";
```

- [ ] **Step 2: Replace the hardcoded DEFAULT_VISIBILITY fallback with a derived one**

Add a module-level constant before the component function:

```ts
const DEFAULT_VISIBILITY = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w.defaultVisible]),
) as WidgetVisibility;
```

- [ ] **Step 3: Update the widgetVisibility state declaration**

Replace:

```ts
const [widgetVisibility, setWidgetVisibility] =
  useState<DashboardWidgetVisibility>(
    data?.settings.dashboard_widget_visibility ?? {
      weather: true,
      homeassistant: true,
      system: true,
      downloads: true,
      rss: true,
      minecraft: true,
    },
  );
```

With:

```ts
const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibility>(
  data?.settings.dashboard_widget_visibility ?? DEFAULT_VISIBILITY,
);
```

- [ ] **Step 4: Update the useEffect fallback**

Inside the `useEffect`, replace:

```ts
setWidgetVisibility(
  data.settings.dashboard_widget_visibility ?? {
    weather: true,
    homeassistant: true,
    system: true,
    downloads: true,
    rss: true,
    minecraft: true,
  },
);
```

With:

```ts
setWidgetVisibility(
  data.settings.dashboard_widget_visibility ?? DEFAULT_VISIBILITY,
);
```

- [ ] **Step 5: Update toggleWidget signature**

Replace:

```ts
const toggleWidget = (key: keyof DashboardWidgetVisibility) => {
```

With:

```ts
const toggleWidget = (key: keyof WidgetVisibility) => {
```

- [ ] **Step 6: Replace the hardcoded widget checkbox list**

Find the "Dashboard Widgets" section that renders the hardcoded array:

```tsx
{
  (
    [
      { key: "weather" as const, label: "Weather" },
      { key: "homeassistant" as const, label: "Home Assistant" },
      { key: "system" as const, label: "System Status" },
      { key: "downloads" as const, label: "Downloads" },
      { key: "rss" as const, label: "RSS Status" },
      { key: "minecraft" as const, label: "Minecraft Servers" },
    ] as const
  ).map(({ key, label }) => (
    <label
      key={key}
      className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 p-2 rounded"
    >
      <Checkbox
        checked={widgetVisibility[key]}
        onChange={() => toggleWidget(key)}
      />
      <span className="text-sm text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
    </label>
  ));
}
```

Replace it with:

```tsx
{
  WIDGETS.map((w) => (
    <label
      key={w.id}
      className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 p-2 rounded"
    >
      <Checkbox
        checked={widgetVisibility[w.id] ?? w.defaultVisible}
        onChange={() => toggleWidget(w.id)}
      />
      <span className="text-sm text-neutral-700 dark:text-neutral-300">
        {t(`widgets.${w.id}`)}
      </span>
    </label>
  ));
}
```

- [ ] **Step 7: Typecheck and lint**

```bash
cd apps/web && bun run typecheck
make lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/settings/_component/GeneralSettingsTab.tsx
git commit -m "feat(web): derive settings widget list from WIDGETS registry with i18n labels"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run all tests**

```bash
make test
```

Expected: all tests pass. The shared registry tests confirm integrity; existing API and web tests confirm no regressions.

- [ ] **Step 2: Typecheck all workspaces**

```bash
make typecheck
```

Expected: clean across `apps/shared`, `apps/api`, `apps/web`.

- [ ] **Step 3: Lint**

```bash
make lint
```

Expected: no errors.

- [ ] **Step 4: Smoke-check in browser**

Start dev servers and verify:

1. Dashboard renders all expected widgets
2. Settings → General → Dashboard Widgets shows all 17 widgets with translated labels
3. Toggling a widget off and saving removes it from the dashboard
4. Admin-only widgets (`library_stats`, `library_alerts`) are absent for non-admin users

- [ ] **Step 5: Open PR**

```bash
gh pr create \
  --title "feat(dashboard): widget registry — single source of truth for all dashboard widgets" \
  --body "$(cat <<'EOF'
## Summary
- Adds \`WIDGETS\` registry in \`apps/shared\` as the authoritative list of all 17 dashboard widgets
- API settings route now derives \`DEFAULT_WIDGET_VISIBILITY\` and Elysia schema from the registry — no more manual sync
- \`HomePage\` render loop is data-driven: column assignment, render order, admin gating, and visibility all come from the registry
- Settings UI iterates the registry with i18n labels — all 17 widgets are now toggleable (previously only 6 were)
- Adding a new widget requires one entry in \`WIDGETS\` + one entry in \`WIDGET_COMPONENTS\` + two translation keys

## Test plan
- [ ] All unit tests pass (`make test`)
- [ ] All workspaces typecheck clean (`make typecheck`)
- [ ] Lint passes (`make lint`)
- [ ] Dashboard renders correctly in browser
- [ ] Toggling a widget off in settings removes it from the dashboard
- [ ] Admin-only widgets hidden for non-admin users
- [ ] All 17 widgets appear in settings with EN labels; switch locale to FR and verify FR labels appear
EOF
)"
```
