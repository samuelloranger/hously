/**
 * Shared utilities and styles for C411 components.
 */

export function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} Go`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} Mo`;
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

/** Capitalize first letter of a status string for display. */
export function capitalizeStatus(status: string): string {
  const normalized = status.replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export const STATUS_BADGE: Record<string, string> = {
  local: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
  preparing: 'bg-sky-100/60 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300',
  prepare_failed: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  pending: 'bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  approved: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
};

/** Left-border accent color for release cards keyed by status. */
export const STATUS_BORDER: Record<string, string> = {
  local: 'border-l-neutral-300 dark:border-l-neutral-600',
  preparing: 'border-l-sky-400 dark:border-l-sky-500',
  prepare_failed: 'border-l-red-400 dark:border-l-red-500',
  pending: 'border-l-amber-400 dark:border-l-amber-500',
  approved: 'border-l-emerald-500 dark:border-l-emerald-400',
  rejected: 'border-l-red-400 dark:border-l-red-500',
};

/** Subtle background tint for status-accented cards. */
export const STATUS_BG: Record<string, string> = {
  local: '',
  preparing: 'bg-sky-50/20 dark:bg-sky-950/5',
  prepare_failed: 'bg-red-50/20 dark:bg-red-950/5',
  pending: 'bg-amber-50/20 dark:bg-amber-950/5',
  approved: 'bg-emerald-50/20 dark:bg-emerald-950/5',
  rejected: 'bg-red-50/20 dark:bg-red-950/5',
};

export const LANG_BADGE: Record<string, string> = {
  fr: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  en: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  default: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
};

export function langBadgeClass(lang: string): string {
  if (/^(fre|fra|fr)$/i.test(lang)) return LANG_BADGE.fr;
  if (/^(eng|en)$/i.test(lang)) return LANG_BADGE.en;
  return LANG_BADGE.default;
}

export const BADGE_BASE = 'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium';
export const BADGE_NEUTRAL = `${BADGE_BASE} bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400`;
export const BADGE_INDIGO = `${BADGE_BASE} bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300`;
export const BADGE_SKY = `${BADGE_BASE} bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300`;
export const BADGE_VIOLET = `${BADGE_BASE} bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300`;

export const CARD = 'rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900/60';
export const CARD_HOVER = `${CARD} transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900`;
export const CARD_HIGHLIGHT = 'rounded-xl border border-indigo-200/60 bg-indigo-50/30 dark:border-indigo-500/20 dark:bg-indigo-950/10';

/** Card variant with a thick left-border accent for status-keyed items. */
export const CARD_STATUS = 'rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 border-l-[3px] bg-white dark:bg-neutral-900/60 transition-all duration-150 hover:shadow-sm hover:border-neutral-300/80 dark:hover:border-neutral-600/60';

export const STAT_LINE = 'flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400';
export const STAT_SEED = 'text-emerald-600 dark:text-emerald-400';
export const STAT_LEECH = 'text-red-500 dark:text-red-400';
