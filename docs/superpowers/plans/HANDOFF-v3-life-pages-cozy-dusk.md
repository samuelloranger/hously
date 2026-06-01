# HANDOFF — V3 Life & Media Pages Cozy Dusk Rework

**Branch:** `feat/v3-life-pages-cozy-dusk` (off `origin/main` @ `cbe26258`, the v3.0.0 release)
**Full plan:** `docs/superpowers/plans/2026-06-01-v3-life-pages-cozy-dusk.md` (read this for the complete per-task spec)
**Goal:** Rework 7 pages (chores, kanban/board, habits, calendar, explore, watchlist, collections) into the v3 "Cozy Dusk" design system. Hybrid approach: full reskin + upgraded Fraunces header shells; core interactions/layouts kept intact. Single branch, one PR.

---

## Progress

| # | Task | Status | Commit |
|---|------|--------|--------|
| T1 | Upgrade shared `PageHeader` (Fraunces title, warm icon chips, neutral hover) | ✅ DONE | `07a5d768` |
| T2 | Chores page reskin | ✅ DONE | `abb00eb8` |
| T3 | Habits page reskin | ✅ DONE | `e225dc01` |
| T4 | Calendar page reskin | ⬜ PENDING | — |
| T5 | Board (kanban) page reskin — **largest** | ⬜ PENDING | — |
| T6 | Explore / Watchlist / Collections (media trio) reskin | ⬜ PENDING | — |
| — | Final whole-branch review + open PR | ⬜ PENDING | — |

Working tree is **clean** as of this handoff. Verification gate passing: `cd apps/web && bun run typecheck && bun run lint && bun run test` → typecheck clean, lint clean, **248/248 tests pass**.

---

## The harmonization rule (apply to ALL remaining tasks)

Keep semantic MEANING, warm the hue. Only DECORATIVE grays/blues become neutral/primary — never recolor a genuine status to apricot.

| Meaning | New canonical classes |
|---|---|
| Destructive / delete / overdue / error | text `text-rose-400` · surface `bg-rose-900/30` · border `border-rose-800/60` · hover `hover:bg-rose-900/20` · ring `focus:ring-rose-500/40` |
| Done / completed / ready / success | text `text-emerald-400` · surface `bg-emerald-900/30` · border `border-emerald-800/60` |
| In-progress / pending / warning | text `text-amber-400` · surface `bg-amber-900/30` · border `border-amber-800/60` |
| Todo / info / neutral-status badge | tinted primary `bg-primary-900/30 text-primary-300 border border-primary-800` |
| Decorative accent / link / non-status blue | `text-primary-400`; links `text-primary-300 hover:text-primary-200` |
| Generic gray / slate / zinc | warm `neutral-*` of the SAME lightness step |
| Pure white surfaces (e.g. today cell) | `bg-primary-600 text-neutral-950` (filled) or `border-primary-500 text-primary-300` (outline) |
| white-alpha (`hover:bg-white/[0.06]`, `bg-white/15`, `ring-white/*`) | `hover:bg-neutral-800`, `bg-neutral-700/40`, `ring-primary-500/30` |
| Primary button (anywhere using `text-white hover:bg-primary-700`) | `bg-primary-600 text-neutral-950 hover:bg-primary-500` |

### Cozy Dusk vocabulary
- Card: `rounded-2xl border border-neutral-700/60 bg-neutral-900 hover:-translate-y-0.5 transition-transform motion-reduce:transform-none`
- List row: `rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 hover:bg-neutral-700/40 transition-colors`
- Search input: `rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition`
- Text: headings `text-neutral-50`, strong `text-neutral-100`, body `text-neutral-300`, muted `text-neutral-400`
- Page/section titles: `font-display font-semibold`
- Reuse `@/components/ui/segmented-tabs` (`SegmentedTabs`), `@/components/EmptyState`. Skeleton: `bg-neutral-800 animate-pulse rounded-xl`.

---

## How to resume (per-task recipe)

For each pending task, dispatch a fresh implementer subagent (sonnet is sufficient — mechanical reskin). Per-task recipe:

1. **Enumerate offenders:** `rg -n "gray-[0-9]|slate-|zinc-|bg-white|text-white|text-blue|bg-blue|text-green|bg-green|red-[0-9]|orange-|yellow-" <page folder>` — ignore false positives (`rounded-full`, `translate-x-full`, `w-full`, `h-full`).
2. **Apply** the harmonization table + vocabulary to every real hit. className/markup changes ONLY — no logic/props/query changes. Use `@/` import alias.
3. **Verify:** `cd apps/web && bun run typecheck && bun run lint && bun run test` (all must pass; update any test asserting a changed class — don't weaken it).
4. **Prove clean:** re-run the grep, confirm only intentional `rose/emerald/amber/primary/neutral` remain.
5. **Commit:** `git add <page folder> && git commit -m "feat(v3): Cozy Dusk reskin of <page>"`.

> ⚠️ **Do NOT parallelize implementers that commit** — the shared git index races. Run tasks sequentially. Also watch for a stalled agent: T3's first agent stopped mid-edit without committing `HabitsList.tsx`; verify the grep is clean before marking a task done.

### T4 — Calendar  (`apps/web/src/pages/calendar/_component/`)
Files: `Calendar.tsx`, `CalendarGrid.tsx`, `CalendarDayPanel.tsx`, `EventCard.tsx`, `CreateCustomEventForm.tsx`. Known offenders:
- `Calendar.tsx:272` header icon `text-blue-600` → `text-primary-400`.
- `CalendarGrid.tsx:131` today cell `bg-white text-neutral-900` → `bg-primary-600 text-neutral-950`; muted/other-month days → `text-neutral-600`; grid borders → `border-neutral-700`; selected-day ring → `ring-primary-500/40`.
- `CreateCustomEventForm.tsx:208,269` error `text-red-400` → `text-rose-400`.
- `EventCard.tsx` default event chip → `bg-neutral-800 text-neutral-200 border border-neutral-700`, hover `hover:bg-neutral-700/40`; keep category semantics via the table.

### T5 — Board / Kanban  (`apps/web/src/pages/board/BoardView.tsx` + `apps/web/src/pages/board/_components/`)
Largest surface (~2.7K lines). Files: `BoardKanban`, `BoardColumn`, `BoardTaskCard`, `BoardToolbar`, `FilterBar`, `FilterSelect`, `TaskDrawer`, `BacklogView`, `ArchiveView`, `ActivityLog`, `BulkActionsBar`, `CommentInput`, `CreateTaskForm`, `DependencySection`, `LogTimeForm`, `TagManagerModal`, `TagPicker`, `TimeEstimateField`, `TimeLogHistory`. Status mapping:
- `todo` → `bg-primary-900/30 text-primary-300`; `in_progress` → `bg-amber-900/30 text-amber-300`; `done` → `bg-emerald-900/30 text-emerald-300`; `on_hold` (was `bg-gray-400`) → `bg-neutral-600 text-neutral-200`. Apply in `BacklogView.tsx:14`, `TaskDrawer.tsx:52`, `BoardTaskCard.tsx`.
- Priority: high/urgent `text-rose-400`, medium `text-amber-400`, low `text-neutral-400`.
- Destructive `text-red-*` → `text-rose-400` (`TaskDrawer.tsx:70`, `BulkActionsBar.tsx:87,94,111`, `DependencySection.tsx:51`, `LogTimeForm.tsx:74`, `BoardTaskCard.tsx:202`).
- Columns at `BoardView.tsx:132` (`rounded-xl border-neutral-700/60 bg-neutral-900/40`) already on-palette — keep. Task cards → card/list-row vocabulary. Skeletons (`BoardView.tsx:122-164`) → `bg-neutral-800 animate-pulse rounded-xl`.
- Board tests live in `apps/web/src/pages/board/__tests__/` — keep green.
- If the agent stalls on size, split T5 into sub-areas: (a) kanban views (BoardView/Kanban/Column/TaskCard/Backlog/Archive), (b) TaskDrawer + sections, (c) toolbar/filters + forms (CreateTaskForm/LogTimeForm/TagManager/TagPicker/etc.). Commit per sub-area.

### T6 — Media trio  (`apps/web/src/pages/medias/_component/`)
Render `ExplorePage.tsx`, `WatchlistPage.tsx`, `CollectionsPage.tsx`. Bring up to the already-shipped Library look. ~38 white/gray deviations in the medias pool; fix only the components these three render.
- **DO NOT touch** the already-redesigned Library reference components: `LibraryPage`, `LibraryToolbar`, `LibraryItemCard`, `LibraryItemRow`, `LibraryItemHero`, `LibraryPageHeader`, `LibraryGrid`.
- Known offenders: `LibraryFileDetailBlock.tsx:316` `bg-white text-neutral-900` button → primary button vocabulary; `InteractiveSearchToolbar.tsx:99,232` `focus:bg-white` → `focus:bg-neutral-900` (keep `focus:ring-primary-500/40`); `bg-white/15`/`ring-white/20-30` → `bg-neutral-700/40`/`ring-primary-500/30`; white/gray badges → `bg-neutral-800 text-neutral-300 border border-neutral-700`.
- Step 1 must map each page's render tree and EXCLUDE the out-of-scope Library components before grepping.

---

## Final review + PR (after T4–T6)
1. Whole-branch sweep — should return only intentional semantic classes (zero hits ideally):
   `rg -n "bg-white|text-white|gray-[0-9]|slate-|zinc-|blue-[0-9]|text-green|text-red-[0-9]" apps/web/src/pages/{chores,board,habits,calendar,medias} apps/web/src/components/PageHeader.tsx`
2. Confirm semantics preserved (delete=rose, done=emerald, in-progress=amber) + Fraunces headers present on every page.
3. Full repo verify: `make typecheck && make lint && cd apps/web && bun run test`.
4. `gh pr create --base main --title "feat(v3): Cozy Dusk rework of chores, kanban, habits, calendar, explore, watchlist & collections" --body "<summary of hybrid reskin + shared PageHeader upgrade + harmonization rule>"`.
