# Replace UI Emojis with Lucide Icons

**Date:** 2026-04-14  
**Status:** Approved

## Summary

Replace all emoji used as UI chrome with `lucide-react` icons across the web app. Emoji used as user-selected data (habit emoji picker, stored habit emojis on cards) and emotion emojis in `EmotionModal` are explicitly excluded.

## Scope

### Excluded (do not touch)
- `pages/habits/_component/EmojiPicker.tsx` — user-facing emoji palette (data, not decoration)
- Rendered habit emoji on cards (user-selected content stored in the DB)
- `pages/habits/_component/CreateHabitForm.tsx:25` — `💧` default emoji state value (initial value for the emoji picker, not UI chrome)
- `components/EmotionModal.tsx` — face emojis (😢, 😅, 😐, 🥵, 😄, 🔥) carry semantic meaning not replaceable with icons
- Translation file keys in `locales/en/common.json` and `locales/fr/common.json` that use emoji as keys for emotion labels

### Included (all other UI emoji)
Navigation, action buttons, status indicators, notification/activity type icons, media type indicators, auth pages, settings/jobs tab, sidebar, user menu, quick action palette.

---

## Architecture

`lucide-react` is already installed (`^1.7.0`). No new dependencies required.

---

## Section 1: Type System Changes

### 1a. `apps/web/src/lib/routing/navigation.ts`

**Current:** `NavItem` has `icon: LucideIcon` and a deprecated optional `mobileIcon?: string` field (no emoji values remain, already cleaned up in a prior PR).

**Change:** Remove the deprecated `mobileIcon?: string` field from the `NavItem` interface and its `@deprecated` JSDoc comment.

**Consuming components to update:**
- `components/QuickActionPalette.tsx:78` — remove any reference to `item.mobileIcon` (already uses `item.icon` after prior cleanup)

### 1b. `apps/web/src/pages/activity/_component/activityPresentation.ts`

**Current:** `ActivityPresentation.icon: string` — emoji strings returned by `getActivityPresentation`.

**Change:**
- Add `import type { LucideIcon } from "lucide-react"` and import each icon used
- Rename field: `icon: string` → `Icon: LucideIcon` (capital `I` — React component convention)
- Return lucide component references instead of emoji strings in all branches of `getActivityPresentation`
- File stays `.ts` — no JSX, just component references

**Consuming components to update:**
- `pages/settings/_component/RecentActivityTab.tsx:137` — `{activity.icon}` → `<activity.Icon className="w-4 h-4" />`
- `pages/activity/_component/RecentActivityPage.tsx:149` — same

---

## Section 2: Component-Level Replacements

For each file: import the relevant lucide icons and replace inline emoji with `<Icon className="w-4 h-4" />` (adjust size class to match surrounding context).

### Navigation & Shell

| File | Emoji | Icon |
|------|-------|------|
| `components/Sidebar.tsx` | ☀️ / 🌙 | `Sun` / `Moon` |
| `components/QuickActionPalette.tsx` | 🔔 / ⚙️ / ☀️ / 🌙 / 🧲 / 🎬 / 📺 / 👤 / ✅ / 🛒 / 📋 | `Bell` / `Settings` / `Sun` / `Moon` / `Magnet` / `Clapperboard` / `Tv` / `User` / `CheckCircle` / `ShoppingCart` / `ClipboardList` |

### Notifications & Activity

| File | Emoji | Icon |
|------|-------|------|
| `components/NotificationMenuRow.tsx` | ⏰ / 📡 / ✨ / 🖥️ / ✅ / 🛒 / 📅 / ⚙️ / 🎯 / 🌱 | `Clock` / `Radio` / `Sparkles` / `Monitor` / `CheckCircle` / `ShoppingCart` / `Calendar` / `Settings` / `Target` / `Leaf` |
| `activityPresentation.ts` (via type change) | ✨ / 🛠️ / ⏭️ / 🔌 / ❌ / ✅ / 📅 / 🧹 / 🛒 / ⬇️ | `Sparkles` / `Wrench` / `SkipForward` / `Plug` / `XCircle` / `CheckCircle` / `Calendar` / `Eraser` / `ShoppingCart` / `Download` |
| `pages/activity/_component/RecentActivityPage.tsx` | ⏰ | `Clock` |
| `pages/settings/_component/RecentActivityTab.tsx` | ⏰ | `Clock` |

### Chores

| File | Emoji | Icon |
|------|-------|------|
| `pages/chores/_component/ChoreRow.tsx` | 🔁 / 🗑️ / 👤 / 👥 / ✅ / ⏰ | `RefreshCw` / `Trash2` / `User` / `Users` / `CheckCircle` / `Clock` |
| `pages/chores/_component/ChoresList.tsx` | ✅ | `CheckCircle` |
| `pages/chores/_component/RecurrenceBadge.tsx` | 🔁 | `RefreshCw` |
| `pages/chores/_component/CreateChoreForm.tsx` | ➕ | `Plus` |

### Habits

| File | Emoji | Icon |
|------|-------|------|
| `pages/habits/_component/HabitCard.tsx` | ✏️ / ↩️ / 🗑️ | `Pencil` / `Undo2` / `Trash2` |
| `pages/habits/_component/StreakBadge.tsx` | 🔥 | `Flame` |
| `pages/habits/_component/HabitsList.tsx` | 🎯 | `Target` |
| `pages/habits/_component/CreateHabitForm.tsx` | 💧 (default emoji) | `Droplets` |

### Shopping

| File | Emoji | Icon |
|------|-------|------|
| `pages/shopping/_component/ShoppingItemRow.tsx` | 🗑️ / ✅ | `Trash2` / `CheckCircle` |
| `pages/shopping/_component/ShoppingList.tsx` | 🛒 | `ShoppingCart` |

### Media

| File | Emoji | Icon |
|------|-------|------|
| `pages/_component/MediaShelves.tsx` | 🎬 / 📺 / 💿 / 🎧 / 🎞️ | `Clapperboard` / `Tv` / `Disc` / `Headphones` / `Film` |
| `components/MediaPosterCard.tsx` | 🎞️ | `Film` |
| `pages/medias/_component/DiscoverPanel.tsx` | 🇺🇸 / 🇫🇷 | `Globe` (+ existing text label) |
| `pages/medias/_component/WatchlistPage.tsx` | 🎞️ / 🔖 | `Film` / `Bookmark` |
| `pages/medias/_component/CollectionsPage.tsx` | 🎬 | `Clapperboard` |
| `pages/medias/_component/ExplorePage.tsx` | 🧭 | `Compass` |
| `pages/medias/_component/NativeLibraryPage.tsx` | 🎞️ / 🎬 | `Film` / `Clapperboard` |
| `pages/medias/_component/MediaDetailInfoSections.tsx` | 👤 | `User` |
| `pages/medias/_component/ExploreCardDetailDialog.tsx` | 🎬 / 👤 | `Clapperboard` / `User` |
| `pages/medias/_component/ExploreCard.tsx` | 🎞️ | `Film` |
| `pages/medias/_component/LibraryItemHero.tsx` | 🎬 | `Clapperboard` |
| `pages/medias/_component/LibraryItemInfoTab.tsx` | 👤 | `User` |

### Calendar

| File | Emoji | Icon |
|------|-------|------|
| `pages/calendar/_component/Calendar.tsx` | 📅 / 🎞️ | `Calendar` / `Film` |

### Settings & Jobs

| File | Emoji | Icon |
|------|-------|------|
| `pages/settings/_component/JobsTab.tsx` | ⏰ / 📆 / 🧘 / 🧹 / 🧾 / 🎥 / 🔥 / 🎬 / 🎞️ / 📺 / 🔄 / ⬇️ / ⏱️ | `Clock` / `Calendar` / `Activity` / `Eraser` / `FileText` / `Film` / `Flame` / `Clapperboard` / `Film` / `Tv` / `RefreshCw` / `Download` / `Timer` |

### Board

| File | Emoji | Icon |
|------|-------|------|
| `features/board/BoardView.tsx` | 📋 | `ClipboardList` |

### Notifications

| File | Emoji | Icon |
|------|-------|------|
| `components/NotificationPermissionModal.tsx` | 🔔 | `Bell` |
| `pages/notifications/_component/NotificationsPage.tsx` | 🔔 | `Bell` |

### Torrents

| File | Emoji | Icon |
|------|-------|------|
| `pages/torrents/_component/index.tsx` | 🧲 | `Magnet` |

### Home

| File | Emoji | Icon |
|------|-------|------|
| `pages/_component/HomePanel.tsx` | ✅ | `CheckCircle` |

### Auth

| File | Emoji | Icon |
|------|-------|------|
| `pages/forgot-password.tsx` | ✉️ / 🔑 | `Mail` / `Key` |
| `pages/reset-password.tsx` | ⚠️ / 🔐 | `AlertTriangle` / `Lock` |

---

## Implementation Notes

- **Icon sizing:** Match surrounding context. Default to `w-4 h-4` for inline icons, `w-5 h-5` for standalone/prominent ones. Check existing icon usage in the same component for consistency.
- **`activityPresentation.ts`:** Because it now imports lucide components, add them at the top of the file alongside the type import.
- **`navigation.ts` mobileIcon removal:** After removing the field, TypeScript will surface all consumers — fix them before the build passes.
- **No new abstraction layers:** Import icons directly in each file. Do not create an icon registry or `DynamicIcon` wrapper.
- **Test mocks:** `test-utils/mocks.ts:56` has a `🛒` — update it to match whatever the production component now uses (or remove if irrelevant to the test).

---

## Files Changed (summary)

~30 `.tsx` files + 2 `.ts` structural files (`activityPresentation.ts`, `navigation.ts`)

No changes to:
- `components/EmotionModal.tsx`
- `pages/habits/_component/EmojiPicker.tsx`
- `locales/*.json` emotion keys
- `apps/api/` or `apps/shared/`
