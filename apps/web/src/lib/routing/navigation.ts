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
      },
      {
        path: "/chores",
        translationKey: "nav.chores",
        icon: ListChecks,
      },
      {
        path: "/board",
        translationKey: "nav.board",
        icon: LayoutGrid,
      },
      {
        path: "/habits",
        translationKey: "nav.habits",
        icon: Target,
      },
      {
        path: "/shopping",
        translationKey: "nav.shopping",
        icon: ShoppingCart,
      },
      {
        path: "/calendar",
        translationKey: "nav.calendar",
        icon: CalendarIcon,
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
      },
      {
        path: "/explore",
        translationKey: "nav.explore",
        icon: Compass,
      },
      {
        path: "/torrents",
        translationKey: "nav.torrents",
        icon: Magnet,
      },
      {
        path: "/watchlist",
        translationKey: "nav.watchlist",
        icon: Bookmark,
      },
      {
        path: "/collections",
        translationKey: "nav.collections",
        icon: Layers2,
      },
    ],
  },
];
