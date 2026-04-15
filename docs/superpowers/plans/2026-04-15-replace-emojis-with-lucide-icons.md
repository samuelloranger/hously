# Replace UI Emojis with Lucide Icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all UI-chrome emojis with `lucide-react` icons across ~30 web app files, leaving only user-selected habit emojis and EmotionModal face emojis untouched.

**Architecture:** Structural type changes (PageHeader, ActionMenu, activityPresentation, JobsTab, MediaPosterCard) must land first since they drive TypeScript errors in callers. Inline emoji replacements in components follow independently.

**Tech Stack:** React 19, lucide-react ^1.7.0 (already installed), TypeScript, Bun

---

## Verification command

After each task run:
```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
```
Expected output: no errors.

---

## Task 1: `PageHeader` — change `icon` prop from `string` to `LucideIcon`

`PageHeader` renders `{icon}` as raw text. We change its prop to a component reference and render `<Icon />`.

**Files:**
- Modify: `apps/web/src/components/PageHeader.tsx`
- Modify: `apps/web/src/pages/chores/_component/ChoresList.tsx`
- Modify: `apps/web/src/pages/shopping/_component/ShoppingList.tsx`
- Modify: `apps/web/src/pages/calendar/_component/Calendar.tsx`
- Modify: `apps/web/src/pages/habits/_component/HabitsList.tsx`
- Modify: `apps/web/src/features/board/BoardView.tsx`
- Modify: `apps/web/src/pages/torrents/_component/index.tsx`
- Modify: `apps/web/src/pages/notifications/_component/NotificationsPage.tsx`
- Modify: `apps/web/src/pages/activity/_component/RecentActivityPage.tsx`
- Modify: `apps/web/src/pages/settings/_component/RecentActivityTab.tsx`

- [ ] **Step 1: Update `PageHeader.tsx`**

Replace the interface and render logic:

```tsx
// apps/web/src/components/PageHeader.tsx
import { RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
  actions?: ReactNode;
}
```

In the desktop layout, replace `{icon}` (line 77) with:
```tsx
<div
  className={cn(
    "flex h-10 w-10 items-center justify-center rounded-xl",
    iconBg(iconColor),
  )}
>
  <Icon className={cn("w-5 h-5", iconColor)} />
</div>
```

Rename the destructured prop `icon` → `icon: Icon` in the function signature:
```tsx
export function PageHeader({
  icon: Icon,
  iconColor = "text-neutral-600",
  ...
}: PageHeaderProps) {
```

- [ ] **Step 2: Update `ChoresList.tsx`**

Add import and change `icon` prop:
```tsx
import { ListChecks } from "lucide-react";
// ...
<PageHeader
  icon={ListChecks}
  iconColor="text-green-600"
  // ... rest unchanged
```

- [ ] **Step 3: Update `ShoppingList.tsx`**

```tsx
import { ShoppingCart } from "lucide-react";
// ...
<PageHeader
  icon={ShoppingCart}
  iconColor="text-blue-600"
  // ... rest unchanged
```

- [ ] **Step 4: Update `HabitsList.tsx`**

```tsx
import { Target } from "lucide-react";
// ...
<PageHeader
  icon={Target}
  iconColor="text-orange-600"
  // ...
```

Also replace the habits link icon (line 180) `🎯` → `<Target size={16} />` (add import if not already present).

- [ ] **Step 5: Update `Calendar.tsx`**

```tsx
import { CalendarIcon } from "lucide-react";
// ...
<PageHeader
  icon={CalendarIcon}
  iconColor="text-blue-600"
  // ...
```

Also replace both inline `🎞️` release poster fallbacks (lines 476, 639) with `<Film size={12} />`. Add `Film` to the lucide import.

- [ ] **Step 6: Update `BoardView.tsx`**

```tsx
import { LayoutGrid } from "lucide-react";
// ...
<PageHeader
  icon={LayoutGrid}
  iconColor="text-neutral-600"
  // ...
```

Also replace `📋` (line 532) with `<LayoutGrid size={16} />` if it appears outside PageHeader.

- [ ] **Step 7: Update `torrents/index.tsx`**

Add `Magnet` to existing lucide imports:
```tsx
import { Magnet, /* other existing imports */ } from "lucide-react";
// ...
<PageHeader
  icon={Magnet}
  iconColor="text-blue-600"
  // ...
```

Replace the two other `icon="🧲"` props (lines 345, 351 — these are on non-PageHeader components, check context) with lucide icon renders. Replace the large empty-state `🧲` (line 764):
```tsx
<Magnet className="w-8 h-8 opacity-20" />
```

- [ ] **Step 8: Update `NotificationsPage.tsx`**

```tsx
import { Bell } from "lucide-react";
// ...
<PageHeader
  icon={Bell}
  iconColor="text-blue-600"
  // ...
```

- [ ] **Step 9: Update `RecentActivityPage.tsx`**

```tsx
import { Clock } from "lucide-react";
// ...
<PageHeader
  icon={Clock}
  iconColor="text-blue-600"
  // ...
```

Also replace `⏰` on line 188 (sub-section icon) with `<Clock size={14} className="inline-block" />`.

- [ ] **Step 10: Update `RecentActivityTab.tsx`**

```tsx
import { Clock } from "lucide-react";
// ...
<PageHeader
  icon={Clock}
  iconColor="text-neutral-600"
  // ...
```

- [ ] **Step 11: Typecheck**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
```
Expected: 0 errors.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/components/PageHeader.tsx \
  apps/web/src/pages/chores/_component/ChoresList.tsx \
  apps/web/src/pages/shopping/_component/ShoppingList.tsx \
  apps/web/src/pages/calendar/_component/Calendar.tsx \
  apps/web/src/pages/habits/_component/HabitsList.tsx \
  apps/web/src/features/board/BoardView.tsx \
  apps/web/src/pages/torrents/_component/index.tsx \
  apps/web/src/pages/notifications/_component/NotificationsPage.tsx \
  apps/web/src/pages/activity/_component/RecentActivityPage.tsx \
  apps/web/src/pages/settings/_component/RecentActivityTab.tsx
git commit -m "refactor(ui): replace emoji in PageHeader and all callers with lucide icons"
```

---

## Task 2: `ActionMenu` — change `icon` from `string` to `React.ReactNode`

**Files:**
- Modify: `apps/web/src/components/ActionMenu.tsx`
- Modify: `apps/web/src/pages/chores/_component/ChoreRow.tsx`
- Modify: `apps/web/src/pages/habits/_component/HabitCard.tsx`
- Modify: `apps/web/src/pages/shopping/_component/ShoppingItemRow.tsx`

- [ ] **Step 1: Update `ActionMenu.tsx`**

Change the interface (the render `{item.icon}` stays the same):
```tsx
import type { ReactNode } from "react";

interface ActionMenuItem {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
}
```

- [ ] **Step 2: Update `ChoreRow.tsx`**

Add lucide imports:
```tsx
import { RefreshCw, Trash2, User, Users, CheckCircle, Clock } from "lucide-react";
```

Replace the menu items array (in the `menuItems` / actions array building):
```tsx
{
  label: t("chores.complete"),
  icon: <CheckCircle size={16} />,
  onClick: () => { void handleToggle(); },
  variant: "success" as const,
},
// recurrence item:
{
  label: t("chores.removeRecurrence") || "Retirer la récurrence",
  icon: <RefreshCw size={16} />,
  // ...
},
// delete item:
{
  label: t("chores.delete"),
  icon: <Trash2 size={16} />,
  // ...
  variant: "danger" as const,
},
```

Replace the inline emoji spans (lines ~205–236):
```tsx
// 👤 assigned to one person
<User size={14} className="mr-1 inline-block" />

// 👥 anyone
<Users size={14} className="mr-1 inline-block" />

// ✅ completed by
<CheckCircle size={14} className="mr-1 inline-block" />

// ⏰ reminder
<Clock size={14} className="mr-1 inline-block" />
```

Remove the old `<span className="mr-1">emoji</span>` wrappers.

- [ ] **Step 3: Update `HabitCard.tsx`**

Add lucide imports:
```tsx
import { Pencil, Undo2, Trash2 } from "lucide-react";
```

Replace menu items:
```tsx
{ label: t("habits.edit"), icon: <Pencil size={16} />, ... },
{ label: t("habits.undoToday"), icon: <Undo2 size={16} />, ..., variant: "default" as const },
{ label: t("habits.delete"), icon: <Trash2 size={16} />, ..., variant: "danger" as const },
```

- [ ] **Step 4: Update `ShoppingItemRow.tsx`**

Add lucide import:
```tsx
import { Trash2 } from "lucide-react";
```

Replace the delete menu item:
```tsx
{ label: t("shopping.delete"), icon: <Trash2 size={16} />, ..., variant: "danger" as const },
```

Also replace the `✅` completion icon (line 297). Check its context and replace with `<CheckCircle size={16} />`.

- [ ] **Step 5: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/components/ActionMenu.tsx \
  apps/web/src/pages/chores/_component/ChoreRow.tsx \
  apps/web/src/pages/habits/_component/HabitCard.tsx \
  apps/web/src/pages/shopping/_component/ShoppingItemRow.tsx
git commit -m "refactor(ui): replace emoji in ActionMenu and callers with lucide icons"
```

---

## Task 3: `activityPresentation.ts` — change `icon: string` to `Icon: LucideIcon`

**Files:**
- Modify: `apps/web/src/pages/activity/_component/activityPresentation.ts`
- Modify: `apps/web/src/pages/settings/_component/RecentActivityTab.tsx`
- Modify: `apps/web/src/pages/activity/_component/RecentActivityPage.tsx`

- [ ] **Step 1: Rewrite `activityPresentation.ts`**

```ts
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Wrench,
  SkipForward,
  Plug,
  XCircle,
  CheckCircle,
  Calendar,
  Eraser,
  ShoppingCart,
  Download,
} from "lucide-react";
import type { Locale } from "date-fns";
import type { TFunction } from "i18next";
import type { Activity } from "@hously/shared/types";
import { formatRelativeTime } from "@/lib/utils/relativeTime";

export interface ActivityPresentation {
  Icon: LucideIcon;
  description: string;
  time: string;
  type: string;
  typeLabel: string;
  service: string;
  serviceLabel: string;
}
```

Then replace every `icon: "emoji"` with `Icon: IconComponent` throughout the function:
- `icon: "✨"` → `Icon: Sparkles`
- `icon: "🛠️"` → `Icon: Wrench`
- `icon: "⏭️"` → `Icon: SkipForward`
- `icon: "🔌"` → `Icon: Plug`
- `icon: activity.success === false ? "❌" : "✅"` → `Icon: activity.success === false ? XCircle : CheckCircle`
- `icon: "📅"` → `Icon: Calendar`
- `icon: "🧹"` → `Icon: Eraser`
- `icon: "🛒"` → `Icon: ShoppingCart`
- `icon: "⬇️"` → `Icon: Download`
- `const icon = activity.task_type === "shopping" ? "🛒" : "✅"` → `const Icon = activity.task_type === "shopping" ? ShoppingCart : CheckCircle`

- [ ] **Step 2: Update `RecentActivityTab.tsx`**

Find `{activity.icon}` (line 137) and replace with:
```tsx
<activity.Icon className="w-4 h-4" />
```

- [ ] **Step 3: Update `RecentActivityPage.tsx`**

Find `{activity.icon}` (line 149) and replace with:
```tsx
<activity.Icon className="w-4 h-4" />
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/pages/activity/_component/activityPresentation.ts \
  apps/web/src/pages/settings/_component/RecentActivityTab.tsx \
  apps/web/src/pages/activity/_component/RecentActivityPage.tsx
git commit -m "refactor(ui): replace emoji in activityPresentation with lucide icon references"
```

---

## Task 4: `NotificationMenuRow.tsx` — replace emoji in `typeConfig`

**Files:**
- Modify: `apps/web/src/components/NotificationMenuRow.tsx`

- [ ] **Step 1: Replace emoji in `typeConfig`**

```tsx
import { cn } from "@/lib/utils";
import {
  Clock,
  Radio,
  Sparkles,
  Monitor,
  CheckCircle,
  ShoppingCart,
  Calendar,
  Settings,
  Target,
  Leaf,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "@hously/shared/types";

const typeConfig: Record<
  NotificationType,
  { Icon: LucideIcon; bg: string }
> = {
  reminder:        { Icon: Clock,         bg: "bg-amber-100 dark:bg-amber-900/30" },
  external:        { Icon: Radio,         bg: "bg-blue-100 dark:bg-blue-900/30" },
  "app-update":    { Icon: Sparkles,      bg: "bg-violet-100 dark:bg-violet-900/30" },
  service_monitor: { Icon: Monitor,       bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  chore:           { Icon: CheckCircle,   bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  shopping:        { Icon: ShoppingCart,  bg: "bg-sky-100 dark:bg-sky-900/30" },
  event:           { Icon: Calendar,      bg: "bg-rose-100 dark:bg-rose-900/30" },
  system:          { Icon: Settings,      bg: "bg-neutral-100 dark:bg-neutral-700/60" },
  habit:           { Icon: Target,        bg: "bg-orange-100 dark:bg-orange-900/30" },
};
```

Update `getTypeStyle` return type and the cross-seed special case:
```tsx
export function getTypeStyle(notification: {
  type: NotificationType;
  metadata?: Record<string, unknown> | null;
}): { Icon: LucideIcon | null; img?: string; bg: string } {
  if (notification.type === "external" && notification.metadata?.service_name) {
    const serviceName = notification.metadata.service_name as string;
    if (serviceName === "cross-seed") {
      return { Icon: Leaf, bg: "bg-emerald-100 dark:bg-emerald-900/30" };
    }
    if (serviceName === "jellyfin") {
      return {
        Icon: null,
        img: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jellyfin.png",
        bg: "bg-violet-100 dark:bg-violet-900/30",
      };
    }
    if (serviceName === "kopia") {
      return {
        Icon: null,
        img: "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/kopia.png",
        bg: "bg-green-100 dark:bg-green-900/30",
      };
    }
  }
  return typeConfig[notification.type] ?? typeConfig.system;
}
```

Update the render in `NotificationMenuRow` (line 99):
```tsx
<div
  className={cn(
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
    style.bg,
  )}
>
  {style.img ? (
    <img src={style.img} className="w-[18px] h-[18px] object-contain" alt="" />
  ) : style.Icon ? (
    <style.Icon className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
  ) : null}
</div>
```

- [ ] **Step 2: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/components/NotificationMenuRow.tsx
git commit -m "refactor(ui): replace emoji in NotificationMenuRow with lucide icons"
```

---

## Task 5: `JobsTab.tsx` — replace emoji in `JOBS` config

**Files:**
- Modify: `apps/web/src/pages/settings/_component/JobsTab.tsx`

- [ ] **Step 1: Add missing lucide imports**

The file already imports some lucide icons. Add the missing ones:
```tsx
import {
  ChevronDown,
  ChevronRight,
  Play,
  RotateCcw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Timer,
  // NEW:
  Calendar,
  Activity,
  Eraser,
  FileText,
  Film,
  Flame,
  Clapperboard,
  Tv,
  RefreshCw,
  Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
```

- [ ] **Step 2: Update `JobConfig` type and `JOBS` array**

Change the type:
```ts
type JobConfig = {
  action: JobAction;
  jobNames: string[];
  Icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
};
```

Replace the `JOBS` array:
```ts
const JOBS: JobConfig[] = [
  { action: "check_reminders",                jobNames: ["check-reminders"],                    Icon: Clock,        labelKey: "settings.jobs.actions.checkReminders.label",                  descriptionKey: "settings.jobs.actions.checkReminders.description" },
  { action: "check_all_day_events",           jobNames: ["check-all-day-events"],               Icon: Calendar,     labelKey: "settings.jobs.actions.checkAllDayEvents.label",               descriptionKey: "settings.jobs.actions.checkAllDayEvents.description" },
  { action: "check_habit_reminders",          jobNames: ["check-habit-reminders"],              Icon: Activity,     labelKey: "settings.jobs.actions.checkHabitReminders.label",             descriptionKey: "settings.jobs.actions.checkHabitReminders.description" },
  { action: "cleanup_notifications",          jobNames: ["cleanup-notifications"],              Icon: Eraser,       labelKey: "settings.jobs.actions.cleanupNotifications.label",            descriptionKey: "settings.jobs.actions.cleanupNotifications.description" },
  { action: "fetch_c411_stats",               jobNames: ["fetch-c411-stats"],                   Icon: FileText,     labelKey: "settings.jobs.actions.fetchC411Stats.label",                  descriptionKey: "settings.jobs.actions.fetchC411Stats.description" },
  { action: "fetch_torr9_stats",              jobNames: ["fetch-torr9-stats"],                  Icon: FileText,     labelKey: "settings.jobs.actions.fetchTorr9Stats.label",                 descriptionKey: "settings.jobs.actions.fetchTorr9Stats.description" },
  { action: "fetch_la_cale_stats",            jobNames: ["fetch-la-cale-stats"],                Icon: FileText,     labelKey: "settings.jobs.actions.fetchLaCaleStats.label",                descriptionKey: "settings.jobs.actions.fetchLaCaleStats.description" },
  { action: "refresh_upcoming",               jobNames: ["refresh-upcoming"],                   Icon: Film,         labelKey: "settings.jobs.actions.refreshUpcoming.label",                 descriptionKey: "settings.jobs.actions.refreshUpcoming.description" },
  { action: "refresh_habits_streaks",         jobNames: ["refresh-habits-streaks"],             Icon: Flame,        labelKey: "settings.jobs.actions.refreshHabitsStreaks.label",            descriptionKey: "settings.jobs.actions.refreshHabitsStreaks.description" },
  { action: "check_movie_release_reminders",  jobNames: ["check-movie-release-reminders"],      Icon: Clapperboard, labelKey: "settings.jobs.actions.checkMovieReleaseReminders.label",      descriptionKey: "settings.jobs.actions.checkMovieReleaseReminders.description" },
  { action: "check_library_movie_releases",   jobNames: ["check-library-movie-releases"],       Icon: Film,         labelKey: "settings.jobs.actions.checkLibraryMovieReleases.label",       descriptionKey: "settings.jobs.actions.checkLibraryMovieReleases.description" },
  { action: "check_library_episode_releases", jobNames: ["check-library-episode-releases"],     Icon: Tv,           labelKey: "settings.jobs.actions.checkLibraryEpisodeReleases.label",     descriptionKey: "settings.jobs.actions.checkLibraryEpisodeReleases.description" },
  { action: "sync_library_show_episodes",     jobNames: ["sync-library-show-episodes"],         Icon: RefreshCw,    labelKey: "settings.jobs.actions.syncLibraryShowEpisodes.label",          descriptionKey: "settings.jobs.actions.syncLibraryShowEpisodes.description" },
  { action: "check_library_download_completion", jobNames: ["check-library-download-completion"], Icon: Download,   labelKey: "settings.jobs.actions.checkLibraryDownloadCompletion.label",  descriptionKey: "settings.jobs.actions.checkLibraryDownloadCompletion.description" },
];
```

- [ ] **Step 3: Update the render (line ~609–627)**

Replace:
```tsx
const icon = config?.icon ?? "⏱️";
// ...
<span className="text-xl">{icon}</span>
```

With:
```tsx
const JobIcon = config?.Icon ?? Timer;
// ...
<JobIcon className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/pages/settings/_component/JobsTab.tsx
git commit -m "refactor(ui): replace emoji in JobsTab job config with lucide icons"
```

---

## Task 6: `navigation.ts` — remove deprecated `mobileIcon` field

**Files:**
- Modify: `apps/web/src/lib/routing/navigation.ts`

- [ ] **Step 1: Remove `mobileIcon` from the interface**

The field was already cleared of emoji values in a prior PR. Remove the deprecated field entirely:

```ts
export interface NavItem {
  path: string;
  translationKey: string;
  icon: LucideIcon;
}
```

Remove the `/** @deprecated ... */` comment and the `mobileIcon?: string;` line.

- [ ] **Step 2: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/lib/routing/navigation.ts
git commit -m "refactor(ui): remove deprecated mobileIcon field from NavItem"
```

---

## Task 7: `Sidebar.tsx` and `QuickActionPalette.tsx` — inline emoji replacements

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Modify: `apps/web/src/components/QuickActionPalette.tsx`

- [ ] **Step 1: Update `Sidebar.tsx`**

Add lucide imports:
```tsx
import { Sun, Moon } from "lucide-react";
```

Replace the theme toggle (line 257):
```tsx
// Before:
<span className="text-sm">{isDark ? "☀️" : "🌙"}</span>

// After:
{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
```

- [ ] **Step 2: Update `QuickActionPalette.tsx`**

Add lucide imports (file already imports `Search, Sparkles`):
```tsx
import {
  Search,
  Sparkles,
  Bell,
  Settings,
  Sun,
  Moon,
  RefreshCw,
  Magnet,
  Clapperboard,
  Tv,
  CheckCircle,
  Eraser,
  ShoppingCart,
  User,
  LayoutGrid,
  CircleDot,
  AlertCircle,
  ClipboardList,
} from "lucide-react";
```

Replace each inline emoji string with a JSX element. The `QuickAction.icon` field is typed as `string | React.ReactNode`, so JSX elements work without a type change:

```tsx
// notifications action (line 96):
icon: <Bell size={20} />,

// settings action (line 110):
icon: <Settings size={20} />,

// theme toggle (line 122):
icon: isDark ? <Sun size={20} /> : <Moon size={20} />,

// refresh action (line 135) — currently "↻", not a real emoji but replace anyway:
icon: <RefreshCw size={20} />,

// torrent results (line 190):
icon: <Magnet size={20} />,

// media results (line 213):
icon: item.type === "movie" ? <Clapperboard size={20} /> : <Tv size={20} />,

// chore results (line 231):
icon: chore.completed ? <CheckCircle size={20} /> : <Eraser size={20} />,

// shopping results (line 243):
icon: item.completed ? <CheckCircle size={20} /> : <ShoppingCart size={20} />,

// user results (line 255):
icon: <User size={20} />,

// board task results (lines 275–282):
icon:
  task.status === "done"
    ? <CheckCircle size={20} />
    : task.priority === "urgent"
      ? <CircleDot size={20} className="text-red-500" />
      : task.priority === "high"
        ? <AlertCircle size={20} className="text-orange-500" />
        : <ClipboardList size={20} />,
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/components/Sidebar.tsx \
  apps/web/src/components/QuickActionPalette.tsx
git commit -m "refactor(ui): replace emoji in Sidebar and QuickActionPalette with lucide icons"
```

---

## Task 8: `MediaPosterCard.tsx` and `MediaShelves.tsx` — poster fallback

**Files:**
- Modify: `apps/web/src/components/MediaPosterCard.tsx`
- Modify: `apps/web/src/pages/_component/MediaShelves.tsx`

- [ ] **Step 1: Update `MediaPosterCard.tsx`**

Change the `fallbackEmoji` prop to `FallbackIcon`:

```tsx
import { Film } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// In the props type:
export type MediaPosterCardProps = {
  // ...
  FallbackIcon?: LucideIcon;
  // ... (remove fallbackEmoji)
};

// In the function signature:
export function MediaPosterCard({
  // ...
  FallbackIcon = Film,
  // ...
}: MediaPosterCardProps) {
```

Update the render (line 119):
```tsx
{/* Fallback */}
{!showImage && (
  <div className="absolute inset-0 flex items-center justify-center text-white/40">
    <FallbackIcon className="w-10 h-10" />
  </div>
)}
```

No callers pass `fallbackEmoji` explicitly, so no call sites need updating.

- [ ] **Step 2: Update `MediaShelves.tsx`**

Update the local `PosterCard` component's `fallback` prop and the `mediaFallback` function:

```tsx
import { Clapperboard, Tv, Disc, Headphones, Film } from "lucide-react";
import type { LucideIcon } from "lucide-react";
```

Change the `PosterCard` props interface:
```tsx
{
  // ...
  fallback: LucideIcon;
  // ...
}
```

Change the fallback render (line 51):
```tsx
<div className="flex h-full w-full items-center justify-center bg-zinc-200 dark:bg-zinc-700">
  <FallbackIcon className="w-8 h-8 text-zinc-400" />
</div>
```

Rename destructured prop `fallback` → `fallback: FallbackIcon` in PosterCard function signature.

Update `mediaFallback` function:
```tsx
const mediaFallback = (type: string | null): LucideIcon => {
  const map: Record<string, LucideIcon> = {
    movie: Clapperboard,
    episode: Tv,
    musicalbum: Disc,
    audio: Headphones,
  };
  return (type && map[type.toLowerCase()]) ?? Film;
};
```

Update the two `fallback={...}` call sites in the JSX:
```tsx
// line ~196:
fallback={mediaFallback(item.item_type)}

// line ~300:
fallback={item.media_type === "movie" ? Clapperboard : Tv}
```

- [ ] **Step 3: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/components/MediaPosterCard.tsx \
  apps/web/src/pages/_component/MediaShelves.tsx
git commit -m "refactor(ui): replace fallback emoji in MediaPosterCard and MediaShelves with lucide icons"
```

---

## Task 9: Media page components

**Files:**
- Modify: `apps/web/src/pages/medias/_component/ExploreCard.tsx`
- Modify: `apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryItemHero.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryItemInfoTab.tsx`
- Modify: `apps/web/src/pages/medias/_component/WatchlistPage.tsx`
- Modify: `apps/web/src/pages/medias/_component/CollectionsPage.tsx`
- Modify: `apps/web/src/pages/medias/_component/NativeLibraryPage.tsx`
- Modify: `apps/web/src/pages/medias/_component/DiscoverPanel.tsx`

- [ ] **Step 1: `ExploreCard.tsx`**

Add import: `import { Film } from "lucide-react";`

Replace the inline `🎞️` fallback (line 111):
```tsx
<div className="absolute inset-0 flex items-center justify-center text-white/10">
  <Film className="w-10 h-10" />
</div>
```

- [ ] **Step 2: `ExploreCardDetailDialog.tsx`**

Add imports: `import { Clapperboard, User } from "lucide-react";`

Replace `🎬` (line 267) with `<Clapperboard size={16} />`.
Replace `👤` (line 727) with `<User size={14} />`.

- [ ] **Step 3: `LibraryItemHero.tsx`**

Add import: `import { Clapperboard } from "lucide-react";`

Replace `🎬` (line 140) with `<Clapperboard size={16} />`.

- [ ] **Step 4: `LibraryItemInfoTab.tsx`**

Add import: `import { User } from "lucide-react";`

Replace `👤` (line 87) with `<User size={14} />`.

- [ ] **Step 5: `WatchlistPage.tsx`**

Add imports: `import { Film, Bookmark } from "lucide-react";`

Replace `🎞️` (line 76) with `<Film size={16} />`.
Replace `🔖` (line 146) with `<Bookmark size={16} />`.

- [ ] **Step 6: `CollectionsPage.tsx`**

Add import: `import { Clapperboard } from "lucide-react";`

Replace all three `🎬` instances (lines 49, 93, 148) with `<Clapperboard size={16} />`.
For the PageHeader caller (line 148), this is already covered by Task 1 — verify it was handled there.

- [ ] **Step 7: `NativeLibraryPage.tsx`**

The file already imports lucide icons. Add `Clapperboard` if not present.
Replace `🎞️` PageHeader icon → already done in Task 1.
Replace `🎬` collections link icon (line 295) with `<Clapperboard size={16} />`.

- [ ] **Step 8: `DiscoverPanel.tsx`**

Find the language array:
```tsx
{ code: "en", flag: "🇺🇸", label: "EN" },
{ code: "fr", flag: "🇫🇷", label: "FR" },
```

Remove the `flag` field and replace the flag render (line ~327 `<span>{lf.flag}</span>`) with the `label` text that already exists, or with a `<Globe size={14} />` icon. Since labels ("EN" / "FR") are already in the array, simply remove `flag` from the data and render the `label`:

```tsx
// Update the data array:
const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
];

// Update the render to just show lf.label (already present)
```

Import `Globe` only if you use it in the UI, otherwise just rely on the text label.

- [ ] **Step 9: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add \
  apps/web/src/pages/medias/_component/ExploreCard.tsx \
  apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx \
  apps/web/src/pages/medias/_component/LibraryItemHero.tsx \
  apps/web/src/pages/medias/_component/LibraryItemInfoTab.tsx \
  apps/web/src/pages/medias/_component/WatchlistPage.tsx \
  apps/web/src/pages/medias/_component/CollectionsPage.tsx \
  apps/web/src/pages/medias/_component/NativeLibraryPage.tsx \
  apps/web/src/pages/medias/_component/DiscoverPanel.tsx
git commit -m "refactor(ui): replace emoji in media page components with lucide icons"
```

---

## Task 10: Chores — `RecurrenceBadge` and remaining `ChoresList` emoji

**Files:**
- Modify: `apps/web/src/pages/chores/_component/RecurrenceBadge.tsx`
- Modify: `apps/web/src/pages/chores/_component/ChoresList.tsx` (any remaining emoji not from PageHeader)

- [ ] **Step 1: `RecurrenceBadge.tsx`**

Add import: `import { RefreshCw } from "lucide-react";`

Replace `🔁` with `<RefreshCw size={12} />`.

- [ ] **Step 2: Check `ChoresList.tsx` for remaining emoji**

Check line 110 for any `✅` outside PageHeader. If present, replace with `<CheckCircle size={16} />`.

- [ ] **Step 3: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/pages/chores/_component/RecurrenceBadge.tsx \
  apps/web/src/pages/chores/_component/ChoresList.tsx
git commit -m "refactor(ui): replace emoji in chore components with lucide icons"
```

---

## Task 11: Habits — `StreakBadge` and `HabitsList`

**Files:**
- Modify: `apps/web/src/pages/habits/_component/StreakBadge.tsx`
- Modify: `apps/web/src/pages/habits/_component/HabitsList.tsx`

- [ ] **Step 1: `StreakBadge.tsx`**

Add import: `import { Flame } from "lucide-react";`

Replace:
```tsx
// Before:
<span role="img" aria-label="streak">
  🔥
</span>

// After:
<Flame className="w-4 h-4 text-orange-500" aria-label="streak" />
```

Remove the `role="img"` wrapper `<span>` since the icon itself is the visual.

- [ ] **Step 2: `HabitsList.tsx`**

The `icon="🎯"` was the PageHeader prop — already replaced in Task 1.
Check line 180 for a remaining `🎯` habits link icon. Replace with `<Target size={16} />`. The file already imports `Target` via lucide (check existing imports, add if missing).

- [ ] **Step 3: Typecheck and commit**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
git add apps/web/src/pages/habits/_component/StreakBadge.tsx \
  apps/web/src/pages/habits/_component/HabitsList.tsx
git commit -m "refactor(ui): replace emoji in habit components with lucide icons"
```

---

## Task 12: Auth, notifications, board, home — final inline replacements

**Files:**
- Modify: `apps/web/src/pages/forgot-password.tsx`
- Modify: `apps/web/src/pages/reset-password.tsx`
- Modify: `apps/web/src/components/NotificationPermissionModal.tsx`
- Modify: `apps/web/src/pages/_component/HomePanel.tsx`
- Modify: `apps/web/src/pages/shopping/_component/ShoppingList.tsx` (any remaining `🛒` outside PageHeader)

- [ ] **Step 1: `forgot-password.tsx`**

Add imports: `import { Mail, Key } from "lucide-react";`

Replace `✉️` (line 50):
```tsx
<div className="mx-auto h-12 w-12 flex items-center justify-center">
  <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
</div>
```

Replace `🔑` (line 79):
```tsx
<div className="mx-auto h-12 w-12 flex items-center justify-center">
  <Key className="w-8 h-8 text-primary-600 dark:text-primary-400" />
</div>
```

- [ ] **Step 2: `reset-password.tsx`**

Add imports: `import { AlertTriangle, Lock } from "lucide-react";`

Replace `⚠️` (line 120) with `<AlertTriangle className="w-8 h-8 text-amber-500" />`.
Replace `🔐` (line 149) with `<Lock className="w-8 h-8 text-primary-600 dark:text-primary-400" />`.

- [ ] **Step 3: `NotificationPermissionModal.tsx`**

Add import: `import { Bell } from "lucide-react";`

Replace (line 64):
```tsx
// Before:
<div className="flex-shrink-0 text-3xl">🔔</div>

// After:
<div className="flex-shrink-0">
  <Bell className="w-8 h-8 text-primary-600 dark:text-primary-400" />
</div>
```

- [ ] **Step 4: `HomePanel.tsx`**

Check line 78 (or 169 based on scan) for remaining emoji — the `✅` "all caught up" icon. Add import `import { CheckCircle } from "lucide-react";` and replace with `<CheckCircle className="w-5 h-5 text-green-500" />`.

- [ ] **Step 5: Check `ShoppingList.tsx` for remaining emoji**

Line 217 has a `🛒` shopping list link icon outside PageHeader. Replace with `<ShoppingCart size={16} />`. The import was already added in Task 1.

- [ ] **Step 6: Final typecheck + build check**

```bash
cd /Users/samuelloranger/Sites/projets_perso/hously && make typecheck
```
Expected: 0 errors.

Then verify no emoji remain in target files:
```bash
grep -rn "🔔\|🚪\|⚙️\|☀️\|🌙\|🧲\|🎬\|🎞\|📺\|💿\|🎧\|🔖\|📋\|📊\|✅\|❌\|🗑️\|✏️\|↩️\|➕\|🔁\|🔥\|👤\|👥\|⏰\|⏱\|🛒\|📡\|✨\|🖥️\|🎯\|🌱\|🛠️\|⏭️\|🔌\|⬇️\|🧹\|🧾\|🎥\|🔄\|📅\|🇺🇸\|🇫🇷\|🔑\|🔐\|⚠️\|✉️\|🧭" \
  apps/web/src \
  --include="*.tsx" --include="*.ts" \
  --exclude-dir="pages/habits/_component" \
  2>/dev/null
```

Expected: only `EmotionModal.tsx`, `EmojiPicker.tsx`, and `CreateHabitForm.tsx` (the default emoji value).

- [ ] **Step 7: Commit**

```bash
git add \
  apps/web/src/pages/forgot-password.tsx \
  apps/web/src/pages/reset-password.tsx \
  apps/web/src/components/NotificationPermissionModal.tsx \
  apps/web/src/pages/_component/HomePanel.tsx \
  apps/web/src/pages/shopping/_component/ShoppingList.tsx
git commit -m "refactor(ui): replace remaining emoji in auth, notifications, and misc components with lucide icons"
```

---

## Self-review notes

- `MediaDetailInfoSections.tsx` (👤 cast) was listed in the spec. Check it in Task 9 alongside other media files.
- `TmdbMediaSearchPanel.tsx` (🎬) was found in the scan — check and replace with `<Clapperboard size={16} />` in Task 9.
- Test mock at `test-utils/mocks.ts:56` has `🛒` — this is test data, not UI. Leave it unless a test fails.
- `CreateChoreForm.tsx:452` has `➕` add item — add `import { Plus } from "lucide-react"` and replace.
  Add this to Task 10 (Chores).
