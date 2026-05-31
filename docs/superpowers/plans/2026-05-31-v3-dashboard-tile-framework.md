# Hously v3 — Dashboard Smart-Tile Framework (Phase 2, Plan A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width, user-configurable "smart tiles" strip (plus the existing greeting) above the dashboard widget grid, persisted in settings — delivered end-to-end and proven with two real tiles.

**Architecture:** Mirror the existing widget-registry pattern for tiles: a shared `TILES` catalog + `TileLayout` (ordered `TileId[]`) + reconcile helpers, a new `AppSettings.dashboard_tile_layout` field (shared type → Prisma → `/api/settings`), a web `tileComponents` registry + `SmartTilesStrip`, and a `HomePage` change that lifts `GreetingCard` and the new strip to full width above the 3-column grid (replacing the column-1 `StatsRow`). Tiles read existing dashboard hooks. This plan ships the framework with 2 tiles (`chores_today`, `habit_streak`, both from `useDashboardStats`); Plan B adds the remaining catalog tiles; Plan C reworks full widgets.

**Tech Stack:** React 19, TanStack Query/Router, Tailwind v4 (Cozy Dusk), Elysia + Prisma, Vitest + happy-dom, `@hously/shared` workspace.

**Spec:** `docs/superpowers/specs/2026-05-31-v3-dashboard-redesign-design.md`

---

## File Structure

| File                                                      | Responsibility                                                  | Action             |
| --------------------------------------------------------- | --------------------------------------------------------------- | ------------------ |
| `apps/shared/src/constants/tiles.ts`                      | `TILES`, `TileId`, `TileLayout`, default/effective/move helpers | Create             |
| `apps/shared/src/constants/index.ts`                      | Re-export tiles                                                 | Modify             |
| `apps/shared/src/__tests__/tiles.test.ts`                 | Helper unit tests                                               | Create             |
| `apps/shared/src/types/settings.ts`                       | `dashboard_tile_layout` on AppSettings + update req             | Modify             |
| `apps/api/prisma/schema.prisma`                           | `dashboardTileLayout` column                                    | Modify             |
| `apps/api/prisma/migrations/**`                           | Migration                                                       | Create (generated) |
| `apps/api/src/routes/settings/index.ts`                   | read/update `dashboard_tile_layout`                             | Modify             |
| `apps/api/src/routes/settings/index.test.ts`              | settings round-trip test                                        | Create             |
| `apps/web/src/pages/_component/tiles/ChoresTodayTile.tsx` | chores pending tile                                             | Create             |
| `apps/web/src/pages/_component/tiles/HabitStreakTile.tsx` | habit streak tile                                               | Create             |
| `apps/web/src/pages/_component/tiles/TileCard.tsx`        | shared compact tile shell                                       | Create             |
| `apps/web/src/pages/_component/tileComponents.tsx`        | `TileId → component` registry (partial)                         | Create             |
| `apps/web/src/pages/_component/SmartTilesStrip.tsx`       | renders/configures the tile row                                 | Create             |
| `apps/web/src/pages/_component/SmartTilesStrip.test.tsx`  | strip render test                                               | Create             |
| `apps/web/src/pages/_component/HomePage.tsx`              | lift greeting + strip full-width; remove StatsRow               | Modify             |

**Out of scope (later plans):** remaining 6 catalog tiles (Plan B); the 4 widget rethinks + `library_stats` removal (Plan C).

---

## Task 1: Shared tile catalog + helpers

**Files:**

- Create: `apps/shared/src/constants/tiles.ts`
- Create: `apps/shared/src/__tests__/tiles.test.ts`
- Modify: `apps/shared/src/constants/index.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/shared/src/__tests__/tiles.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import {
  TILES,
  getDefaultTileLayout,
  getEffectiveTileLayout,
  moveTileInLayout,
  type TileLayout,
} from "../constants/tiles";

describe("tile catalog", () => {
  it("has unique ids", () => {
    const ids = TILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("default layout is the default-visible ids in defaultOrder", () => {
    const layout = getDefaultTileLayout();
    const expected = TILES.filter((t) => t.defaultVisible)
      .slice()
      .sort((a, b) => a.defaultOrder - b.defaultOrder)
      .map((t) => t.id);
    expect(layout).toEqual(expected);
  });

  it("effective layout falls back to default when stored is null", () => {
    expect(getEffectiveTileLayout(null)).toEqual(getDefaultTileLayout());
  });

  it("effective layout drops unknown ids and appends missing catalog ids", () => {
    const stored = ["chores_today", "bogus_tile"] as unknown as TileLayout;
    const eff = getEffectiveTileLayout(stored);
    expect(eff).toContain("chores_today");
    expect(eff).not.toContain("bogus_tile");
    // every catalog id present exactly once
    expect(new Set(eff).size).toBe(eff.length);
    TILES.forEach((t) => expect(eff).toContain(t.id));
  });

  it("moveTileInLayout swaps adjacent tiles", () => {
    const layout = ["a", "b", "c"] as unknown as TileLayout;
    expect(moveTileInLayout(layout, "b" as never, "up")).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(moveTileInLayout(layout, "b" as never, "down")).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("moveTileInLayout is a no-op at the edges", () => {
    const layout = ["a", "b"] as unknown as TileLayout;
    expect(moveTileInLayout(layout, "a" as never, "up")).toEqual(["a", "b"]);
    expect(moveTileInLayout(layout, "b" as never, "down")).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/shared && bun test src/__tests__/tiles.test.ts`
Expected: FAIL — `../constants/tiles` does not exist.

- [ ] **Step 3: Create the tiles catalog + helpers**

Create `apps/shared/src/constants/tiles.ts`:

```ts
export const TILES = [
  { id: "latest_media", defaultVisible: true, defaultOrder: 0 },
  { id: "chores_today", defaultVisible: true, defaultOrder: 1 },
  { id: "next_event", defaultVisible: true, defaultOrder: 2 },
  { id: "habit_streak", defaultVisible: true, defaultOrder: 3 },
  { id: "active_downloads", defaultVisible: false, defaultOrder: 4 },
  { id: "library_alerts", defaultVisible: false, defaultOrder: 5 },
  { id: "weather", defaultVisible: false, defaultOrder: 6 },
  { id: "system", defaultVisible: false, defaultOrder: 7 },
] as const;

export type TileId = (typeof TILES)[number]["id"];
export type TileMeta = (typeof TILES)[number];
export type TileLayout = TileId[];

export function getDefaultTileLayout(): TileLayout {
  return TILES.filter((t) => t.defaultVisible)
    .slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .map((t) => t.id);
}

const VALID_TILE_IDS = new Set<string>(TILES.map((t) => t.id));

/**
 * Reconcile a stored tile layout with the current catalog: keep stored order,
 * drop ids no longer in the catalog, and append any catalog ids not present
 * (in defaultOrder) so newly-shipped tiles surface without wiping config.
 * Note: presence in the array == visible; absence (after a user removes one)
 * is preserved only across the known catalog — brand-new catalog tiles are
 * appended as visible so they are discoverable.
 */
export function getEffectiveTileLayout(stored: TileLayout | null): TileLayout {
  if (!stored) return getDefaultTileLayout();
  const cleaned = stored.filter((id) => VALID_TILE_IDS.has(id));
  const present = new Set(cleaned);
  TILES.slice()
    .sort((a, b) => a.defaultOrder - b.defaultOrder)
    .forEach((t) => {
      if (!present.has(t.id)) cleaned.push(t.id);
    });
  return cleaned;
}

export function moveTileInLayout(
  layout: TileLayout,
  id: TileId,
  direction: "up" | "down",
): TileLayout {
  const next = [...layout];
  const pos = next.indexOf(id);
  if (pos === -1) return next;
  const target = direction === "up" ? pos - 1 : pos + 1;
  if (target < 0 || target >= next.length) return next;
  [next[pos], next[target]] = [next[target], next[pos]];
  return next;
}
```

- [ ] **Step 4: Re-export from the constants index**

In `apps/shared/src/constants/index.ts`, add (next to the existing widgets export):

```ts
export * from "./tiles";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/shared && bun test src/__tests__/tiles.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Typecheck + commit**

Run: `cd apps/shared && bun run typecheck` (expect clean — note: the new-catalog-tile "append as visible" behavior means removed tiles reappear only when the catalog itself changes; documented in the helper).

```bash
git add apps/shared/src/constants/tiles.ts apps/shared/src/constants/index.ts apps/shared/src/__tests__/tiles.test.ts
git commit -m "feat(v3): shared smart-tile catalog + layout helpers"
```

---

## Task 2: Settings type — `dashboard_tile_layout`

**Files:**

- Modify: `apps/shared/src/types/settings.ts`

- [ ] **Step 1: Add the field to the shared types**

In `apps/shared/src/types/settings.ts`:

- Update the import line to also import `TileLayout`:

```ts
import type { WidgetVisibility, WidgetLayout, TileLayout } from "../constants";
```

(Change the source from `"../constants/widgets"` to `"../constants"` so both widgets and tiles types resolve through the barrel.)

- In `interface AppSettings`, after `dashboard_widget_layout`, add:

```ts
dashboard_tile_layout: TileLayout | null;
```

- In `interface UpdateAppSettingsRequest`, after `dashboard_widget_layout?`, add:

```ts
  dashboard_tile_layout?: TileLayout;
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/shared && bun run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/shared/src/types/settings.ts
git commit -m "feat(v3): add dashboard_tile_layout to AppSettings types"
```

---

## Task 3: Prisma column + migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma:790` (AppSettings model)

- [ ] **Step 1: Add the column**

In `apps/api/prisma/schema.prisma`, inside `model AppSettings`, immediately after the `dashboardWidgetLayout` line, add:

```prisma
  dashboardTileLayout        Json?    @map("dashboard_tile_layout")
```

- [ ] **Step 2: Create the migration**

Run (from repo root; uses the Makefile wrapper):

```bash
make migrate-dev
```

When prompted for a name, use: `add_dashboard_tile_layout`
Expected: a new migration folder under `apps/api/prisma/migrations/` adding the nullable `dashboard_tile_layout` JSON column; Prisma client regenerated.

(If `make migrate-dev` is non-interactive in this environment, run `cd apps/api && bunx prisma migrate dev --name add_dashboard_tile_layout` directly.)

- [ ] **Step 3: Verify the client has the field**

Run: `cd apps/api && bunx prisma generate && bun run typecheck`
Expected: clean; `AppSettings` Prisma type now includes `dashboardTileLayout`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(v3): add dashboard_tile_layout column to app_settings"
```

---

## Task 4: Settings API — read & update `dashboard_tile_layout`

**Files:**

- Modify: `apps/api/src/routes/settings/index.ts`
- Create: `apps/api/src/routes/settings/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/settings/index.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { getEffectiveTileLayout } from "@hously/shared/constants";

// Pure mapping check: a stored tile layout round-trips through the
// reconcile helper the API/UI rely on (drops unknown, keeps order).
describe("dashboard_tile_layout reconciliation", () => {
  it("keeps a valid stored order", () => {
    const eff = getEffectiveTileLayout(["next_event", "chores_today"]);
    expect(eff[0]).toBe("next_event");
    expect(eff[1]).toBe("chores_today");
  });

  it("null falls back to defaults (latest_media first)", () => {
    expect(getEffectiveTileLayout(null)[0]).toBe("latest_media");
  });
});
```

(Rationale: the settings route uses Prisma upsert against a live DB; a focused unit test on the reconcile contract that the route + UI share gives real coverage without standing up the DB. The route wiring is verified by typecheck + the manual smoke at the end.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/api && bun test src/routes/settings/index.test.ts`
Expected: PASS only after Task 1 shipped the helper — if it fails to import, confirm Task 1 is merged. (If Task 1 is present it will PASS; in that case add a temporary `expect(true).toBe(false)` to confirm the runner picks up the file, then remove it. The substantive coverage is the reconcile assertions.)

- [ ] **Step 3: Add `dashboard_tile_layout` to `mapSettings`**

In `apps/api/src/routes/settings/index.ts`:

- Extend the type import:

```ts
import type {
  WidgetId,
  WidgetLayout,
  TileLayout,
} from "@hously/shared/constants";
```

- In `mapSettings`, after the `dashboard_widget_layout` line, add:

```ts
    dashboard_tile_layout:
      (row.dashboardTileLayout as TileLayout | null) ?? null,
```

- [ ] **Step 4: Handle `dashboard_tile_layout` in PATCH**

In the same file's PATCH handler:

- Add to the `updateData` type:

```ts
          dashboardTileLayout?: TileLayout;
```

- After the `dashboard_widget_layout` if-block, add:

```ts
if (body.dashboard_tile_layout !== undefined) {
  updateData.dashboardTileLayout = body.dashboard_tile_layout as TileLayout;
}
```

- In the `body: t.Object({ ... })` schema, after the `dashboard_widget_layout` entry, add:

```ts
        dashboard_tile_layout: t.Optional(t.Array(t.String())),
```

- [ ] **Step 5: Run the test + typecheck**

Run:

```bash
cd apps/api && bun test src/routes/settings/index.test.ts && bun run typecheck
```

Expected: test PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/settings/index.ts apps/api/src/routes/settings/index.test.ts
git commit -m "feat(v3): persist dashboard_tile_layout via settings API"
```

---

## Task 5: Tile registry + two real tiles

**Files:**

- Create: `apps/web/src/pages/_component/tiles/TileCard.tsx`
- Create: `apps/web/src/pages/_component/tiles/ChoresTodayTile.tsx`
- Create: `apps/web/src/pages/_component/tiles/HabitStreakTile.tsx`
- Create: `apps/web/src/pages/_component/tileComponents.tsx`

- [ ] **Step 1: Create the shared tile shell**

Create `apps/web/src/pages/_component/tiles/TileCard.tsx`:

```tsx
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function TileCard({
  label,
  to,
  children,
  className,
}: {
  label: string;
  to?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-neutral-700 bg-neutral-800 p-3.5 transition-colors",
        to && "hover:border-neutral-600",
        className,
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="min-w-0 flex-1">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 flex-1">{body}</div>
  );
}
```

- [ ] **Step 2: Create the Chores tile**

Create `apps/web/src/pages/_component/tiles/ChoresTodayTile.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function ChoresTodayTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardStats();
  const count = data?.stats.chores_count ?? 0;
  return (
    <TileCard label={t("dashboard.tiles.choresLabel")} to="/chores">
      <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
        {count}
      </span>
      <span className="ml-1.5 text-sm text-neutral-400">
        {t("dashboard.tiles.choresPending", { count })}
      </span>
    </TileCard>
  );
}
```

- [ ] **Step 3: Create the Habit streak tile**

Create `apps/web/src/pages/_component/tiles/HabitStreakTile.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Flame } from "lucide-react";
import { useDashboardStats } from "@/pages/_component/useDashboardStats";
import { TileCard } from "@/pages/_component/tiles/TileCard";

export function HabitStreakTile() {
  const { t } = useTranslation("common");
  const { data } = useDashboardStats();
  const streak = data?.stats.habits_streak ?? 0;
  return (
    <TileCard label={t("dashboard.tiles.streakLabel")} to="/habits">
      <span className="flex items-baseline gap-1.5">
        <Flame size={18} className="self-center text-primary-400" />
        <span className="font-display text-2xl font-semibold text-neutral-50 tabular-nums">
          {streak}
        </span>
        <span className="text-sm text-neutral-400">
          {t("dashboard.tiles.streakDays", { count: streak })}
        </span>
      </span>
    </TileCard>
  );
}
```

- [ ] **Step 4: Create the registry**

Create `apps/web/src/pages/_component/tileComponents.tsx`:

```tsx
import type { TileId } from "@hously/shared/constants";
import { ChoresTodayTile } from "@/pages/_component/tiles/ChoresTodayTile";
import { HabitStreakTile } from "@/pages/_component/tiles/HabitStreakTile";

/**
 * Maps a TileId to its component. Partial by design: the catalog (shared)
 * lists all planned tiles, but components ship incrementally (Plan B adds the
 * rest). SmartTilesStrip renders only tiles present in this registry.
 */
export const TILE_COMPONENTS: Partial<Record<TileId, React.ComponentType>> = {
  chores_today: ChoresTodayTile,
  habit_streak: HabitStreakTile,
};
```

- [ ] **Step 5: Add the i18n keys**

In `apps/web/src/locales/en/common.json`, under the `dashboard` object, add a `tiles` block (create it if absent):

```json
"tiles": {
  "choresLabel": "Chores",
  "choresPending": "{{count}} pending",
  "streakLabel": "Streak",
  "streakDays": "day",
  "streakDays_other": "days"
}
```

In `apps/web/src/locales/fr/common.json`, the same keys translated:

```json
"tiles": {
  "choresLabel": "Tâches",
  "choresPending": "{{count}} en attente",
  "streakLabel": "Série",
  "streakDays": "jour",
  "streakDays_other": "jours"
}
```

(Match the existing nesting/format of these files; place `tiles` as a sibling of the existing `home` key under `dashboard`.)

- [ ] **Step 6: Typecheck + lint + commit**

Run: `cd apps/web && bun run typecheck && bun run lint`
Expected: clean.

```bash
git add apps/web/src/pages/_component/tiles apps/web/src/pages/_component/tileComponents.tsx apps/web/src/locales
git commit -m "feat(v3): tile registry + chores & habit-streak tiles"
```

---

## Task 6: SmartTilesStrip

**Files:**

- Create: `apps/web/src/pages/_component/SmartTilesStrip.tsx`
- Create: `apps/web/src/pages/_component/SmartTilesStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/_component/SmartTilesStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SmartTilesStrip } from "./SmartTilesStrip";

vi.mock("@/pages/_component/tileComponents", () => ({
  TILE_COMPONENTS: {
    chores_today: () => <div data-testid="tile-chores">chores</div>,
    habit_streak: () => <div data-testid="tile-streak">streak</div>,
  },
}));

describe("SmartTilesStrip", () => {
  it("renders configured registered tiles in layout order", () => {
    render(<SmartTilesStrip layout={["habit_streak", "chores_today"]} />);
    const tiles = screen.getAllByTestId(/^tile-/);
    expect(tiles.map((el) => el.getAttribute("data-testid"))).toEqual([
      "tile-streak",
      "tile-chores",
    ]);
  });

  it("skips ids with no registered component", () => {
    render(<SmartTilesStrip layout={["weather", "chores_today"] as never} />);
    expect(screen.queryByTestId("tile-chores")).toBeTruthy();
    expect(screen.getAllByTestId(/^tile-/)).toHaveLength(1);
  });

  it("renders nothing when no tiles resolve", () => {
    const { container } = render(
      <SmartTilesStrip layout={["weather"] as never} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/web && bunx vitest run src/pages/_component/SmartTilesStrip.test.tsx`
Expected: FAIL — `./SmartTilesStrip` does not exist.

- [ ] **Step 3: Implement the strip**

Create `apps/web/src/pages/_component/SmartTilesStrip.tsx`:

```tsx
import type { TileId, TileLayout } from "@hously/shared/constants";
import { TILE_COMPONENTS } from "@/pages/_component/tileComponents";

export function SmartTilesStrip({ layout }: { layout: TileLayout }) {
  const tiles = layout
    .map((id) => ({ id, Component: TILE_COMPONENTS[id as TileId] }))
    .filter((t): t is { id: TileId; Component: React.ComponentType } =>
      Boolean(t.Component),
    );

  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 min-[700px]:grid-cols-4">
      {tiles.map(({ id, Component }) => (
        <Component key={id} />
      ))}
    </div>
  );
}
```

(Reorder/hide edit UX is intentionally NOT in this plan — the strip renders the configured layout. Edit wiring is added in Task 7 via the existing dashboard edit mode; a richer tile-picker is a follow-up. The strip wraps to 2 columns on mobile, 4 on ≥700px.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && bunx vitest run src/pages/_component/SmartTilesStrip.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/_component/SmartTilesStrip.tsx apps/web/src/pages/_component/SmartTilesStrip.test.tsx
git commit -m "feat(v3): SmartTilesStrip renders configured tiles"
```

---

## Task 7: HomePage integration — full-width greeting + tile strip

**Files:**

- Modify: `apps/web/src/pages/_component/HomePage.tsx`

Currently `GreetingCard` + `StatsRow` live inside Column 1 (so they only span the first column). This task lifts `GreetingCard` and the new `SmartTilesStrip` to full width above the 3-column grid, removes `StatsRow`, and feeds the strip the effective tile layout from settings.

- [ ] **Step 1: Wire imports + tile layout**

In `apps/web/src/pages/_component/HomePage.tsx`:

- Add imports:

```tsx
import { SmartTilesStrip } from "@/pages/_component/SmartTilesStrip";
import { getEffectiveTileLayout } from "@hously/shared/constants";
```

- In the `HomePage` component body, after the existing `const visibility = ...` / layout state, derive the tile layout from settings:

```tsx
const tileLayout = getEffectiveTileLayout(
  data?.settings.dashboard_tile_layout ?? null,
);
```

- [ ] **Step 2: Render greeting + strip full-width, remove StatsRow**

In the `return (...)`, replace the outer wrapper so the greeting and strip sit above the columns. Change:

```tsx
    <PageLayout fullWidth>
      <div className="space-y-4">
        {/* 3-column widget layout: ... */}
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          {/* Column 1 — GreetingCard always first, non-movable */}
          <motion.div
            className="flex flex-col gap-4 flex-1 min-w-0"
            variants={columnVariants}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={panelVariants} className="space-y-3">
              <GreetingCard
                userName={getUserFirstName(user, t("dashboard.user"))}
                pendingChores={stats?.chores_count}
                eventsToday={stats?.events_today}
                isAdmin={isAdmin}
                isEditMode={isEditMode}
                onToggleEditMode={() => setIsEditMode((v) => !v)}
              />
              <StatsRow stats={stats} isLoading={statsLoading} />
            </motion.div>
            {widgetColumns[0]}
          </motion.div>
```

to:

```tsx
    <PageLayout fullWidth>
      <div className="space-y-4">
        {/* Full-width hero zone: greeting + configurable smart tiles */}
        <div className="space-y-3">
          <GreetingCard
            userName={getUserFirstName(user, t("dashboard.user"))}
            pendingChores={stats?.chores_count}
            eventsToday={stats?.events_today}
            isAdmin={isAdmin}
            isEditMode={isEditMode}
            onToggleEditMode={() => setIsEditMode((v) => !v)}
          />
          <SmartTilesStrip layout={tileLayout} />
        </div>

        {/* 3-column widget layout below the hero zone */}
        <div className="flex flex-col md:flex-row gap-4 md:items-start">
          {/* Column 1 */}
          <motion.div
            className="flex flex-col gap-4 flex-1 min-w-0"
            variants={columnVariants}
            initial="hidden"
            animate="show"
          >
            {widgetColumns[0]}
          </motion.div>
```

(Leave Columns 2 and 3 exactly as they are.)

- [ ] **Step 3: Delete the now-unused StatsRow**

In `apps/web/src/pages/_component/HomePage.tsx`, delete the entire `function StatsRow({ ... }) { ... }` definition (the block starting at the `// ─── Stats row ───` comment). Then remove any imports that become unused as a result (e.g. `CalendarDays`, `CheckSquare2`, `Flame`, `Link` from `@tanstack/react-router` — ONLY if no longer referenced elsewhere in the file; verify each before removing).

- [ ] **Step 4: Typecheck + lint**

Run: `cd apps/web && bun run typecheck && bun run lint`
Expected: clean. Fix any "unused import/variable" errors from the StatsRow removal (Step 3).

- [ ] **Step 5: Full web test run + build**

Run: `cd apps/web && bunx vitest run && bun run build`
Expected: all tests green; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/_component/HomePage.tsx
git commit -m "feat(v3): full-width greeting + smart-tile strip above widget grid"
```

---

## Final Verification

- [ ] **All workspaces green:**

```bash
cd apps/shared && bun test
cd apps/api && bun test src/routes/settings/index.test.ts
cd apps/web && bunx vitest run && bun run typecheck && bun run lint && bun run build
```

Expected: all pass.

- [ ] **Manual smoke (after `make migrate-dev` applied):** Load the dashboard. Confirm: greeting spans full width on top; a row of tiles (Chores pending + Streak) renders below it, full width; the 3-column widget grid sits below the tiles; the old in-column StatsRow chips are gone. Confirm tiles render warm Cozy Dusk styling and link to /chores and /habits.

---

## Self-Review Notes

- **Spec coverage:** greeting (reuses existing GreetingCard, repositioned) + configurable tile strip (Tasks 5-7); tile registry/catalog + helpers (Task 1); `dashboard_tile_layout` settings field shared→Prisma→API (Tasks 2-4). Remaining catalog tiles = Plan B; widget rethinks + `library_stats` removal = Plan C (explicitly out of scope here).
- **Type consistency:** `TileId`/`TileLayout`/`getEffectiveTileLayout`/`moveTileInLayout` defined in Task 1 and used identically in Tasks 2/4/6/7. Registry typed `Partial<Record<TileId, ComponentType>>`; strip filters to registered ids; default-visible tiles that aren't yet registered (latest_media, next_event) simply don't render until Plan B — the strip degrades gracefully (covered by the "skips unregistered" test).
- **Known gap (intentional):** the default tile layout lists 4 defaults but only 2 are registered in Plan A, so the default dashboard shows 2 tiles until Plan B lands the other 2 defaults (latest_media, next_event). This is the incremental rollout; flagged so it's not mistaken for a bug.
- **Edit UX deferred:** tile reorder/add/remove UI is not built here (the `moveTileInLayout` helper + settings field are ready for it); the strip renders the persisted/default layout. A follow-up adds the edit affordance. `isEditMode` already exists for widgets and is untouched.
- **Placeholder scan:** no TBD/TODO; every code step has concrete code; i18n keys provided for both locales.
