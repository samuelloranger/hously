import {
  CalendarIcon,
  Compass,
  CookingPot,
  LayoutDashboard,
  Library,
  ListChecks,
  Magnet,
  Package,
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
      { path: '/library', translationKey: 'nav.library', icon: Library, mobileIcon: '🎞️' },
      { path: '/torrents', translationKey: 'nav.torrents', icon: Magnet, mobileIcon: '🧲' },
      { path: '/releases', translationKey: 'nav.releases', icon: Package, mobileIcon: '📦' },
      { path: '/explore', translationKey: 'nav.explore', icon: Compass, mobileIcon: '🧭' },
    ],
  },
];
