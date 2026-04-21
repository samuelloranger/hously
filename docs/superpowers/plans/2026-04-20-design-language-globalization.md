# Design Language Globalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the indigo primary palette with green (#22C55E), introduce OLED dark surface tokens, add Fira Code + Fira Sans typography, regenerate brand icons, and set dark as the default theme.

**Architecture:** The canonical theme lives in `apps/web/src/index.css` @theme (Tailwind v4). All files using `primary-*` Tailwind classes automatically inherit the new green palette — no per-file edits needed. New semantic surface tokens go into `:root` for progressive adoption. Font families are registered via @theme. PNG icons are regenerated from the updated SVG using a Bun + sharp script. `tailwind.config.js` is a legacy duplicate — update it to stay in sync but @theme is authoritative.

**Tech Stack:** Tailwind CSS v4 (@theme directive), Google Fonts (Fira Code + Fira Sans), sharp (PNG generation), Bun

---

### Task 1: Replace indigo color ramp with green in `index.css`

**Files:**

- Modify: `apps/web/src/index.css`

The `@theme` block defines `--color-primary-50` through `--color-primary-900` with indigo values. Replace them with the green-500 (#22C55E) family. Also add OLED dark surface tokens to `:root` for components to adopt progressively.

- [ ] **Step 1: Read the current @theme block**

```bash
grep -n "color-primary\|@theme\|:root\|safe-top\|z-modal" apps/web/src/index.css
```

Note the exact line range of the `@theme` block so you can do a precise edit.

- [ ] **Step 2: Replace the primary ramp**

In `apps/web/src/index.css`, within the `@theme { }` block, replace all `--color-primary-*` lines with:

```css
/* Primary colors — green (#22C55E = logo color) */
--color-primary-50: #f0fdf4;
--color-primary-100: #dcfce7;
--color-primary-200: #bbf7d0;
--color-primary-300: #86efac;
--color-primary-400: #4ade80;
--color-primary-500: #22c55e;
--color-primary-600: #16a34a;
--color-primary-700: #15803d;
--color-primary-800: #166534;
--color-primary-900: #14532d;
```

- [ ] **Step 3: Add OLED dark surface tokens to `:root`**

Inside the existing `:root { }` block (alongside `--safe-top`, `--z-modal`, `--z-popover`), add:

```css
/* OLED dark surface palette */
--surface-base: #020617;
--surface-1: #0f172a;
--surface-2: #1e293b;
--surface-border: #334155;
--surface-muted-fg: #94a3b8;
```

- [ ] **Step 4: Add font family tokens to `@theme`**

Inside the `@theme { }` block, add:

```css
/* Typography */
--font-sans: "Fira Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Fira Code", ui-monospace, monospace;
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
cd /home/samuelloranger/sites/hously && make typecheck
```

Expected: passes with 0 errors (CSS changes have no TypeScript impact).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css
git commit -m "chore(design): replace indigo primary ramp with green, add dark surface tokens and font families"
```

---

### Task 2: Sync `tailwind.config.js` legacy entries

**Files:**

- Modify: `apps/web/tailwind.config.js`

`tailwind.config.js` has legacy `primary` color entries that duplicate @theme. Keep them in sync so any tooling that reads the config file doesn't diverge.

- [ ] **Step 1: Update primary colors**

Replace the `colors.primary` object in `apps/web/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
      },
      screens: {
        "mobile-max": "945px",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tailwind.config.js
git commit -m "chore(design): sync tailwind.config.js primary palette to green"
```

---

### Task 3: Add Google Fonts to `index.html`

**Files:**

- Modify: `apps/web/index.html`

The app currently has no Google Fonts. Add Fira Code (monospace, for data/metrics) and Fira Sans (body/labels) with preconnect for performance.

- [ ] **Step 1: Read the current `<head>` block**

```bash
grep -n "link\|meta\|title\|preconnect\|stylesheet" apps/web/index.html
```

Note the line where `<head>` content starts.

- [ ] **Step 2: Add font links before the first `<link>` tag**

In `apps/web/index.html`, add inside `<head>` before the existing link tags:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/index.html
git commit -m "chore(design): add Fira Code + Fira Sans Google Fonts"
```

---

### Task 4: Update brand icon SVG and manifest

**Files:**

- Modify: `apps/web/public/icon.svg`
- Modify: `apps/web/public/manifest.json`

The current icon is a white-background + indigo house. Update to dark navy background + green house to match the new dark-first palette. The house path geometry is unchanged — only fill colors change.

- [ ] **Step 1: Replace `icon.svg`**

Overwrite `apps/web/public/icon.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#0F172A"/>
  <path d="M213.33 426.67v-128h85.33v128h106.67V256h64L256 64 42.67 256h64v170.67z" fill="#22C55E"/>
</svg>
```

- [ ] **Step 2: Update `manifest.json`**

In `apps/web/public/manifest.json`, change:

```json
"background_color": "#0F172A",
"theme_color": "#22C55E",
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/icon.svg apps/web/public/manifest.json
git commit -m "chore(design): update brand icon to green house on dark navy background"
```

---

### Task 5: Write PNG icon generation script and regenerate icons

**Files:**

- Create: `apps/web/scripts/generate-icons.ts`
- Modify: `apps/web/public/icon-512.png`, `apps/web/public/icon-192.png`, `apps/web/public/apple-touch-icon.png`, `apps/web/public/icon-32.png`

PNG icons used by the browser favicon, PWA manifest, push notifications, and the Apple touch icon all need to be regenerated from the updated SVG.

- [ ] **Step 1: Install sharp**

```bash
cd apps/web && bun add -d sharp
```

Expected: `sharp` added to `devDependencies` in `apps/web/package.json`.

- [ ] **Step 2: Create `apps/web/scripts/generate-icons.ts`**

```typescript
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../public");
const svgBuffer = readFileSync(resolve(publicDir, "icon.svg"));

const sizes: Array<{ file: string; size: number }> = [
  { file: "icon-512.png", size: 512 },
  { file: "icon-192.png", size: 192 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-32.png", size: 32 },
];

for (const { file, size } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, file));
  console.log(`✓ Generated ${file} (${size}×${size})`);
}
```

- [ ] **Step 3: Run the script**

```bash
cd apps/web && bun run scripts/generate-icons.ts
```

Expected output:

```
✓ Generated icon-512.png (512×512)
✓ Generated icon-192.png (192×192)
✓ Generated apple-touch-icon.png (180×180)
✓ Generated icon-32.png (32×32)
```

- [ ] **Step 4: Verify visually**

Open `apps/web/public/icon-512.png` — should show a dark navy (#0F172A) rounded square with a green (#22C55E) house silhouette.

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/generate-icons.ts apps/web/public/icon-512.png apps/web/public/icon-192.png apps/web/public/apple-touch-icon.png apps/web/public/icon-32.png apps/web/package.json bun.lockb
git commit -m "chore(design): add icon generation script, regenerate PNG icons with green palette"
```

---

### Task 6: Set dark mode as the default theme

**Files:**

- Find and modify: the theme initialization file (where the `.dark` class is applied to `document.documentElement`)

The app uses class-based dark mode (`.dark` on `<html>`). Currently the default is likely `'light'` or no class. Change the fallback to `'dark'` so new users and users who've never set a preference start in dark mode.

- [ ] **Step 1: Find the theme initialization**

```bash
grep -rn "documentElement\|classList.*dark\|dark.*classList\|localStorage.*theme\|theme.*localStorage\|getTheme\|initTheme\|ThemeProvider\|useTheme" apps/web/src --include="*.ts" --include="*.tsx" -l
```

Then read the relevant file(s) to understand the current logic.

- [ ] **Step 2: Change the default fallback to `'dark'`**

Find the line that reads a theme from localStorage with a fallback (e.g. `?? 'light'` or `|| 'light'`). Change `'light'` to `'dark'`:

```typescript
// Before
const theme = localStorage.getItem("theme") ?? "light";

// After
const theme = localStorage.getItem("theme") ?? "dark";
```

The exact shape depends on what you find in Step 1. Apply only the fallback change — do not restructure the logic.

- [ ] **Step 3: Verify**

Start the dev server:

```bash
make dev-web
```

Open the app in an incognito window (no localStorage). The app should launch in dark mode.

- [ ] **Step 4: Commit**

```bash
git add <the file(s) you changed>
git commit -m "chore(design): default theme to dark mode"
```

---

### Task 7: Lint, typecheck, and visual verification

- [ ] **Step 1: Run lint**

```bash
make lint
```

Expected: 0 errors. If the new `scripts/generate-icons.ts` triggers lint errors for being outside `src/`, either add it to the lint ignore list or fix per the linter's guidance.

- [ ] **Step 2: Run typecheck**

```bash
make typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Start the full dev stack and verify visually**

```bash
make dev-api   # Terminal 1
make dev-web   # Terminal 2
```

Open `http://localhost:5173` and verify:

- [ ] App launches in dark mode by default (no `.dark` class manually required)
- [ ] Sidebar active nav item is green, not indigo
- [ ] Primary buttons are green
- [ ] Focus rings are green
- [ ] Browser tab favicon shows the green house on dark background
- [ ] Body text renders in Fira Sans (use DevTools → Computed → font-family to confirm)
- [ ] Any `font-mono` element (server stats, torrent sizes, tracker ratios) renders in Fira Code

- [ ] **Step 4: Final commit if any last-minute fixups were needed**

```bash
git add -p   # stage only what changed
git commit -m "chore(design): final design language fixups"
```

---

### Task 8: Redesign form controls — Input, Select, Popover

**Files:**

- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/ui/select.tsx`
- Modify: `apps/web/src/components/ui/popover.tsx`

**Concept — "Terminal Input" aesthetic:** At rest, controls show a dark surface with a muted slate border. On focus, the **left border animates to green** with a faint glow — like a terminal cursor. Matching the ops/command-center identity. The Select is upgraded from a native `<select>` (unthemeable on Windows/Chrome dark mode) to a full Radix-powered custom dropdown.

- [ ] **Step 1: Install `@radix-ui/react-select`**

```bash
cd apps/web && bun add @radix-ui/react-select
```

Expected: package added to `dependencies` in `apps/web/package.json`.

- [ ] **Step 2: Rewrite `apps/web/src/components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md px-3 py-2 text-sm",
          "bg-[var(--surface-1)]",
          "border border-[var(--surface-border)] border-l-2 border-l-[var(--surface-border)]",
          "text-slate-100 placeholder:text-[var(--surface-muted-fg)]",
          "focus:outline-none focus:border-l-primary-500 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.08)]",
          "transition-all duration-150",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "[&[type=number]]:font-mono [&[type=search]]:font-mono",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 3: Rewrite `apps/web/src/components/ui/select.tsx`**

```tsx
import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = RadixSelect.Root;
const SelectValue = RadixSelect.Value;
const SelectGroup = RadixSelect.Group;
const SelectLabel = RadixSelect.Label;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-sm",
      "bg-[var(--surface-1)]",
      "border border-[var(--surface-border)] border-l-2 border-l-[var(--surface-border)]",
      "text-slate-100",
      "focus:outline-none focus:border-l-primary-500 focus:shadow-[0_0_0_3px_rgba(34,197,94,0.08)]",
      "transition-all duration-150",
      "disabled:cursor-not-allowed disabled:opacity-40",
      className,
    )}
    {...props}
  >
    {children}
    <RadixSelect.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-[var(--surface-muted-fg)]" />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
));
SelectTrigger.displayName = RadixSelect.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      className={cn(
        "relative z-[var(--z-popover)] overflow-hidden rounded-md",
        "bg-[var(--surface-1)] border border-[var(--surface-border)]",
        "shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <RadixSelect.Viewport
        className={cn(
          "p-1",
          position === "popper" && "min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </RadixSelect.Viewport>
    </RadixSelect.Content>
  </RadixSelect.Portal>
));
SelectContent.displayName = RadixSelect.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-sm",
      "text-slate-300 outline-none",
      "hover:bg-[var(--surface-2)] hover:text-slate-100",
      "data-[state=checked]:text-primary-400",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      "transition-colors duration-100",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <RadixSelect.ItemIndicator>
        <Check className="size-3 text-primary-500" />
      </RadixSelect.ItemIndicator>
    </span>
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
  </RadixSelect.Item>
));
SelectItem.displayName = RadixSelect.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(({ className, ...props }, ref) => (
  <RadixSelect.Separator
    ref={ref}
    className={cn("my-1 h-px bg-[var(--surface-border)]", className)}
    {...props}
  />
));
SelectSeparator.displayName = RadixSelect.Separator.displayName;

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
};
```

- [ ] **Step 4: Update existing `Select` call sites**

The old `Select` was a native `<select>` — call sites used it like:

```tsx
<Select value={val} onChange={(e) => setVal(e.target.value)}>
  <option value="a">Option A</option>
</Select>
```

The new Radix `Select` has a different API. Find all usages:

```bash
grep -rn "from \"@/components/ui/select\"\|from '@/components/ui/select'" apps/web/src --include="*.tsx" -l
```

For each file, migrate to the new API:

```tsx
// Before
<Select value={val} onChange={e => setVal(e.target.value)}>
  <option value="a">Option A</option>
</Select>

// After
<Select value={val} onValueChange={setVal}>
  <SelectTrigger>
    <SelectValue placeholder="Choose..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
  </SelectContent>
</Select>
```

Key API differences:

- `onChange` → `onValueChange` (receives the value string directly, not an event)
- `<option>` → `<SelectItem value="...">`
- Trigger and Content are now separate components
- `value` prop stays on `<Select>` root

- [ ] **Step 5: Update `apps/web/src/components/ui/popover.tsx`**

Find the `PopoverContent` className and replace the background/border utilities:

```bash
grep -n "bg-white\|dark:bg-neutral\|border-neutral" apps/web/src/components/ui/popover.tsx
```

Replace the background and border classes with:

```
bg-[var(--surface-1)] border-[var(--surface-border)] shadow-[0_8px_32px_rgba(0,0,0,0.6)]
```

Remove any `dark:` variants from the same line — these tokens are dark-only by design.

- [ ] **Step 6: Run typecheck to catch any Select migration errors**

```bash
make typecheck
```

Fix any type errors in call sites (most common: `onChange` vs `onValueChange`, missing `SelectTrigger`/`SelectContent` wrappers).

- [ ] **Step 7: Visual spot-check in dev**

```bash
make dev-web
```

Open a page with form controls (Settings → any plugin section, or the Create Chore form). Verify:

- [ ] Input border-left turns green on focus with faint glow
- [ ] Input background is dark surface (not white or neutral-800)
- [ ] Number inputs render in Fira Code
- [ ] Select trigger matches Input visually (same height, same left-accent border)
- [ ] Select dropdown is a dark panel with green checkmark on selected item
- [ ] Popover panels match the same dark surface + border as the dropdown

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ui/input.tsx \
        apps/web/src/components/ui/select.tsx \
        apps/web/src/components/ui/popover.tsx \
        apps/web/package.json bun.lockb \
        $(grep -rl "from \"@/components/ui/select\"" apps/web/src --include="*.tsx")
git commit -m "chore(design): terminal-input form controls — left-accent focus border, Radix Select, dark surface popover"
```
