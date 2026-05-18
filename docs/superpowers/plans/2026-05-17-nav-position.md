# Nav Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to set their preferred global navigation position (left / right / top / bottom), stored per-user in the database and applied across devices.

**Architecture:** A `nav_position` column is added to the `User` DB model and exposed via the existing profile PUT endpoint. A `useNavPosition` hook reads from the cached auth query and optimistically mutates on change. `Sidebar.tsx` accepts a `position` prop and renders a vertical rail (left/right) or horizontal bar (top/bottom). `__root.tsx` wires the hook and adjusts the content offset padding to match.

**Tech Stack:** Prisma, Elysia (Bun), TanStack Query, React, Tailwind CSS, Vitest (web tests), Bun test (API tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `apps/shared/src/types/user.ts` | Add `NavPosition` type; extend `User` + `UpdateProfileRequest` |
| Modify | `apps/api/prisma/schema.prisma` | Add `navPosition` column to `User` model |
| Modify | `apps/api/src/utils/mappers.ts` | Include `nav_position` in `mapUser` output |
| Modify | `apps/api/src/services/userProfileService.ts` | Accept + persist `nav_position` |
| Modify | `apps/api/src/routes/users/index.ts` | Add `nav_position` to Elysia body schema |
| Create | `apps/web/src/pages/settings/useNavPosition.ts` | Optimistic read/write hook |
| Create | `apps/web/src/components/NavPositionPicker.tsx` | 4-option picker (settings + popover) |
| Modify | `apps/web/src/components/Sidebar.tsx` | `position` prop, orientation, right-click popover |
| Modify | `apps/web/src/pages/__root.tsx` | Wire `useNavPosition`, adjust content padding |
| Modify | `apps/web/src/pages/settings/_component/ProfileTab.tsx` | Navigation section with picker |

---

## Task 1: NavPosition shared type

**Files:**
- Modify: `apps/shared/src/types/user.ts`

- [ ] **Step 1: Add `NavPosition` and update interfaces**

Open `apps/shared/src/types/user.ts`. Add `NavPosition` and extend the two interfaces:

```ts
export type NavPosition = "left" | "right" | "top" | "bottom";

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  locale?: string | null;
  last_login: string | null;
  created_at: string;
  last_activity: string | null;
  avatar_url?: string | null;
  has_passkey?: boolean;
  nav_position?: NavPosition | null;  // ← add this line
}

// ...UserResponse and UsersResponse stay unchanged...

export interface UpdateProfileRequest {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
  nav_position?: NavPosition | null;  // ← add this line
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /path/to/repo && make typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/shared/src/types/user.ts
git commit -m "feat(shared): add NavPosition type and nav_position to User + UpdateProfileRequest"
```

---

## Task 2: Prisma schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add column to User model**

Open `apps/api/prisma/schema.prisma`. Inside the `model User { ... }` block (after `avatarUrl`), add:

```prisma
navPosition             String?   @map("nav_position")
```

- [ ] **Step 2: Run the migration**

```bash
make migrate-dev
```

When prompted for a migration name, enter: `add_nav_position_to_users`

Expected: migration file created, database updated.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add nav_position column to users table"
```

---

## Task 3: API — expose and accept nav_position

**Files:**
- Modify: `apps/api/src/utils/mappers.ts`
- Modify: `apps/api/src/services/userProfileService.ts`
- Modify: `apps/api/src/routes/users/index.ts`
- Test: `apps/api/src/__tests__/mappers.test.ts` (create)

- [ ] **Step 1: Write failing test for mapUser**

Create `apps/api/src/__tests__/mappers.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { mapUser } from "@hously/api/utils/mappers";

const baseUser = {
  id: "u1",
  email: "a@b.com",
  firstName: "A",
  lastName: "B",
  isAdmin: false,
  locale: null,
  lastLogin: null,
  createdAt: new Date("2024-01-01"),
  lastActivity: null,
  avatarUrl: null,
  navPosition: null,
};

describe("mapUser", () => {
  it("returns nav_position as null when not set", () => {
    const result = mapUser(baseUser);
    expect(result.nav_position).toBe(null);
  });

  it("returns nav_position value when set", () => {
    const result = mapUser({ ...baseUser, navPosition: "bottom" });
    expect(result.nav_position).toBe("bottom");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/api && bun test src/__tests__/mappers.test.ts
```

Expected: FAIL — `nav_position` is undefined on result.

- [ ] **Step 3: Update `mapUser` in `apps/api/src/utils/mappers.ts`**

Add `navPosition: string | null` to the input type and `nav_position` to the output:

```ts
export const mapUser = (
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isAdmin: boolean | null;
    locale: string | null;
    lastLogin: Date | null;
    createdAt: Date | null;
    lastActivity: Date | null;
    avatarUrl: string | null;
    navPosition: string | null;  // ← add
  },
  options?: { hasPasskey?: boolean },
) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  locale: user.locale ?? null,
  last_login: user.lastLogin?.toISOString() ?? null,
  created_at: user.createdAt?.toISOString() ?? new Date().toISOString(),
  last_activity: user.lastActivity?.toISOString() ?? null,
  avatar_url: user.avatarUrl || null,
  nav_position: user.navPosition ?? null,  // ← add
  has_passkey:
    typeof options === "object" && options
      ? (options.hasPasskey ?? false)
      : false,
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/api && bun test src/__tests__/mappers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update `UserProfileUpdateInput` in `apps/api/src/services/userProfileService.ts`**

Add `nav_position` to the input type:

```ts
export type UserProfileUpdateInput = {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
  nav_position?: string | null;  // ← add
};
```

- [ ] **Step 6: Update `updateUserProfile` validation**

In `updateUserProfile`, the guard that returns an error when no fields are provided needs to include `nav_position`:

```ts
const { first_name, last_name, locale, nav_position } = input;

if (
  first_name === undefined &&
  last_name === undefined &&
  locale === undefined &&
  nav_position === undefined  // ← add
) {
  return {
    ok: false,
    status: 400,
    error: "At least one field must be provided",
  };
}
```

Then pass it to `updateUserProfileFields`:

```ts
const user = await updateUserProfileFields(
  userId,
  {
    first_name,
    last_name,
    locale,
    nav_position,  // ← add
  },
  existing,
);
```

- [ ] **Step 7: Update `updateUserProfileFields` to persist `nav_position`**

In `updateUserProfileFields`, extend `updateData` and the mapping block:

```ts
const updateData: Partial<{
  firstName: string | null;
  lastName: string | null;
  locale: string | null;
  navPosition: string | null;  // ← add
}> = {};

if (input.first_name !== undefined) {
  updateData.firstName = input.first_name;
}
if (input.last_name !== undefined) {
  updateData.lastName = input.last_name;
}
if (input.locale !== undefined) {
  updateData.locale = input.locale;
}
if (input.nav_position !== undefined) {  // ← add block
  updateData.navPosition = input.nav_position;
}
```

- [ ] **Step 8: Add `nav_position` to the Elysia body schema in `apps/api/src/routes/users/index.ts`**

Find the `.put("/me", ...)` handler body schema and add the field:

```ts
{
  body: t.Object({
    first_name: t.Optional(t.Union([t.String(), t.Null()])),
    last_name: t.Optional(t.Union([t.String(), t.Null()])),
    locale: t.Optional(t.Union([t.String(), t.Null()])),
    nav_position: t.Optional(           // ← add
      t.Union([
        t.Literal("left"),
        t.Literal("right"),
        t.Literal("top"),
        t.Literal("bottom"),
        t.Null(),
      ]),
    ),
  }),
}
```

- [ ] **Step 9: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/utils/mappers.ts apps/api/src/services/userProfileService.ts \
        apps/api/src/routes/users/index.ts apps/api/src/__tests__/mappers.test.ts
git commit -m "feat(api): expose and accept nav_position on user profile"
```

---

## Task 4: useNavPosition hook

**Files:**
- Create: `apps/web/src/pages/settings/useNavPosition.ts`
- Test: `apps/web/src/pages/settings/__tests__/useNavPosition.test.ts` (create)

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/settings/__tests__/useNavPosition.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNavPosition } from "@/pages/settings/useNavPosition";
import { queryKeys } from "@/lib/queryKeys";

// Minimal wrapper providing a QueryClient with seeded cache
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

function makeWrapper(navPosition: string | null | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.auth.me, navPosition !== undefined ? { nav_position: navPosition } : null);
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe("useNavPosition", () => {
  it("defaults to 'left' when nav_position is null", () => {
    const { result } = renderHook(() => useNavPosition(), {
      wrapper: makeWrapper(null),
    });
    expect(result.current.position).toBe("left");
  });

  it("defaults to 'left' when user cache is empty", () => {
    const { result } = renderHook(() => useNavPosition(), {
      wrapper: makeWrapper(undefined),
    });
    expect(result.current.position).toBe("left");
  });

  it("returns the stored position when set", () => {
    const { result } = renderHook(() => useNavPosition(), {
      wrapper: makeWrapper("bottom"),
    });
    expect(result.current.position).toBe("bottom");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/web && bun run test src/pages/settings/__tests__/useNavPosition.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/pages/settings/useNavPosition.ts`:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { USERS_ENDPOINTS } from "@/lib/endpoints";
import type { NavPosition, User, UserResponse } from "@hously/shared/types";

export function useNavPosition() {
  const queryClient = useQueryClient();
  const fetcher = useFetcher();

  const user = queryClient.getQueryData<User | null>(queryKeys.auth.me);
  const position: NavPosition = (user?.nav_position as NavPosition) ?? "left";

  function setPosition(next: NavPosition) {
    // Optimistic update
    queryClient.setQueryData<User | null>(queryKeys.auth.me, (prev) =>
      prev ? { ...prev, nav_position: next } : prev,
    );

    fetcher<UserResponse>(USERS_ENDPOINTS.ME, {
      method: "PUT",
      body: { nav_position: next },
    }).finally(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    });
  }

  return { position, setPosition };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/web && bun run test src/pages/settings/__tests__/useNavPosition.test.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/settings/useNavPosition.ts \
        apps/web/src/pages/settings/__tests__/useNavPosition.test.ts
git commit -m "feat(web): add useNavPosition hook with optimistic update"
```

---

## Task 5: NavPositionPicker component

**Files:**
- Create: `apps/web/src/components/NavPositionPicker.tsx`

This component is a small 4-button picker used in both the settings page and the sidebar popover.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/NavPositionPicker.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { NavPosition } from "@hously/shared/types";

const POSITIONS: { value: NavPosition; label: string; icon: string }[] = [
  { value: "left", label: "Left", icon: "⬛▪️▪️▪️" },
  { value: "right", label: "Right", icon: "▪️▪️▪️⬛" },
  { value: "top", label: "Top", icon: "⬛⬛⬛⬛" },
  { value: "bottom", label: "Bottom", icon: "▪️▪️▪️▪️" },
];

// Simple layout preview using div blocks
function LayoutPreview({ value }: { value: NavPosition }) {
  const isHorizontal = value === "top" || value === "bottom";
  const isReversed = value === "right" || value === "bottom";

  const shell = cn("flex gap-0.5 w-10 h-7 rounded overflow-hidden border border-neutral-200 dark:border-neutral-600", {
    "flex-row": !isHorizontal,
    "flex-col": isHorizontal,
    "flex-row-reverse": value === "right",
    "flex-col-reverse": value === "bottom",
  });

  const rail = cn("bg-neutral-400 dark:bg-neutral-500 rounded-sm", {
    "w-2 h-full": !isHorizontal,
    "h-1.5 w-full": isHorizontal,
  });

  return (
    <div className={shell}>
      <div className={rail} />
      <div className="flex-1 bg-neutral-100 dark:bg-neutral-700 rounded-sm" />
    </div>
  );
}

interface NavPositionPickerProps {
  value: NavPosition;
  onChange: (position: NavPosition) => void;
}

export function NavPositionPicker({ value, onChange }: NavPositionPickerProps) {
  return (
    <div className="flex gap-2">
      {POSITIONS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors text-xs font-medium",
            value === p.value
              ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
              : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-600",
          )}
        >
          <LayoutPreview value={p.value} />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/NavPositionPicker.tsx
git commit -m "feat(web): add NavPositionPicker component"
```

---

## Task 6: Sidebar — position-aware refactor

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Test: `apps/web/src/components/__tests__/Sidebar.test.tsx` (create)

The sidebar is currently a fixed left `w-60` vertical panel on desktop + a separate fixed top bar on mobile. This task adds a `position` prop that controls desktop placement and orientation. Mobile behaviour (top bar) is unchanged.

- [ ] **Step 1: Write failing test for section label visibility**

Create `apps/web/src/components/__tests__/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";
import type { NavPosition } from "@hously/shared/types";

// Mock heavy dependencies
vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "a@b.com", first_name: "A", is_admin: false } }),
}));
vi.mock("@/lib/routing/navigation", () => ({
  navSections: [
    {
      label: "Life",
      items: [{ label: "Dashboard", href: "/", icon: () => null }],
    },
  ],
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function renderSidebar(position: NavPosition) {
  return render(<Sidebar position={position} />);
}

describe("Sidebar section labels", () => {
  it("shows section label for left position", () => {
    renderSidebar("left");
    expect(screen.queryAllByText("Life").length).toBeGreaterThan(0);
  });

  it("hides section label for top position", () => {
    renderSidebar("top");
    // section labels are hidden — only icon elements render in horizontal mode
    // The nav link itself should still exist but the section heading should not
    const headings = screen.queryAllByText("Life");
    expect(headings.length).toBe(0);
  });

  it("hides section label for bottom position", () => {
    renderSidebar("bottom");
    const headings = screen.queryAllByText("Life");
    expect(headings.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/web && bun run test src/components/__tests__/Sidebar.test.tsx
```

Expected: FAIL — `position` prop not accepted yet.

- [ ] **Step 3: Add `position` prop and orientation logic to `Sidebar.tsx`**

At the top of `Sidebar.tsx`, add the import and update the props interface:

```ts
import type { NavPosition } from "@hously/shared/types";
import { NavPositionPicker } from "@/components/NavPositionPicker";
import { useNavPosition } from "@/pages/settings/useNavPosition";

interface SidebarProps {
  onOpenQuickActions?: () => void;
  position: NavPosition;
}
```

Add a helper just inside the component function body, before the return:

```ts
const isHorizontal = position === "top" || position === "bottom";
```

- [ ] **Step 4: Update the desktop `<aside>` wrapper classes**

Replace the current `<aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 ...">` with a dynamic version:

```tsx
<aside
  className={cn(
    "hidden lg:flex fixed z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl theme-transition",
    {
      // Vertical rail (left / right)
      "left-0 top-0 bottom-0 w-60 flex-col border-r border-neutral-950/[0.06] dark:border-white/[0.08]":
        position === "left",
      "right-0 top-0 bottom-0 w-60 flex-col border-l border-neutral-950/[0.06] dark:border-white/[0.08]":
        position === "right",
      // Horizontal bar (top / bottom)
      "top-0 left-0 right-0 h-12 flex-row items-center border-b border-neutral-950/[0.06] dark:border-white/[0.08]":
        position === "top",
      "bottom-0 left-0 right-0 h-12 flex-row items-center border-t border-neutral-950/[0.06] dark:border-white/[0.08]":
        position === "bottom",
    },
  )}
>
```

- [ ] **Step 5: Hide section labels and item text on horizontal positions**

Find the section label `<span>` (around line 125) and wrap it:

```tsx
{!isHorizontal && (
  <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
    {t(section.label)}
  </span>
)}
```

Find the nav item label `<span className="relative z-10">` (around line 166) and conditionally render:

```tsx
{!isHorizontal && <span className="relative z-10">{item.label}</span>}
```

For horizontal nav, the items also need to flow in a row. Wrap the sections `<nav>` appropriately:

```tsx
<nav
  className={cn(
    isHorizontal
      ? "flex flex-row items-center gap-1 px-2 flex-1 overflow-x-auto"
      : "flex-1 overflow-y-auto px-3 py-2 space-y-5",
  )}
>
```

- [ ] **Step 6: Add right-click popover to the desktop `<aside>`**

Add state and handler near the top of the component:

```ts
const { setPosition } = useNavPosition();
const [popoverOpen, setPopoverOpen] = useState(false);
const [popoverCoords, setPopoverCoords] = useState({ x: 0, y: 0 });

function handleContextMenu(e: React.MouseEvent) {
  e.preventDefault();
  setPopoverCoords({ x: e.clientX, y: e.clientY });
  setPopoverOpen(true);
}
```

Add `onContextMenu={handleContextMenu}` to the `<aside>` element.

Add the popover just before the closing `</aside>`:

```tsx
{popoverOpen && (
  <>
    <div
      className="fixed inset-0 z-[60]"
      onClick={() => setPopoverOpen(false)}
    />
    <div
      className="fixed z-[61] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-3"
      style={{ left: popoverCoords.x, top: popoverCoords.y }}
    >
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 px-1">
        Navigation position
      </p>
      <NavPositionPicker
        value={position}
        onChange={(p) => {
          setPosition(p);
          setPopoverOpen(false);
        }}
      />
    </div>
  </>
)}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd apps/web && bun run test src/components/__tests__/Sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx \
        apps/web/src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(web): make Sidebar position-aware with right-click popover"
```

---

## Task 7: Root layout wiring

**Files:**
- Modify: `apps/web/src/pages/__root.tsx`

- [ ] **Step 1: Import `useNavPosition` and wire position into `__root.tsx`**

Add the import:

```ts
import { useNavPosition } from "@/pages/settings/useNavPosition";
```

Inside `RootLayout`, call the hook:

```ts
const { position } = useNavPosition();
```

Pass `position` to `<Sidebar>`:

```tsx
{shouldShowNav && (
  <Sidebar
    position={position}
    onOpenQuickActions={() => setIsQuickActionsOpen(true)}
  />
)}
```

- [ ] **Step 2: Switch content offset padding based on position**

Replace the static `"lg:pl-60"` with a position-aware value. Add a helper map:

```ts
const contentPadding: Record<typeof position, string> = {
  left: "lg:pl-60",
  right: "lg:pr-60",
  top: "lg:pt-12",
  bottom: "lg:pb-12",
};
```

Use it on the content wrapper:

```tsx
<div className={shouldShowNav ? contentPadding[position] : ""}>
```

- [ ] **Step 3: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/__root.tsx
git commit -m "feat(web): wire nav position into root layout shell"
```

---

## Task 8: Settings — Navigation section

**Files:**
- Modify: `apps/web/src/pages/settings/_component/ProfileTab.tsx`

- [ ] **Step 1: Add Navigation section to `ProfileTab.tsx`**

Add imports at the top:

```ts
import { NavPositionPicker } from "@/components/NavPositionPicker";
import { useNavPosition } from "@/pages/settings/useNavPosition";
import { Monitor } from "lucide-react";
```

Inside the `ProfileTab` function, call the hook:

```ts
const { position, setPosition } = useNavPosition();
```

Add the Navigation card after the existing profile card (before `<PasskeysSection />`):

```tsx
<div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
  <div className="flex items-center gap-2 mb-4">
    <Monitor size={16} className="text-neutral-500" />
    <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
      Navigation
    </h3>
  </div>
  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
    Choose where the navigation rail appears on desktop.
  </p>
  <NavPositionPicker value={position} onChange={setPosition} />
</div>
```

- [ ] **Step 2: Typecheck**

```bash
make typecheck
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
make test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/settings/_component/ProfileTab.tsx
git commit -m "feat(web): add navigation position picker to profile settings"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Data layer (Prisma, mapUser, service, route body) — Tasks 1–3
  - `useNavPosition` hook with optimistic update — Task 4
  - `NavPositionPicker` component — Task 5
  - Sidebar orientation + section label hiding + right-click popover — Task 6
  - Root layout flex switching + content offset — Task 7
  - Settings page navigation section — Task 8
- [x] **No placeholders** — all code blocks are complete
- [x] **Type consistency** — `NavPosition` defined once in Task 1, imported everywhere else; `position` prop matches across Sidebar → root → hook
- [x] **Mobile** — mobile top bar untouched; position prop only affects `lg:` desktop rendering
