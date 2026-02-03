/**
 * Date utilities using date-fns
 * Centralizes all date operations for consistency
 */

import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  compareAsc,
  endOfDay,
  endOfMonth,
  format,
  formatISO,
  getDate,
  getDaysInMonth,
  getMonth,
  getYear,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
  subYears,
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
    if (input.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(input)) {
      return parseISO(input);
    }
    return parseISO(input + 'Z');
  } catch {
    return null;
  }
}

export function formatISOString(date: MaybeDate): string | null {
  if (!date) return null;
  return formatISO(date);
}

export function formatISODate(date: MaybeDate): string | null {
  if (!date) return null;
  return format(date, "yyyy-MM-dd");
}

export function formatDate(date: MaybeDate, locale: string = "en"): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";

  try {
    return dateObj.toLocaleDateString(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }
    );
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
  language: string = "en"
): string {
  if (!input) return "";
  const date = input instanceof Date ? input : parseUTCDate(input);
  if (!date) return "";

  try {
    return date.toLocaleString(
      language === "fr" ? "fr-FR" : "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
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

export function today(): Date {
  return startOfDay(new Date());
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

/**
 * Check if two dates are in the same year
 */
export function sameYear(date1: MaybeDate, date2: MaybeDate): boolean {
  const date1Obj = parseDate(date1);
  const date2Obj = parseDate(date2);
  if (!date1Obj || !date2Obj) return false;
  return isSameYear(date1Obj, date2Obj);
}

/**
 * Compare two dates (ascending: -1 if a < b, 0 if equal, 1 if a > b)
 */
export function compareDates(a: MaybeDate, b: MaybeDate): number {
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return 0;
  return compareAsc(aObj, bObj);
}

/**
 * Check if date a is after date b
 */
export function isDateAfter(a: MaybeDate, b: MaybeDate): boolean {
  // If both are already Date objects, use them directly
  if (a instanceof Date && b instanceof Date) {
    return isAfter(a, b);
  }
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return false;
  return isAfter(aObj, bObj);
}

/**
 * Check if date a is before date b
 */
export function isDateBefore(a: MaybeDate, b: MaybeDate): boolean {
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return false;
  return isBefore(aObj, bObj);
}

/**
 * Round datetime to nearest 15-minute interval (00, 15, 30, 45)
 */
export function roundTo15Minutes(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  const minute = dateObj.getMinutes();
  const roundedMinute = Math.floor(minute / 15) * 15;
  dateObj.setMinutes(roundedMinute, 0, 0);
  return dateObj;
}

/**
 * Get start of day (00:00:00)
 */
export function startOfDayDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return startOfDay(dateObj);
}

/**
 * Get end of day (23:59:59.999)
 */
export function endOfDayDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return endOfDay(dateObj);
}

/**
 * Get start of month
 */
export function startOfMonthDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return startOfMonth(dateObj);
}

/**
 * Get end of month
 */
export function endOfMonthDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return endOfMonth(dateObj);
}

/**
 * Get start of week
 */
export function startOfWeekDate(date: MaybeDate, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return startOfWeek(dateObj, { weekStartsOn });
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addDays(dateObj, amount);
}

/**
 * Subtract days from a date
 */
export function subtractDays(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
    return subDays(dateObj, amount);
}

/**
 * Add weeks to a date
 */
export function addWeeksToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addWeeks(dateObj, amount);
}

/**
 * Subtract weeks from a date
 */
export function subtractWeeks(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subWeeks(dateObj, amount);
}

/**
 * Add months to a date
 */
export function addMonthsToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addMonths(dateObj, amount);
}

/**
 * Subtract months from a date
 */
export function subtractMonths(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subMonths(dateObj, amount);
}

/**
 * Add years to a date
 */
export function addYearsToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addYears(dateObj, amount);
}

/**
 * Subtract years from a date
 */
export function subtractYears(date: Date, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subYears(dateObj, amount);
}

/**
 * Get year from date
 */
export function getYearFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getYear(dateObj);
}

/**
 * Get month from date (0-indexed: 0 = January, 11 = December)
 */
export function getMonthFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getMonth(dateObj);
}

/**
 * Get day of month from date (1-31)
 */
export function getDayFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getDate(dateObj);
}

/**
 * Get number of days in month
 */
export function getDaysInMonthFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getDaysInMonth(dateObj);
}

/**
 * Format date with custom format string
 * See date-fns format() for format options
 */
export function formatDateCustom(
  date: MaybeDate,
  formatStr: string
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return format(dateObj, formatStr);
}

/**
 * Parse a date string that is in UTC but doesn't have timezone indicator
 * This handles dates from the backend that are stored in UTC but sent without "Z"
 * @param dateString - ISO date string without timezone (e.g., "2025-11-13T18:20:47.858140")
 * @returns Date object in local timezone
 */
export function parseUTCDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  // If the string already has timezone info (ends with Z or +/-), parse normally
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return parseISO(dateString);
  }
  
  // If no timezone indicator, assume UTC and append 'Z'
  try {
    return parseISO(dateString + 'Z');
  } catch {
    return null;
  }
}

/**
 * Format a duration in seconds to a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "5m 30s", "2h 15m 30s", "3d")
 */
export function formatTimeUntil(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m\u00A0${seconds % 60}s`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h\u00A0${Math.floor(
      (seconds % 3600) / 60
    )}m\u00A0${seconds % 60}s`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function tomorrow(): Date {
  return addDays(new Date(), 1);
}

export function getWeekDates(weekOffset: number = 0, weekStartsOn: 0 | 1 = 1): Date[] {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = weekStartsOn === 0
    ? currentDay === 0 ? 0 : -currentDay
    : currentDay === 0 ? -6 : 1 - currentDay;

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

export function formatWeekdayShort(date: MaybeDate, locale: string = "en"): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return dateObj.toLocaleDateString(locale, { weekday: "short" });
}

export function formatMonthYear(date: MaybeDate, locale: string = "en"): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return dateObj.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function formatFullDate(date: MaybeDate, locale: string = "en"): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return dateObj.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDateOnly(date: MaybeDate): string {
  const dateObj = parseDate(date);
  if (!dateObj) return "";
  return dateObj.toISOString().split("T")[0];
}


