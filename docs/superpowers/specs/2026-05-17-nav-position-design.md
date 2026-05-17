# Nav Position — Design Spec

**Date:** 2026-05-17  
**Status:** Approved

## Overview

Allow users to choose where the global navigation rail is anchored: left (current default), right, top, or bottom. The preference is stored per-user in the database and synced across devices. Users can change the position from the settings page or via a right-click shortcut on the sidebar itself.

---

## 1. Data Layer

### Prisma schema

Add a nullable `nav_position` column to the `User` model:

```prisma
navPosition String? @map("nav_position")
```

Accepted values: `"left"` | `"right"` | `"top"` | `"bottom"`. `null` is treated as `"left"` by the frontend — no migration needed for existing users.

### Shared type

Add `NavPosition` to `apps/shared/src/types/`:

```ts
export type NavPosition = "left" | "right" | "top" | "bottom";
```

Export it from `apps/shared/src/index.ts`.

### API

- The existing user profile endpoint (`GET /api/user/profile`) must include `nav_position` in its response.
- The existing user profile update endpoint (`PATCH /api/user/profile`) must accept and persist `nav_position`.
- Map DB `navPosition` → snake_case `nav_position` in the response body.

---

## 2. `useNavPosition` Hook

**Location:** `apps/web/src/features/settings/hooks/useNavPosition.ts`

- Reads `nav_position` from the cached user profile query (TanStack Query) — no extra network request.
- Returns `position: NavPosition` (defaults to `"left"` when `nav_position` is null).
- Exposes `setPosition(p: NavPosition): void` which:
  1. Applies an optimistic update to the user profile query cache immediately.
  2. Fires `PATCH /api/user/profile` with `{ nav_position: p }`.
  3. Invalidates the user profile query on settle (success or error) so the cache stays consistent.

---

## 3. Sidebar Component

**File:** `apps/web/src/components/Sidebar.tsx`

### Props change

```ts
interface SidebarProps {
  position: NavPosition; // new — fed from useNavPosition in __root.tsx
}
```

### Orientation

| Position | Flex direction | Shape |
|----------|---------------|-------|
| `left`   | column        | 60px-wide vertical rail (current) |
| `right`  | column        | 60px-wide vertical rail, mirrored |
| `top`    | row           | 48px-tall horizontal bar |
| `bottom` | row           | 48px-tall horizontal bar |

The `Sidebar` component renders the correct orientation based on `position`. It does **not** set its own `position: fixed` — placement is controlled by the root layout.

### Section labels

`Life` and `Homelab` section labels are hidden when `position` is `top` or `bottom` (no vertical space). Icons only.

### Quick-change shortcut

Right-click (desktop) or long-press (touch) on the sidebar body opens a small popover listing the 4 position options. Each option calls `setPosition`. The popover closes on selection or outside click.

---

## 4. Root Layout (`__root.tsx`)

- Calls `useNavPosition()` at the root level.
- Passes `position` to `<Sidebar position={position} />`.
- Switches the app shell flex configuration:

| Position | Shell class |
|----------|-------------|
| `left`   | `flex-row` — sidebar left, content right |
| `right`  | `flex-row-reverse` — sidebar right, content left |
| `top`    | `flex-col` — sidebar top, content below |
| `bottom` | `flex-col-reverse` — sidebar bottom, content above |

- **Mobile breakpoint (`< lg`):** The nav position preference is ignored. The existing mobile top bar renders unconditionally regardless of the user's setting.

---

## 5. Settings Page

- Add a **Navigation** section to the settings page (under appearance/UI preferences).
- Renders a segmented 4-option picker (Left / Right / Top / Bottom) with small wireframe icon previews matching the mockup style.
- Calls `setPosition` on selection — optimistic update means the layout repositions instantly.
- No save button needed.

---

## Out of Scope

- Expanded/labeled sidebar mode (icon + text labels) — separate feature.
- Mobile position preference — mobile always uses the top bar.
- Animated transition between positions — can be added later.
