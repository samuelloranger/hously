# Hously v3 — « Cozy Dusk » Visual Redesign + Initial-Load Performance

**Date:** 2026-05-31
**Status:** Design approved — pending spec review
**Type:** Visual redesign (hybrid) + performance pass

## Summary

Hously v3 is a **visual rewrite** of the web app around a distinctive, warm,
dark "cozy home" identity — paired with a focused **initial-load performance**
pass. The goal is differentiation (a homelab/household command center that
looks like a home, not a cold ops dashboard) plus a measurably faster first
paint.

This is a **hybrid** redesign: a new design system is applied across **every**
screen (reskin), while two flagship screens — **Dashboard** and **Media
Library** — are rethought in depth, not merely restyled.

## Goals

1. Ship a cohesive **Cozy Dusk** design language: warm dark surfaces, apricot
   accent, cream text, Fraunces + Hanken Grotesk type, generous radii, soft
   warm shadows.
2. Rebuild the `components/ui/` primitives on the new tokens so the reskin
   propagates everywhere with minimal per-page work.
3. Redesign **Dashboard** (narrative "home" view) and **Media Library**
   (poster-first, legible quality states, smooth virtualized grid).
4. Reskin all remaining pages to the new language without restructuring them.
5. Reduce **initial load** time: smaller initial JS bundle, fewer boot
   requests, self-hosted fonts.

## Non-Goals

- No light theme. **Dark-only** ("Cozy Dusk" is *the* theme).
- No information-architecture overhaul beyond Dashboard + Library.
- No new product features (no AI agent, no automations engine — explicitly out).
- No backend/API changes except where required to trim boot-time requests.
- Not a runtime-jank or list-virtualization project (already acceptable);
  perf scope is **initial load** specifically.

## Design Decisions (locked during brainstorming)

| Decision | Choice | Notes |
| --- | --- | --- |
| Aesthetic direction | **Cozy Home** | Warm, rounded, friendly; plays the literal "house" meaning. |
| Palette | **Cozy Dusk (dark-only)** | Warm brown surfaces + apricot/terracotta accent + cream text. Green brand color retired. |
| Themes | **Dark only** | No light/dark toggle to build or maintain. |
| Strategy | **Hybrid** | New design system everywhere; deep rethink of Dashboard + Library only. |
| Typography | **Fraunces (headings) + Hanken Grotesk (body/UI)** | "Editorial home" tone. Self-hosted. |
| Performance focus | **Initial load** | Bundle size, boot requests, font loading. |

## Design Tokens (Cozy Dusk)

Defined in `apps/web/src/index.css` `@theme` (Tailwind v4). Indicative values —
finalize during the design-system PR:

```
Surfaces
  --color-surface-base:    #1c1715   /* app background */
  --color-surface-raised:  #241e1b   /* cards, panels */
  --color-surface-inset:   #171311   /* sidebar, wells */
  --color-border:          #322a25
  --color-border-strong:   #3a2f27

Accent
  --color-accent-500:      #e8a06a   /* primary apricot */
  --color-accent-600:      #cf6a4e   /* terracotta, secondary/hover */
  --color-accent-soft:     rgba(232,160,106,0.15)

Text
  --color-text-strong:     #f4ece4
  --color-text:            #e3d8cf
  --color-text-muted:      #9c8d80
  --color-text-faint:      #8a7d72

Semantic (warm-tinted)
  success / warning / danger / info — derived to sit on warm dark surfaces

Radii:   sm 10 · md 14 · lg 16 · xl 20
Shadows: soft, warm-tinted (rgba on near-black), low spread
Fonts:   --font-display: "Fraunces"; --font-sans: "Hanken Grotesk"
```

The existing green `--color-primary-*` scale is removed as the brand color.
A short audit replaces hardcoded `primary`/green usages with the new tokens.

### Fonts

- Self-host **Fraunces** (variable, optical sizing) and **Hanken Grotesk**
  (weights 400/500/600/700) under `apps/web` assets — no Google Fonts CDN in
  production (perf + privacy).
- Subset/preload the critical weights; `font-display: swap`.

## Component System

Rewrite `apps/web/src/components/ui/` primitives on the new tokens. These are
the leverage point — most screens inherit the reskin automatically:

- `button`, `input`, `textarea`, `select`, `checkbox`, `switch`, `toggle`,
  `segmented-tabs`, `popover`, `separator`, `form-field`, `calendar`,
  `color-picker`, `time-picker`, `collapsible`, `minimal-tiptap`.
- Shared layout/chrome: `Sidebar`, `PageHeader`, `PageLayout`, `EmptyState`,
  `LoadingState`/`Skeleton`, `HouseLoader`, dialogs, `NotificationToast*`.

Keep CVA + `clsx` + `tailwind-merge` conventions. No API/prop changes to
primitives unless a token rename forces it.

## Flagship Screen 1 — Dashboard

From a generic widget grid to a **narrative "home" view**:

- **Greeting header** (Fraunces): "Bonsoir, {name}." + contextual date line.
- **"Ce soir" hero card**: the single most relevant media item (ready to
  watch / just grabbed / upgrade), with a prominent play/open action.
- **Living stat tiles** (3-up): chores progress ring, active downloads with
  sparkline, habit streak.
- **Two-column lower row**: "À venir aujourd'hui" (calendar/chores/episode
  agenda) + "Attention bibliothèque" (library health/quality alerts).
- Respect existing dashboard widget-visibility settings (`AppSettings`,
  `dashboard_widget_visibility`) — the new layout reorganizes presentation,
  it does not discard the configurability that exists.

Reference mockup: `.superpowers/brainstorm/<session>/content/dashboard-mockup.html`.

## Flagship Screen 2 — Media Library

Poster-first, state-legible:

- Poster grid as the primary surface; reuse `MediaPosterCard` reworked to the
  new tokens.
- **Clear quality states**: missing / below profile / upgrade available /
  healthy — communicated with warm semantic colors + concise badges.
- Smooth virtualized grid (TanStack `react-virtual` already present) — keep it
  performant at large item counts; this is a *presentation* rethink, not a new
  data layer.
- Filtering/sorting affordances restyled to the new segmented-tabs/select
  primitives.

## Reskin Rollout (remaining screens)

Calendar, Chores, Habits, Board, Watchlist, Collections, Explore, Settings,
Notifications, Activity, auth pages — adopt the new design system via the
rewritten primitives + targeted per-page touch-ups. **No restructuring.**

## Performance — Initial Load

**Establish a baseline first** (no guessing):

- `vite build` bundle report + Lighthouse/Network trace on a representative
  cold load (LAN, served from `apps/api/public`).
- Record: initial JS (gzip), number + size of boot requests, TTI/FCP.

**Targets** (confirm against baseline; adjust if the baseline says otherwise):

- Initial JS bundle **< ~200 KB gzip**.
- **TTI < 2 s** on LAN cold load.
- No render-blocking font fetch; fonts self-hosted + preloaded.

**Levers:**

- Route-level **code-splitting** via TanStack Router lazy routes.
- **Lazy-load heavy libs** off the critical path: `minimal-tiptap`,
  calendar, `react-image-crop`, markdown, charts/sparklines.
- Audit **boot-time requests** (queries fired at app start) — defer or batch
  what isn't needed for first paint; ensure version-check/SSE wiring doesn't
  block render.
- Verify `vite-plugin-compression2` output is actually served compressed.

**Out of scope:** SSR, route prefetch tuning beyond defaults, server response
optimization beyond trimming boot requests.

## Delivery Plan (incremental, mergeable)

1. **Design-system PR**: tokens (`@theme`), self-hosted fonts, rewritten `ui/`
   primitives + shared chrome. App is fully Cozy Dusk but pages otherwise
   unchanged in structure.
2. **Dashboard** redesign PR.
3. **Media Library** redesign PR.
4. **Reskin sweep** PR(s): remaining pages, page-group at a time.
5. **Performance PR**: baseline capture → code-splitting + lazy loading +
   boot-request trim → re-measure against targets.

Each PR: `make typecheck` + `make lint` green; light visual/component checks;
no functional regressions.

## Risks & Open Questions

- **Green-brand removal** touches scattered hardcoded usages (logo, charts,
  status colors). Mitigation: token audit + grep sweep in the design-system PR.
- **Fraunces weight** can feel heavy at small sizes — restrict serif to
  headings/large numerals; body stays Hanken.
- **Dark-only** must keep media posters/imagery legible on warm dark — verify
  contrast (WCAG AA for text) during the design-system PR.
- Perf targets are provisional until the **baseline** is captured — numbers may
  move after measurement.
- Charts/recharts not currently a dep — if sparklines/rings need a lib, prefer
  hand-rolled SVG to avoid bundle cost (aligns with perf goal).

## References

- Brainstorm mockups: `.superpowers/brainstorm/<session>/content/`
  (`visual-direction.html`, `palette.html`, `typography.html`,
  `dashboard-mockup.html`).
- Current tokens: `apps/web/src/index.css`.
- UI primitives: `apps/web/src/components/ui/`.
