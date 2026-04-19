/**
 * Date utilities using date-fns
 * Centralizes all date operations for consistency
 */

import {
  addDays,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns";

export type MaybeDate = Date | string | number | null | undefined;

export function parseDate(input: MaybeDate): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  if (typeof input !== "string") return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [year, month, day] = input.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    }
    if (input.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(input)) {
      return parseISO(input);
    }
    return parseISO(input + "Z");
  } catch {
    return null;
  }
}

export function formatDate(date: MaybeDate, locale: string = "en"): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";

  try {
    return dateObj.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

export function formatTime(date: MaybeDate, locale: string = "en"): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return dateObj.toLocaleTimeString(locale === "fr" ? "fr-FR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(
  input: Date | string | null | undefined,
  language: string = "en",
): string {
  if (!input) return "";
  const date = input instanceof Date ? input : parseDate(input);
  if (!date) return "";

  try {
    return date.toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function toDateTimeLocal(date: MaybeDate = new Date()): string {
  if (!date) return "";
  let dateObj = typeof date === "string" ? parseDate(date) : date;
  if (!dateObj) dateObj = new Date();
  if (!(dateObj instanceof Date)) return "";

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function datetimeLocalToUTC(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  const localDate = new Date(datetimeLocal);
  const dateTimeStr = format(localDate, "yyyy-MM-dd'T'HH:mm:ss");
  const offsetMinutes = localDate.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const offsetSign = offsetMinutes > 0 ? "-" : "+";
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;
  return `${dateTimeStr}${offsetStr}`;
}

export function now(): Date {
  return new Date();
}

export function isToday(date: MaybeDate): boolean {
  if (!date) return false;
  const dateObj = parseDate(date);
  if (!dateObj) return false;
  return isSameDay(dateObj, new Date());
}

export function sameDay(date1: MaybeDate, date2: MaybeDate): boolean {
  const date1Obj = parseDate(date1);
  const date2Obj = parseDate(date2);
  if (!date1Obj || !date2Obj) return false;
  return isSameDay(date1Obj, date2Obj);
}

export function sameMonth(date1: MaybeDate, date2: MaybeDate): boolean {
  const date1Obj = parseDate(date1);
  const date2Obj = parseDate(date2);
  if (!date1Obj || !date2Obj) return false;
  return isSameMonth(date1Obj, date2Obj);
}

export function isDateBefore(a: MaybeDate, b: MaybeDate): boolean {
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return false;
  return isBefore(aObj, bObj);
}

export function tomorrow(): Date {
  return addDays(new Date(), 1);
}

export function getWeekDates(
  weekOffset: number = 0,
  weekStartsOn: 0 | 1 = 1,
): Date[] {
  const today = new Date();
  const currentDay = today.getDay();
  const diff =
    weekStartsOn === 0
      ? currentDay === 0
        ? 0
        : -currentDay
      : currentDay === 0
        ? -6
        : 1 - currentDay;

  const startDate = new Date(today);
  startDate.setDate(today.getDate() + diff + weekOffset * 7);
  startDate.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export function formatDateOnly(date: MaybeDate): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return dateObj.toISOString().split("T")[0];
}

/**
 * IANA timezone used to interpret calendar-date (`@db.Date`) values. Prisma
 * reads `DATE` columns as UTC midnight, but logically an air/release date is
 * a local calendar date. The zone is taken from the standard `TZ` env var so
 * the backend runtime TZ is the single source of truth; falls back to
 * `America/New_York` when unset (e.g. in the browser).
 */
function readEnvTz(): string | undefined {
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return g.process?.env?.TZ;
}

export const APP_DISPLAY_TIMEZONE = readEnvTz() || "America/New_York";

/** Current `YYYY-MM-DD` in the app's display timezone (defaults to NY). */
export function localDateYmd(
  timeZone: string = APP_DISPLAY_TIMEZONE,
  at: Date = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Build the `Date` value that Prisma produces for a `@db.Date` column with
 * the given `YYYY-MM-DD` calendar day — a UTC-midnight anchor. Use this when
 * building a cutoff to compare against a DATE column.
 */
export function toUtcMidnightDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Short-form date formatter for DATE-only values: `"Apr 20"` (or with year if
 * the value's calendar year differs from today's, in the display timezone).
 * Timezone-safe: `parseDate` anchors YMD strings at UTC noon, and formatting
 * resolves in `timeZone` so the rendered day always matches the stored value.
 */
export function formatDateShort(
  input: MaybeDate,
  locale: string = "en",
  timeZone: string = APP_DISPLAY_TIMEZONE,
): string {
  const date = parseDate(input);
  if (!date) return "";
  const yearFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
  });
  const includeYear = yearFmt.format(date) !== yearFmt.format(new Date());
  return date.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone,
  });
}

/** Year from a DATE-only value, interpreted in the app's display timezone. */
export function getDateYear(
  input: MaybeDate,
  timeZone: string = APP_DISPLAY_TIMEZONE,
): number | null {
  const date = parseDate(input);
  if (!date) return null;
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return Number(ymd.slice(0, 4));
}
