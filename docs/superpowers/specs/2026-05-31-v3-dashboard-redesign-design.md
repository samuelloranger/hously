# Hously v3 — Dashboard Redesign (Phase 2)

**Date:** 2026-05-31
**Status:** Design approved — pending spec review
**Type:** Flagship screen redesign (Dashboard)
**Builds on:** Phase 1 Cozy Dusk design system (`2026-05-31-v3-cozy-dusk-redesign-design.md`)

## Summary

Redesign the Hously dashboard into a **hybrid** layout: a fixed top zone
(greeting + a configurable strip of compact "smart tiles") sitting above the
existing configurable widget grid. Rethink a handful of full widgets toward a
focused/narrative style, remove one redundant widget, and let the rest inherit
the Cozy Dusk styling already shipped.

The dashboard keeps its existing **configurable** philosophy — nothing becomes
a fixed narrative the user can't change. The new smart-tile strip is itself
configurable (catalog + selection + order), mirroring the existing widget
configuration model.

## Goals

1. Add a **greeting header** + a **configurable smart-tile strip** at the top of
   the dashboard — an at-a-glance summary of the household/homelab.
2. Introduce a **tile registry** (catalog of compact tiles) separate from the
   widget registry, with per-user selection + ordering persisted in settings.
3. Rethink 4 full widgets toward focused/narrative presentation: **media
   shelves**, **library attention**, **chores & habits**, **system**.
4. Remove the now-redundant **`library_stats`** widget.
5. Reuse existing data hooks — no new data endpoints except the tile-config
   settings field.

## Non-Goals

- No change to the 3-column widget grid mechanics (ordering, visibility, edit
  mode) beyond what tiles need.
- No redesign of the widgets NOT listed in Goal 3 (they keep Cozy Dusk styling
  from Phase 1).
- No new backend data sources; tiles read existing dashboard hooks.
- Not the Media Library page (that is a separate later phase).
- No light theme (dark-only, per Phase 1).

## Locked Decisions (from brainstorming)

| Decision            | Choice                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard structure | **Hybrid** — fixed greeting + smart-tile strip on top, configurable widget grid below                                              |
| Hero intensity      | **Equal smart tiles** (balanced glance), not a single dominant media hero                                                          |
| Smart tiles         | **Configurable** — user picks from a catalog + orders them                                                                         |
| Tile catalog v1     | 8 tiles (below); default-visible set of 4                                                                                          |
| Widgets rethought   | media shelves, library attention, chores & habits, system                                                                          |
| Widget removed      | **`library_stats`** (LibraryStatsPanel) — redundant                                                                                |
| Widgets untouched   | weather, quick_links, trackers, downloads, rss, homeassistant, minecraft_compact, focus_timer, jellyfin_random (inherit Cozy Dusk) |

## Architecture

### Page layout (`HomePage.tsx`)

```
DashboardGreeting          ← fixed: time-aware greeting + contextual subline
SmartTilesStrip            ← configurable row of compact tiles (catalog-driven)
── "Tes widgets" divider ──
3-column widget grid        ← existing, unchanged mechanics
```

`HomePage.tsx` composes the greeting + tile strip above the current widget
columns. The widget grid code (layout, visibility, move up/down, edit wrapper)
is reused as-is.

### Smart-tile registry (new)

Mirrors the existing widget-registry pattern in `apps/shared/src/constants/`:

- A `TILES` constant array — each entry: `{ id, defaultVisible, defaultOrder }`.
- `TileId` type, `TileLayout = TileId[]` (single ordered list; visibility =
  presence in the list, matching how the strip renders left→right).
- Helper(s) for default order + reconciling a stored layout with the catalog
  (drop unknown ids, append new catalog ids) — analogous to
  `getEffectiveLayout`.
- `tileComponents.tsx` (web) maps `TileId → React component`, like
  `widgetComponents.tsx`.

**Tile catalog v1 (8):**

| TileId             | Tile                                        | Data source (existing hook) |
| ------------------ | ------------------------------------------- | --------------------------- |
| `latest_media`     | Last downloaded media (mini poster + title) | downloads / library media   |
| `chores_today`     | Chores ring X/Y                             | `useDashboardStats`         |
| `habit_streak`     | Current habit streak                        | habits hooks / stats        |
| `next_event`       | Next calendar/chore/reminder + time         | `useDashboardUpcoming`      |
| `active_downloads` | Active download count + sparkline           | downloads hook              |
| `library_alerts`   | Library attention count                     | library attention hook      |
| `weather`          | Temp + condition                            | weather hook                |
| `system`           | System health / server status               | `useDashboardSystem`        |

**Default visible (4), in order:** `latest_media`, `chores_today`,
`next_event`, `habit_streak`.

Each tile is a small, self-contained component that reads ONE existing hook and
renders a compact card (label + key value, optional ring/sparkline/mini-poster
in Cozy Dusk style).

### Configuration / persistence

- New `AppSettings` field **`dashboard_tile_layout`** (`TileId[] | null`),
  added in `apps/shared/src/types/settings.ts` and the Prisma `AppSettings`
  model + `/api/settings` read/update, mirroring `dashboard_widget_layout`.
- Edit mode: reuse the existing dashboard edit affordance to add/remove/reorder
  tiles from the catalog. (Exact edit UX — inline move arrows like widgets vs a
  catalog picker — to be finalized in the plan; default to the existing
  move-arrow + visibility pattern for consistency and minimal new UI.)
- Migration: `dashboard_tile_layout` defaults to null → app falls back to the
  default-visible set, so existing users get the 4 default tiles automatically.

### Greeting header (`DashboardGreeting.tsx`)

- Time-aware greeting (Bonjour/Bonsoir + user name) in Fraunces, plus a
  contextual subline (date + one light contextual fact, e.g. "3 ajouts cette
  semaine"). i18n via existing codes-not-prose convention (en/fr).
- Fixed (not configurable) — small, low-risk.

### Widget rethink (4) + removal (1)

- **Media shelves** (`jellyfin_shelf`, `upcoming`) → focused "latest added /
  next release" poster-forward presentation in Cozy Dusk. (`jellyfin_random`
  stays as-is — it's a "surprise me" pick, not a recent/upcoming shelf.)
- **`library_alerts`** (LibraryAttentionPanel) → more legible, actionable alert
  list.
- **`chores` + `habits`** (HomePanel) → cozier progress (rings, completion
  celebration reuse).
- **`system`** (SystemPanel) → focused health readout.
- **Remove `library_stats`** (LibraryStatsPanel): delete from the widget
  registry, `widgetComponents.tsx`, the component file, and reconcile stored
  layouts (the existing `getEffectiveLayout` already drops unknown ids, so
  stored layouts containing `library_stats` degrade gracefully — verify with a
  test).

## Data Flow

Tiles and rethought widgets consume **existing** hooks
(`useDashboardStats`, `useDashboardUpcoming`, `useDashboardSystem`, downloads,
library attention, weather, habits). The only new server contract is the
`dashboard_tile_layout` settings field. No new query keys beyond settings.

## File Structure (indicative)

**Shared (`apps/shared`)**

- `src/constants/tiles.ts` — `TILES`, `TileId`, `TileLayout`, default/effective-layout helpers.
- `src/types/settings.ts` — add `dashboard_tile_layout`.

**Web (`apps/web`)**

- `src/pages/_component/DashboardGreeting.tsx` — greeting header.
- `src/pages/_component/SmartTilesStrip.tsx` — renders configured tiles.
- `src/pages/_component/tiles/` — one file per tile component.
- `src/pages/_component/tileComponents.tsx` — `TileId → component` registry.
- `src/pages/_component/HomePage.tsx` — compose greeting + strip + grid; tile edit wiring.
- `src/pages/_component/widgetComponents.tsx` — remove `library_stats`.
- Rethought widget files: `MediaShelves.tsx`, `LibraryAttentionPanel.tsx`,
  `HomePanel.tsx` (chores/habits), `system/`.
- Delete `LibraryStatsPanel.tsx`.

**API (`apps/api`)**

- `prisma/schema.prisma` — add `dashboardTileLayout` to `AppSettings`.
- Settings route/service — read/update `dashboard_tile_layout`, map camelCase→snake_case.
- Prisma migration.

## Testing

- Shared: tile default-order + effective-layout reconciliation (drops unknown,
  appends new) — unit tests mirroring `widgets.test.ts`. Plus a test that the
  widget effective-layout drops the removed `library_stats` id.
- Web: SmartTilesStrip renders the configured set in order; each tile renders
  with its hook mocked; greeting renders the right salutation for a given hour.
- API: settings round-trip persists/returns `dashboard_tile_layout`.

## Risks & Open Questions

- **Tile edit UX**: reuse widget move-arrows/visibility vs a dedicated catalog
  picker. Default to reuse for consistency; revisit if it feels cramped for a
  horizontal strip.
- **Mobile**: the 4-tile strip must wrap/scroll gracefully on narrow screens
  (existing `mobile-max` breakpoint).
- **`latest_media` data**: confirm the exact source (download history vs latest
  library item) during the plan; pick the one already exposed by a hook to
  avoid a new endpoint.
- **Removing `library_stats`**: confirm no other screen imports
  `LibraryStatsPanel` before deleting; its key info is covered by the
  `library_alerts` tile/widget and library page.
- **Scope creep on widget rethink**: keep the 4 rethinks focused; deeper media
  work belongs to the Library page phase.

## References

- Phase 1 spec: `docs/superpowers/specs/2026-05-31-v3-cozy-dusk-redesign-design.md`
- Widget registry: `apps/shared/src/constants/widgets.ts`, `apps/web/src/pages/_component/widgetComponents.tsx`
- Settings: `apps/shared/src/types/settings.ts`, `/api/settings`
- Brainstorm mockups: `.superpowers/brainstorm/106456-1780259635/content/` (`hero-layout.html`)
