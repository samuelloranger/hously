import {
  Bookmark,
  CalendarIcon,
  CalendarRange,
  Compass,
  CookingPot,
  LayoutDashboard,
  Layers2,
  Library,
  ListChecks,
  Magnet,
  ShoppingCart,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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
    labelKey: 'nav.section_life',
    items: [
      { path: '/', translationKey: 'nav.dashboard', icon: LayoutDashboard, mobileIcon: '📊' },
      { path: '/chores', translationKey: 'nav.chores', icon: ListChecks, mobileIcon: '✅' },
      { path: '/habits', translationKey: 'nav.habits', icon: Target, mobileIcon: '🎯' },
      { path: '/shopping', translationKey: 'nav.shopping', icon: ShoppingCart, mobileIcon: '🛒' },
      { path: '/calendar', translationKey: 'nav.calendar', icon: CalendarIcon, mobileIcon: '📅' },
      { path: '/kitchen', translationKey: 'nav.kitchen', icon: CookingPot, mobileIcon: '🍳' },
    ],
  },
  {
    labelKey: 'nav.section_homelab',
    items: [
      { path: '/torrents', translationKey: 'nav.torrents', icon: Magnet, mobileIcon: '🧲' },
      { path: '/library', translationKey: 'nav.library', icon: Library, mobileIcon: '🎞️' },
      { path: '/collections', translationKey: 'nav.collections', icon: Layers2, mobileIcon: '🎬' },
      { path: '/explore', translationKey: 'nav.explore', icon: Compass, mobileIcon: '🧭' },
      { path: '/releases', translationKey: 'nav.releases', icon: CalendarRange, mobileIcon: '🎬' },
      { path: '/watchlist', translationKey: 'nav.watchlist', icon: Bookmark, mobileIcon: '🔖' },
    ],
  },
];
