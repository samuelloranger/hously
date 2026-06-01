# V3 Life & Media Pages — Cozy Dusk Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the chores, kanban (board), habits, calendar, explore, watchlist, and collections pages into the v3 "Cozy Dusk" design system — full reskin + upgraded Fraunces header shells — while leaving each page's core interaction/layout structurally intact.

**Architecture:** Hybrid approach. (1) Upgrade the shared `PageHeader` component once so every Life page inherits a Cozy Dusk header (Fraunces display title, count/subtitle, primary-action emphasis, harmonized icon chip). (2) Reskin each page's internals to the warm neutral/primary palette, fixing every off-palette color. Semantic status colors are KEPT but harmonized to warm equivalents. The three media pages (explore/watchlist/collections) are brought up to the look the already-redesigned Library page established.

**Tech Stack:** React 19, TanStack Router/Query, Tailwind v4 (`@theme` tokens in `apps/web/src/index.css`), Fraunces (`font-display`) + Hanken Grotesk (`font-sans`).

**Delivery:** Single branch `feat/v3-life-pages-cozy-dusk`, one PR at the end.

---

## Cozy Dusk Reference (READ FIRST — applies to every task)

### Tokens / palette (defined in `apps/web/src/index.css`)
- **Surfaces:** `bg-surface-base` `#1c1715` (app base) · `bg-neutral-900` (card/input base) · `bg-neutral-800` (raised card / hover) · `bg-neutral-950` (deepest wells).
- **Borders:** `border-neutral-700` (standard) · `border-neutral-700/60` (subtle) · divider `bg-neutral-700` / `h-px`.
- **Text:** `text-neutral-50` (headings) · `text-neutral-100` (strong body) · `text-neutral-300` (body) · `text-neutral-400` (muted) · `text-neutral-600` (heavily muted).
- **Primary (apricot→terracotta):** `bg-primary-600` + `hover:bg-primary-500` (primary buttons; text on them is `text-neutral-950`), `text-primary-300/400` (active text/icons), `bg-primary-900/30` + `border-primary-800` + `text-primary-300` (tinted chip), `ring-primary-500/40` (focus ring).

### Component vocabulary to match (from the v3-done Library / dashboard)
- **Page wrapper:** `PageLayout` (already used by these pages). Section spacing `space-y-4`.
- **Header:** see Task 1 — Fraunces title `font-display text-2xl font-semibold tracking-tight text-neutral-50 sm:text-3xl`, subtitle `text-sm text-neutral-400`.
- **Grid card:** `rounded-2xl border border-neutral-700/60 bg-neutral-900 overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none`.
- **List row:** `rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 hover:bg-neutral-700/40 transition-colors`.
- **Search input:** `rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition`.
- **Primary action button:** `flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 text-sm font-medium text-neutral-950 transition-colors hover:bg-primary-500`.
- **Tabs / segmented filters:** reuse `SegmentedTabs` from `@/components/ui/segmented-tabs` (variants `underline` and `chips`). Active text `text-primary-300`, active icon `text-primary-400`, inactive `text-neutral-400 hover:text-neutral-200`.
- **Empty state:** reuse `EmptyState` from `@/components/EmptyState` (icon `text-neutral-600`, title, description).
- **Skeleton:** `rounded-xl bg-neutral-800 animate-pulse`.

### Semantic color harmonization (KEEP meaning, warm the hue) — THE RULE
Apply consistently everywhere. Never recolor a status to apricot just for cohesion — only DECORATIVE/non-semantic grays and blues become neutral/primary.

| Meaning | Old (varies) | New canonical classes |
| --- | --- | --- |
| Destructive / delete / overdue / error | `text-red-500/600`, `bg-red-900`, `text-red-400` | text `text-rose-400`, surface `bg-rose-900/30`, border `border-rose-800/60`, ring `focus:ring-rose-500/40`, hover bg `hover:bg-rose-900/20` |
| Done / completed / ready / success | `text-green-*`, `bg-emerald-*`, `text-green-600` | text `text-emerald-400`, surface `bg-emerald-900/30`, border `border-emerald-800/60` |
| In‑progress / pending / warning | `text-orange-*`, `text-yellow-*` | text `text-amber-400`, surface `bg-amber-900/30`, border `border-amber-800/60` |
| Todo / info / neutral-status | `bg-blue-900/30 text-blue-400`, `text-blue-600` | tinted primary: text `text-primary-300`, surface `bg-primary-900/30`, border `border-primary-800` |
| Decorative accent / link / focused icon (non-status) | `text-blue-400/600`, `bg-blue-*` | `text-primary-400` (or `text-primary-300` on dark surfaces); links `text-primary-300 hover:text-primary-200` |
| Generic gray / slate (surfaces, borders, text) | `gray-*`, `slate-*`, `zinc-*` | map to warm `neutral-*` of the same lightness step |
| Pure white surfaces (e.g. today cell) | `bg-white text-neutral-900` | `bg-primary-600 text-neutral-950` (filled) or `border-primary-500 text-primary-300` (outline) |
| `hover:bg-white/[0.06]`, `bg-white/15`, `ring-white/20-30` | white-alpha | `hover:bg-neutral-800`, `bg-neutral-700/40`, `ring-primary-500/30` |

### Verification (run for EVERY task before commit)
```bash
cd apps/web && bun run typecheck && bun run lint && bun run test
```
Expected: typecheck clean, lint clean, all tests pass (≈248 web tests). Existing tests must keep passing — this is a visual reskin; if a test asserts on an old color class, update the assertion to the new class (do not weaken the test).

### Out of scope (do NOT touch)
- Already-redesigned Library list/item components: `LibraryPage`, `LibraryToolbar`, `LibraryItemCard`, `LibraryItemRow`, `LibraryItemHero`, `LibraryPageHeader`, `LibraryGrid`. These are the reference, not the target. (Touch a shared medias component ONLY if a media-trio page renders it AND it still has a deviation — note it, keep the Library look intact.)
- Backend, query hooks, business logic. Class/markup changes only.

---

## Task 1: Upgrade shared `PageHeader` to Cozy Dusk

This single component is rendered by chores, board, habits, and calendar. Upgrading it delivers the "new header shell" for all four.

**Files:**
- Modify: `apps/web/src/components/PageHeader.tsx`
- Check (callers, for icon-color props to harmonize): `apps/web/src/pages/chores/_component/ChoresList.tsx`, `apps/web/src/pages/board/BoardView.tsx`, `apps/web/src/pages/habits/_component/HabitsList.tsx`, `apps/web/src/pages/calendar/_component/Calendar.tsx`

- [ ] **Step 1: Restyle the title to the display font**
  - Mobile `h1` (currently `text-lg font-bold tracking-tight text-white truncate`) → `font-display text-xl font-semibold tracking-tight text-neutral-50 truncate`.
  - Desktop `h1` (currently `text-xl font-bold tracking-tight text-white`) → `font-display text-2xl font-semibold tracking-tight text-neutral-50`.
  - Subtitles: change `text-neutral-400` stays, fine. Replace any `text-white` with `text-neutral-50`.

- [ ] **Step 2: Harmonize the `iconBg` map + icon color defaults**
  - Replace the `iconBg()` body so the icon chip uses warm tints. Map: green → `bg-emerald-900/30`, blue → `bg-primary-900/30` (decorative, becomes primary), orange → `bg-amber-900/30`, default → `bg-neutral-800`. Keep the function tolerant of the existing string inputs.
  - Default `iconColor` param: leave the prop but note callers will pass harmonized values in their own tasks; within PageHeader, when `iconColor==="text-blue-600"` treat as primary by ALSO accepting `text-primary-400` etc. (no special-casing needed beyond the bg map — the icon itself just renders `iconColor`).

- [ ] **Step 3: Harmonize the refresh button hover**
  - Both refresh buttons use `hover:bg-white/[0.06]` → `hover:bg-neutral-800`. Desktop one already adds `hover:text-neutral-200` — keep.

- [ ] **Step 4: Verify**
  - Run the standard verification block. There is no PageHeader unit test today; if one exists, keep it green.

- [ ] **Step 5: Commit**
  ```bash
  git add apps/web/src/components/PageHeader.tsx
  git commit -m "feat(v3): Cozy Dusk shared PageHeader (Fraunces title + warm icon chips)"
  ```

---

## Task 2: Chores page reskin

**Files (modify):**
- `apps/web/src/pages/chores/_component/ChoresList.tsx` — header icon color `text-green-600` → `text-emerald-400` (semantic: chores/done family) OR `text-primary-400` if it's purely decorative branding; use `text-primary-400` (it's the page brand icon, not a status). Card wrappers → grid/list vocabulary.
- `apps/web/src/pages/chores/_component/ChoreRow.tsx` — overdue tag `bg-red-900 text-red-200` → `bg-rose-900/30 text-rose-300 border border-rose-800/60`; links `text-blue-400` → `text-primary-300 hover:text-primary-200`; row container → list-row vocabulary; harmonize any gray.
- `apps/web/src/pages/chores/_component/RecurrenceBadge.tsx` — `bg-blue-900 text-blue-200` (decorative recurrence tag) → tinted primary `bg-primary-900/30 text-primary-300 border border-primary-800` OR neutral `bg-neutral-800 text-neutral-300` if it reads better as metadata; choose tinted primary.
- `apps/web/src/pages/chores/_component/ChoreForm.tsx` — error text `text-red-400` → `text-rose-400`; inputs already use `focus:ring-primary-500` (good); harmonize any gray surfaces; toggle switches use warm neutral.
- `apps/web/src/pages/chores/_component/CreateChoreModal.tsx`, `EditChoreModal.tsx` — modal surfaces to `bg-neutral-900` / `border-neutral-700`, harmonize buttons (primary action = primary-600 button vocabulary).

- [ ] **Step 1:** Grep the chores folder for offenders: `rg -n "gray-|slate-|zinc-|bg-white|text-white|blue-|green-|red-[0-9]|emerald-|orange-|yellow-" apps/web/src/pages/chores`. Build the full edit list.
- [ ] **Step 2:** Apply the harmonization table to every hit. Keep destructive (delete) actions in the `rose` family, completion in `emerald`. Convert card containers/rows to the card/list-row vocabulary. Replace `text-white` headings with `text-neutral-50`.
- [ ] **Step 3:** Verify (standard block). Update `apps/web/src/pages/chores/_component/__tests__/Chores.test.tsx` if it asserts on changed classes.
- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/src/pages/chores
  git commit -m "feat(v3): Cozy Dusk reskin of chores page"
  ```

---

## Task 3: Habits page reskin

Lowest deviation count — mostly delete buttons + toggle/form styling.

**Files (modify):** `apps/web/src/pages/habits/_component/` — `HabitsList.tsx`, `HabitCard.tsx`, `CreateHabitModal.tsx`, `EditHabitModal.tsx`, `HabitForm.tsx`, `HabitProgress.tsx`, `StreakBadge.tsx`, `ScheduleTimePicker.tsx`, `EmojiPicker.tsx`.

- [ ] **Step 1:** Grep: `rg -n "gray-|slate-|zinc-|bg-white|text-white|blue-|green-|red-[0-9]|emerald-|orange-|yellow-" apps/web/src/pages/habits`.
- [ ] **Step 2:** Apply harmonization. Notables from audit: `ScheduleTimePicker.tsx:55` delete `text-red-500 hover:bg-red-900/20` → `text-rose-400 hover:bg-rose-900/20`. `HabitForm.tsx:146` toggle white/neutral → warm neutral (`bg-neutral-700` off / `bg-primary-600` on). `StreakBadge` — a streak is a positive/achievement signal: use `text-amber-400` (flame/warmth) or `text-primary-300`; pick `text-amber-400`. `HabitCard` containers → grid-card vocabulary; `HabitProgress` bar fill `bg-primary-500`. Headings `text-white` → `text-neutral-50`.
- [ ] **Step 3:** Verify (standard block).
- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/src/pages/habits
  git commit -m "feat(v3): Cozy Dusk reskin of habits page"
  ```

---

## Task 4: Calendar page reskin

**Files (modify):** `apps/web/src/pages/calendar/_component/` — `Calendar.tsx`, `CalendarGrid.tsx`, `CalendarDayPanel.tsx`, `EventCard.tsx`, `CreateCustomEventForm.tsx`.

- [ ] **Step 1:** Grep: `rg -n "gray-|slate-|zinc-|bg-white|text-white|blue-|green-|red-[0-9]|emerald-|orange-|yellow-" apps/web/src/pages/calendar`.
- [ ] **Step 2:** Apply harmonization. Specific known offenders:
  - `Calendar.tsx:272` page header icon `text-blue-600` → `text-primary-400` (decorative brand icon).
  - `CalendarGrid.tsx:131` today cell `bg-white text-neutral-900` → `bg-primary-600 text-neutral-950` (filled today marker). Other-month / muted days → `text-neutral-600`. Day grid borders → `border-neutral-700`.
  - `CreateCustomEventForm.tsx:208,269` error `text-red-400` → `text-rose-400`.
  - `EventCard.tsx` — event chips: keep any category/semantic colors but harmonize to the table; default event chip → `bg-neutral-800 text-neutral-200 border border-neutral-700`, hover `hover:bg-neutral-700/40`.
  - Selected/focused day ring → `ring-primary-500/40`.
- [ ] **Step 3:** Verify (standard block). Update any calendar test asserting changed classes.
- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/src/pages/calendar
  git commit -m "feat(v3): Cozy Dusk reskin of calendar page"
  ```

---

## Task 5: Board (kanban) page reskin — largest

**Files (modify):** `apps/web/src/pages/board/BoardView.tsx` + `apps/web/src/pages/board/_components/`: `BoardKanban.tsx`, `BoardColumn.tsx`, `BoardTaskCard.tsx`, `BoardToolbar.tsx`, `FilterBar.tsx`, `FilterSelect.tsx`, `TaskDrawer.tsx`, `BacklogView.tsx`, `ArchiveView.tsx`, `ActivityLog.tsx`, `BulkActionsBar.tsx`, `CommentInput.tsx`, `CreateTaskForm.tsx`, `DependencySection.tsx`, `LogTimeForm.tsx`, `TagManagerModal.tsx`, `TagPicker.tsx`, `TimeEstimateField.tsx`, `TimeLogHistory.tsx`.

- [ ] **Step 1:** Grep the whole board tree: `rg -n "gray-|slate-|zinc-|bg-white|text-white|blue-|green-|red-[0-9]|emerald-|orange-|yellow-" apps/web/src/pages/board`. This is large — work component-by-component.
- [ ] **Step 2:** Apply harmonization, mapping STATUS semantics carefully:
  - Task statuses: `todo` → tinted primary (`bg-primary-900/30 text-primary-300`); `in_progress` → amber (`bg-amber-900/30 text-amber-300`); `done` → emerald (`bg-emerald-900/30 text-emerald-300`); `on_hold` (currently `bg-gray-400`) → neutral (`bg-neutral-600 text-neutral-200`). Apply the same mapping in `BacklogView.tsx:14`, `TaskDrawer.tsx:52`, `BoardTaskCard.tsx`.
  - Priority colors: keep semantic ramp but harmonize — high/urgent → `text-rose-400`, medium → `text-amber-400`, low → `text-neutral-400`.
  - Destructive (delete/remove dependency/delete tag): `text-red-*` → `text-rose-400`, hover `hover:bg-rose-900/20` (`TaskDrawer.tsx:70`, `BulkActionsBar.tsx:87,94,111`, `DependencySection.tsx:51`, `LogTimeForm.tsx:74`, `BoardTaskCard.tsx:202`).
  - Kanban columns: `rounded-xl border-neutral-700/60 bg-neutral-900/40` is already on-palette (BoardView.tsx:132) — keep, just ensure column header text uses `text-neutral-200`/count `text-neutral-400`.
  - Task cards → grid/list-row card vocabulary (`rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700/40`).
  - Skeletons (BoardView.tsx:122-164) → `bg-neutral-800 animate-pulse rounded-xl`.
  - Form rings `focus:ring-primary-500/20` → keep (on-palette).
  - Toolbar/filters → match search-input + chips vocabulary; consider `SegmentedTabs` chips for status filter if it slots in cleanly (optional, don't restructure logic).
- [ ] **Step 3:** Verify (standard block). Board has tests under `apps/web/src/pages/board/__tests__/` — update class assertions if any break.
- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/src/pages/board
  git commit -m "feat(v3): Cozy Dusk reskin of board (kanban) page"
  ```

---

## Task 6: Media trio — explore / watchlist / collections

These render `ExplorePage`, `WatchlistPage`, `CollectionsPage` from `apps/web/src/pages/medias/_component/`. Bring them up to the already-shipped Library look. ~38 white/gray deviations live in the medias pool; fix the ones these three pages actually render.

**Files (modify — discover the exact set in Step 1):** under `apps/web/src/pages/medias/_component/` — entry points `ExplorePage.tsx`, `WatchlistPage.tsx`, `CollectionsPage.tsx`, plus their unique subcomponents flagged by the audit: `InteractiveSearchToolbar.tsx`, `LibraryFileDetailBlock.tsx`, and any `Explore*`/`Watchlist*`/`Collections*` card/hero components.

**Do NOT modify** the Library-list/item reference components listed in "Out of scope" above.

- [ ] **Step 1:** Map the render trees. For each of `ExplorePage.tsx`, `WatchlistPage.tsx`, `CollectionsPage.tsx`, list the medias components it imports/renders. Then grep those files for offenders: `rg -n "bg-white|text-white|ring-white|gray-|slate-|zinc-|blue-|green-[0-9]|red-[0-9]" <files>`. Exclude the out-of-scope Library reference components.
- [ ] **Step 2:** Apply harmonization. Known offenders from audit:
  - `LibraryFileDetailBlock.tsx:316` `bg-white text-neutral-900` button → primary button vocabulary (`bg-primary-600 text-neutral-950 hover:bg-primary-500`).
  - `InteractiveSearchToolbar.tsx:99,232` `focus:bg-white` → `focus:bg-neutral-900` (keep ring `focus:ring-primary-500/40`).
  - `bg-white/15`, `ring-white/20-30` accents → `bg-neutral-700/40`, `ring-primary-500/30`.
  - Badges using white/gray → `bg-neutral-800 text-neutral-300 border border-neutral-700`.
  - Page headers for these three should use the upgraded `PageHeader` (Task 1) or match `LibraryPageHeader`'s Fraunces treatment — `text-primary-400` brand icon.
  - Card grids → grid-card vocabulary; ensure they visually match the Library grid.
- [ ] **Step 3:** Verify (standard block). Medias tests live under `apps/web/src/pages/medias/**/__tests__/` — keep green, update class assertions if needed.
- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/src/pages/medias
  git commit -m "feat(v3): Cozy Dusk reskin of explore/watchlist/collections (media pool)"
  ```

---

## Final review (after all tasks)

- [ ] Dispatch a final code-quality reviewer over the whole branch diff (`git diff origin/main...HEAD`): check (1) no remaining off-palette colors outside the harmonization table — `rg -n "bg-white|text-white|gray-[0-9]|slate-|zinc-|blue-[0-9]|text-green|text-red-[0-9]" apps/web/src/pages/{chores,board,habits,calendar,medias} apps/web/src/components/PageHeader.tsx` should return only intentional semantic `rose/emerald/amber` (which won't match those patterns) — i.e. ideally zero hits; (2) semantic meanings preserved (delete=rose, done=emerald, in-progress=amber); (3) Fraunces headers present on every page; (4) no logic/markup-structure regressions.
- [ ] Run full repo verification: `make typecheck && make lint && cd apps/web && bun run test`.
- [ ] Open the PR: `gh pr create --base main --title "feat(v3): Cozy Dusk rework of chores, kanban, habits, calendar, explore, watchlist & collections" --body "..."` summarizing the hybrid reskin, the shared PageHeader upgrade, and the semantic-color harmonization rule.

## Self-review notes
- **Spec coverage:** all 7 requested pages covered — chores (T2), kanban/board (T5), habits (T3), calendar (T4), explore+watchlist+collections (T6); header shells via shared PageHeader (T1) + media headers (T6).
- **Type consistency:** harmonization class names are fixed canonical strings (rose/emerald/amber/primary/neutral families) used identically across tasks.
- **Risk:** Board (T5) is the largest surface; if a subagent stalls, split T5 by sub-area (kanban view vs TaskDrawer vs forms).
