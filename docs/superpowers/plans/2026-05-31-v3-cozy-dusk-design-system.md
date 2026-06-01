# Hously v3 — Cozy Dusk Design System (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Hously's web design system with the warm, dark "Cozy Dusk" identity (apricot/terracotta accent, warm-brown surfaces, Fraunces + Hanken Grotesk type), dark-only — so every existing screen instantly inherits the new look.

**Architecture:** The leverage is Tailwind v4 `@theme`. ~225 files use `dark:` variants on the `neutral-*` gray scale and ~113 use the green `primary-*` scale. Instead of editing each file, we (1) **force dark mode permanently**, then (2) **redefine the `primary` and `neutral` color scales** in `@theme` to warm Cozy Dusk values. Components keep their `dark:bg-neutral-800` / `bg-primary-600` classes but those now resolve to warm brown / apricot. We then **explicitly refine the highest-traffic UI primitives** (button, etc.) for polish and self-host the fonts.

**Tech Stack:** React 19, Tailwind v4 (CSS `@theme`), Vite 8, Vitest + happy-dom, CVA + clsx + tailwind-merge, `@fontsource-variable/*` for self-hosted fonts.

**Spec:** `docs/superpowers/specs/2026-05-31-v3-cozy-dusk-redesign-design.md`

---

## File Structure

| File                                         | Responsibility                                                                        | Action |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ------ |
| `apps/web/package.json`                      | Add self-hosted font deps                                                             | Modify |
| `apps/web/src/main.tsx`                      | Import font CSS at app entry                                                          | Modify |
| `apps/web/src/index.css`                     | All design tokens (`@theme`), heading font, `:root` surfaces, animation accent colors | Modify |
| `apps/web/src/lib/app/useTheme.ts`           | Force dark-only                                                                       | Modify |
| `apps/web/src/lib/app/useTheme.test.ts`      | Test dark-only behavior                                                               | Create |
| `apps/web/src/components/UserMenu.tsx`       | Remove light/dark toggle UI                                                           | Modify |
| `apps/web/src/components/ui/button.tsx`      | Refine to Cozy Dusk tokens (pattern for other primitives)                             | Modify |
| `apps/web/src/components/ui/button.test.tsx` | Render test for button variants                                                       | Create |
| `apps/web/src/locales/*`                     | Remove now-unused `toggleTheme` key (if present)                                      | Modify |

**Out of scope for this plan (later phases):** Dashboard redesign, Library redesign, per-page reskin sweep, performance/code-splitting. This plan ends with the whole app rendered in Cozy Dusk via inherited tokens + refined core primitives.

---

## Task 1: Self-host fonts (Fraunces + Hanken Grotesk)

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/index.css:39-41` (typography tokens)

- [ ] **Step 1: Add the font packages**

Run:

```bash
cd apps/web && bun add @fontsource-variable/fraunces @fontsource-variable/hanken-grotesk
```

Expected: both packages added to `dependencies` in `apps/web/package.json`, no install errors.

- [ ] **Step 2: Import the font CSS at app entry**

In `apps/web/src/main.tsx`, add these imports at the very top of the file, above the existing imports:

```ts
import "@fontsource-variable/fraunces";
import "@fontsource-variable/hanken-grotesk";
```

These bundle the woff2 files through Vite (self-hosted, no CDN request).

- [ ] **Step 3: Wire the typography tokens**

In `apps/web/src/index.css`, replace the Typography block (currently lines 39-41):

```css
/* Typography */
--font-sans: "Fira Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Fira Code", ui-monospace, monospace;
```

with:

```css
/* Typography */
--font-sans: "Hanken Grotesk Variable", ui-sans-serif, system-ui, sans-serif;
--font-display: "Fraunces Variable", ui-serif, Georgia, serif;
--font-mono: "Fira Code", ui-monospace, monospace;
```

- [ ] **Step 4: Verify the build picks up the fonts**

Run:

```bash
cd apps/web && bun run build
```

Expected: build succeeds; build output includes `.woff2` font assets (no `fonts.googleapis.com` reference anywhere).

- [ ] **Step 5: Confirm Fira Sans is gone as the body font**

Run:

```bash
cd apps/web && grep -rn "Fira Sans" src/ ; echo "exit: $?"
```

Expected: no matches (grep exits non-zero). `Fira Code` for mono may remain.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock apps/web/src/main.tsx apps/web/src/index.css
git commit -m "feat(v3): self-host Fraunces + Hanken Grotesk fonts"
```

---

## Task 2: Force dark-only theme

The app currently toggles `.dark` on `<html>` based on stored preference / OS. Cozy Dusk is dark-only, so `useTheme` must always apply `.dark` and the toggle UI is removed.

**Files:**

- Modify: `apps/web/src/lib/app/useTheme.ts`
- Create: `apps/web/src/lib/app/useTheme.test.ts`
- Modify: `apps/web/src/components/UserMenu.tsx:24,156-158`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/app/useTheme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTheme } from "./useTheme";

describe("useTheme (dark-only)", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("always reports dark", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
  });

  it("applies the dark class to <html> on mount", () => {
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggleTheme is a no-op (stays dark)", () => {
    const { result } = renderHook(() => useTheme());
    result.current.toggleTheme();
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/web && bunx vitest run src/lib/app/useTheme.test.ts
```

Expected: FAIL — current `useTheme` reads `localStorage`/`matchMedia` and can report `isDark === false`; `toggleTheme` flips it.

- [ ] **Step 3: Rewrite useTheme to be dark-only**

Replace the entire contents of `apps/web/src/lib/app/useTheme.ts` with:

```ts
import { useEffect } from "react";

/**
 * Cozy Dusk is dark-only. This hook always applies the dark theme and exposes
 * a no-op toggle so existing call sites keep compiling. (Kept as a hook rather
 * than deleted to avoid a wide refactor in this phase.)
 */
export function useTheme() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  return { isDark: true as const, toggleTheme: () => {} };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/web && bunx vitest run src/lib/app/useTheme.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Remove the theme toggle from UserMenu**

Open `apps/web/src/components/UserMenu.tsx`. Remove the toggle menu item that calls `toggleTheme` (around lines 156-158, the `onClick={toggleTheme}` button with `aria-label={t("common.toggleTheme")}` and its surrounding menu-item markup). Then change line 24 from:

```tsx
const { isDark, toggleTheme } = useTheme();
```

to:

```tsx
useTheme();
```

Remove any now-unused `isDark` references in the JSX (e.g. a sun/moon icon swap). If `isDark` is no longer referenced anywhere in the file, this leaves a single `useTheme();` call that just enforces dark mode on mount.

- [ ] **Step 6: Remove the now-unused i18n key (if present)**

Run:

```bash
cd apps/web && grep -rn "toggleTheme" src/locales/
```

For each match, remove the `toggleTheme` entry from the locale JSON/TS file. If there are no matches, skip.

- [ ] **Step 7: Typecheck + lint**

Run:

```bash
cd apps/web && bun run typecheck && bun run lint
```

Expected: both pass with no errors. (Fix any "unused variable `isDark`/`toggleTheme`" errors surfaced here.)

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/app/useTheme.ts apps/web/src/lib/app/useTheme.test.ts apps/web/src/components/UserMenu.tsx apps/web/src/locales
git commit -m "feat(v3): force dark-only theme, remove light/dark toggle"
```

---

## Task 3: Remap color scales to Cozy Dusk (`@theme`)

This is the core of the reskin. Redefine the `primary` (green → apricot/terracotta) and `neutral` (cold gray → warm brown) scales plus add semantic tokens. Because components use `dark:bg-neutral-800`, `bg-primary-600`, `text-neutral-50`, etc., redefining these scales repaints the whole app.

**Files:**

- Modify: `apps/web/src/index.css:22-42` (the `@theme` block), `:58-77` (`:root` surfaces), and the hardcoded green rgba in animations (`:443,457,491,512-517`).

- [ ] **Step 1: Replace the color tokens in `@theme`**

In `apps/web/src/index.css`, replace the current primary-color block (lines 23-34) with the warm apricot/terracotta ramp **and** add a redefinition of the `neutral` scale plus Cozy Dusk semantic tokens. The `@theme` block becomes:

```css
@theme {
  /* Primary — warm apricot → terracotta (replaces green brand) */
  --color-primary-50: #fdf5ef;
  --color-primary-100: #f9e6d5;
  --color-primary-200: #f2cdab;
  --color-primary-300: #ecb07f;
  --color-primary-400: #e8a06a; /* apricot accent */
  --color-primary-500: #df8753;
  --color-primary-600: #cf6a4e; /* terracotta */
  --color-primary-700: #ad5440;
  --color-primary-800: #8a4435;
  --color-primary-900: #71382e;
  --color-primary-950: #3d1c16;

  /* Neutral — warm brown (replaces cold gray; repaints all dark: surfaces) */
  --color-neutral-50: #f4ece4; /* strong text */
  --color-neutral-100: #e3d8cf; /* text */
  --color-neutral-200: #d4c6b8;
  --color-neutral-300: #b9a89a;
  --color-neutral-400: #9c8d80; /* muted text */
  --color-neutral-500: #6b5c50;
  --color-neutral-600: #463a32; /* muted borders/icons */
  --color-neutral-700: #322a25; /* borders */
  --color-neutral-800: #241e1b; /* raised cards/panels */
  --color-neutral-900: #1c1715; /* app base background */
  --color-neutral-950: #141010; /* deepest wells */

  /* Cozy Dusk semantic tokens (use via arbitrary values, e.g. bg-[--color-surface-raised]) */
  --color-surface-base: #1c1715;
  --color-surface-raised: #241e1b;
  --color-surface-inset: #171311;
  --color-border: #322a25;
  --color-border-strong: #3a2f27;
  --color-accent: #e8a06a;
  --color-accent-strong: #cf6a4e;
  --color-text-strong: #f4ece4;
  --color-text: #e3d8cf;
  --color-text-muted: #9c8d80;

  /* Custom breakpoints */
  --breakpoint-mobile-max: 945px;

  /* Typography */
  --font-sans: "Hanken Grotesk Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Fraunces Variable", ui-serif, Georgia, serif;
  --font-mono: "Fira Code", ui-monospace, monospace;
}
```

(Note: this folds in the Task 1 typography tokens — keep them as shown, do not duplicate.)

- [ ] **Step 2: Update the `:root` legacy surface variables**

In `apps/web/src/index.css`, replace the dark-surface block (currently lines 71-77) with warm equivalents:

```css
/* Dark surfaces — warm Cozy Dusk (aligned with @theme neutral scale) */
--surface-base: #1c1715;
--surface-1: #241e1b;
--surface-2: #322a25;
--surface-border: #322a25;
--surface-muted-fg: #9c8d80;
```

- [ ] **Step 3: Replace hardcoded green accents in animations**

In `apps/web/src/index.css`, the celebration/torrent animations use green `rgba(34, 197, 94, …)` and emerald `rgba(5,150,105,…)`/`rgba(110,231,183,…)`. Replace those accent colors with the apricot accent `rgba(232, 160, 106, …)` (keep the alpha values and the white highlight stops unchanged):

- `@keyframes checkboxRipple` box-shadow stops (lines ~443, 447): `rgba(34, 197, 94, 0.7)` → `rgba(232, 160, 106, 0.7)`, `rgba(34, 197, 94, 0)` → `rgba(232, 160, 106, 0)`.
- `@keyframes rowCompleteFlash` (line ~457): `rgba(34, 197, 94, 0.15)` → `rgba(232, 160, 106, 0.18)`.
- `.checkbox-ripple` background (line ~491): `rgba(34, 197, 94, 0.3)` → `rgba(232, 160, 106, 0.3)`.
- `.torrent-progress-bar-active::after` gradient (lines ~512-517): replace the `rgba(5, 150, 105, …)` stops with `rgba(207, 106, 78, …)` (terracotta), keep the `rgba(255,255,255,0.92)` center stop.
- `.dark .torrent-progress-bar-active::after` gradient (lines ~523-530): replace `rgba(110, 231, 183, …)` stops with `rgba(232, 160, 106, …)`, keep the white center.

- [ ] **Step 4: Build to verify CSS compiles**

Run:

```bash
cd apps/web && bun run build
```

Expected: build succeeds, no Tailwind/CSS errors.

- [ ] **Step 5: Visual verification (the repaint)**

Run the dev app and confirm the whole UI is now warm dark, not cold gray, with apricot/terracotta accents instead of green:

```bash
# from repo root, in separate terminals or backgrounded:
make dev-api
make dev-web
```

Open the app, log in, and eyeball Dashboard + Settings + Chores: backgrounds should be warm brown (`#1c1715`/`#241e1b`), primary buttons apricot/terracotta, no green remaining (except intentional semantic success states). Note any screen that still looks gray/green for the Task 4 audit.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(v3): remap primary+neutral scales to Cozy Dusk warm palette"
```

---

## Task 4: Refine the button primitive + audit hardcoded colors

The scale remap covers classes that reference `primary-*`/`neutral-*`. But some primitives hardcode `white`, `neutral-800` ring-offsets, or non-scale colors that need explicit Cozy Dusk treatment. Button is the highest-traffic primitive and sets the pattern.

**Files:**

- Modify: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/button.test.tsx`

- [ ] **Step 1: Write the failing render test**

Create `apps/web/src/components/ui/button.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders the default (apricot/terracotta) variant", () => {
    render(<Button>Watch</Button>);
    const btn = screen.getByRole("button", { name: "Watch" });
    expect(btn.className).toContain("bg-primary-600");
  });

  it("renders the ghost variant without a solid background", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button", { name: "Ghost" });
    expect(btn.className).not.toContain("bg-primary-600");
  });

  it("does not use a light (white) ring offset", () => {
    render(<Button>Watch</Button>);
    const btn = screen.getByRole("button", { name: "Watch" });
    expect(btn.className).not.toContain("ring-offset-white");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd apps/web && bunx vitest run src/components/ui/button.test.tsx
```

Expected: FAIL on the third assertion — current base classes include `ring-offset-white`.

- [ ] **Step 3: Refine button variants for Cozy Dusk**

In `apps/web/src/components/ui/button.tsx`, replace the `cva(...)` base string and `variant` map (lines 5-21) with:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary-600 text-neutral-950 hover:bg-primary-500",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline:
          "border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700 hover:text-neutral-50",
        secondary: "bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
        ghost: "text-neutral-100 hover:bg-neutral-800 hover:text-neutral-50",
        link: "text-primary-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
        xs: "h-6 rounded px-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

(Dark-only means the `dark:` duplicate classes are no longer needed — the single set above is the dark style. Text on the apricot button is dark brown `neutral-950` for contrast.)

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd apps/web && bunx vitest run src/components/ui/button.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: Audit remaining hardcoded light/green colors**

Run:

```bash
cd apps/web && grep -rn "bg-white\|ring-offset-white\|text-white\b" src/components/ui/ ; \
grep -rn "#22c55e\|#22C55E\|rgba(34, 197, 94" src/ ; echo "done"
```

For each hit in `src/components/ui/` that produces a light surface on a dark-only app (e.g. an input or popover with `bg-white` and no `dark:` counterpart), apply the same treatment as button: drop the `dark:` prefix and use the warm token directly (`bg-neutral-800`, `border-neutral-700`, `text-neutral-100`). Leave intentional semantic colors (red destructive, success greens used as status, not brand) alone. Keep this pass scoped to `src/components/ui/` primitives — full-page audits belong to the later reskin-sweep plan.

- [ ] **Step 6: Typecheck, lint, full test run**

Run:

```bash
cd apps/web && bun run typecheck && bun run lint && bunx vitest run
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat(v3): refine button + ui primitives for Cozy Dusk (dark-only)"
```

---

## Task 5: Apply Fraunces to headings + radius polish

Cozy Dusk uses Fraunces for headings/large numerals and slightly more generous radii. Apply a base layer so headings pick up the display font app-wide without touching each component.

**Files:**

- Modify: `apps/web/src/index.css` (add a base layer after the `@theme` block)

- [ ] **Step 1: Add a base layer for heading typography**

In `apps/web/src/index.css`, after the `@variant dark (...)` line (currently line 45), add:

```css
@layer base {
  h1,
  h2,
  h3,
  .font-display {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  body {
    font-family: var(--font-sans);
    background-color: var(--color-surface-base);
    color: var(--color-text);
  }
}
```

(h4-h6 stay on the sans body font to avoid the serif feeling heavy at small sizes — see spec risk note. Components can opt into the serif via the `.font-display` class.)

- [ ] **Step 2: Build to verify**

Run:

```bash
cd apps/web && bun run build
```

Expected: build succeeds.

- [ ] **Step 3: Visual verification**

Run `make dev-web` (with `make dev-api`) and confirm: page titles / `h1`-`h3` render in Fraunces serif; body text in Hanken Grotesk; base background is warm `#1c1715`. Spot-check that no heading looks broken (missing font / FOUT) on Dashboard and Settings.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(v3): Fraunces headings + warm base typography layer"
```

---

## Final Verification

- [ ] **Run the full web test suite + typecheck + lint:**

```bash
cd apps/web && bunx vitest run && bun run typecheck && bun run lint
```

Expected: all green.

- [ ] **Build the web app:**

```bash
cd apps/web && bun run build
```

Expected: succeeds; bundle includes self-hosted `.woff2`; no `fonts.googleapis.com`, no `Fira Sans`, no green `#22c55e` brand color in source.

- [ ] **Manual smoke (dark-only, warm palette):** Log in and walk Dashboard, Chores, Calendar, Library, Settings. Confirm: warm brown surfaces everywhere, apricot/terracotta accents, Fraunces headings, no light-mode flashes, no leftover green brand accents, no theme toggle in the user menu.

---

## Self-Review Notes

- **Spec coverage:** §1 Design tokens → Tasks 1,3,5. Component system (primitives) → Task 4. Dark-only → Task 2. Self-hosted fonts → Task 1. Green removal → Tasks 3,4. Flagship screens (Dashboard/Library), reskin sweep, and performance are intentionally **separate later plans** (this is Phase 1 of the spec's 5-PR delivery plan).
- **Token consistency:** `--color-neutral-800` = `#241e1b` (raised) and `--color-surface-raised` = `#241e1b` agree; `--color-accent` = `#e8a06a` = `--color-primary-400`; button uses `bg-primary-600` (terracotta) consistently with the ramp.
- **Contrast:** apricot button uses `text-neutral-950` (#141010) for AA contrast on `#cf6a4e`; verify during Task 4 visual check.
- **Risk:** redefining `neutral-*` globally is intentional (the whole point) but may warm a few spots that were meant neutral — caught in Task 3/4 visual checks and the later reskin-sweep plan.
