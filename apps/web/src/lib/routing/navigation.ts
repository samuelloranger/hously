import {
  Bookmark,
  CalendarIcon,
  Compass,
  LayoutDashboard,
  LayoutGrid,
  Layers2,
  Library,
  ListChecks,
  Magnet,
  ShoppingCart,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  path: string;
  translationKey: string;
  icon: LucideIcon;
  mobileIcon: string;
}

export interface NavSection {
  labelKey: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    labelKey: "nav.section_life",
    items: [
      {
        path: "/",
        translationKey: "nav.dashboard",
        icon: LayoutDashboard,
        mobileIcon: "📊",
      },
      {
        path: "/chores",
        translationKey: "nav.chores",
        icon: ListChecks,
        mobileIcon: "✅",
      },
      {
        path: "/board",
        translationKey: "nav.board",
        icon: LayoutGrid,
        mobileIcon: "📋",
      },
      {
        path: "/habits",
        translationKey: "nav.habits",
        icon: Target,
        mobileIcon: "🎯",
      },
      {
        path: "/shopping",
        translationKey: "nav.shopping",
        icon: ShoppingCart,
        mobileIcon: "🛒",
      },
      {
        path: "/calendar",
        translationKey: "nav.calendar",
        icon: CalendarIcon,
        mobileIcon: "📅",
      },
    ],
  },
  {
    labelKey: "nav.section_homelab",
    items: [
      {
        path: "/library",
        translationKey: "nav.library",
        icon: Library,
        mobileIcon: "🎞️",
      },
      {
        path: "/explore",
        translationKey: "nav.explore",
        icon: Compass,
        mobileIcon: "🧭",
      },
      {
        path: "/torrents",
        translationKey: "nav.torrents",
        icon: Magnet,
        mobileIcon: "🧲",
      },
      {
        path: "/watchlist",
        translationKey: "nav.watchlist",
        icon: Bookmark,
        mobileIcon: "🔖",
      },
      {
        path: "/collections",
        translationKey: "nav.collections",
        icon: Layers2,
        mobileIcon: "🎬",
      },
    ],
  },
];
