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
} from 'date-fns';

export type MaybeDate = Date | string | number | null | undefined;

export function parseDate(input: MaybeDate): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  if (typeof input !== 'string') return null;
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [year, month, day] = input.split('-').map(Number);
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

function formatISOString(date: MaybeDate): string | null {
  if (!date) return null;
  return formatISO(date);
}

function formatISODate(date: MaybeDate): string | null {
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}

export function formatDate(date: MaybeDate, locale: string = 'en'): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';

  try {
    return dateObj.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

export function formatTime(date: MaybeDate, locale: string = 'en'): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(input: Date | string | null | undefined, language: string = 'en'): string {
  if (!input) return '';
  const date = input instanceof Date ? input : parseUTCDate(input);
  if (!date) return '';

  try {
    return date.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function toDateTimeLocal(date: MaybeDate = new Date()): string {
  if (!date) return '';
  let dateObj = typeof date === 'string' ? parseDate(date) : date;
  if (!dateObj) dateObj = new Date();
  if (!(dateObj instanceof Date)) return '';

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function datetimeLocalToUTC(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  const localDate = new Date(datetimeLocal);
  const dateTimeStr = format(localDate, "yyyy-MM-dd'T'HH:mm:ss");
  const offsetMinutes = localDate.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
  const offsetMins = Math.abs(offsetMinutes) % 60;
  const offsetSign = offsetMinutes > 0 ? '-' : '+';
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;
  return `${dateTimeStr}${offsetStr}`;
}

function today(): Date {
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

function sameYear(date1: MaybeDate, date2: MaybeDate): boolean {
  const date1Obj = parseDate(date1);
  const date2Obj = parseDate(date2);
  if (!date1Obj || !date2Obj) return false;
  return isSameYear(date1Obj, date2Obj);
}

function compareDates(a: MaybeDate, b: MaybeDate): number {
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return 0;
  return compareAsc(aObj, bObj);
}

function isDateAfter(a: MaybeDate, b: MaybeDate): boolean {
  if (a instanceof Date && b instanceof Date) {
    return isAfter(a, b);
  }
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return false;
  return isAfter(aObj, bObj);
}

export function isDateBefore(a: MaybeDate, b: MaybeDate): boolean {
  const aObj = parseDate(a);
  const bObj = parseDate(b);
  if (!aObj || !bObj) return false;
  return isBefore(aObj, bObj);
}

function roundTo15Minutes(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  const minute = dateObj.getMinutes();
  const roundedMinute = Math.floor(minute / 15) * 15;
  dateObj.setMinutes(roundedMinute, 0, 0);
  return dateObj;
}

function startOfDayDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return startOfDay(dateObj);
}

function endOfDayDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return endOfDay(dateObj);
}

function startOfMonthDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return startOfMonth(dateObj);
}

function endOfMonthDate(date: MaybeDate): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return endOfMonth(dateObj);
}

function startOfWeekDate(date: MaybeDate, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return startOfWeek(dateObj, { weekStartsOn });
}

function addDaysToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addDays(dateObj, amount);
}

function subtractDays(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subDays(dateObj, amount);
}

function addWeeksToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addWeeks(dateObj, amount);
}

function subtractWeeks(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subWeeks(dateObj, amount);
}

function addMonthsToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addMonths(dateObj, amount);
}

function subtractMonths(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subMonths(dateObj, amount);
}

function addYearsToDate(date: MaybeDate, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return addYears(dateObj, amount);
}

function subtractYears(date: Date, amount: number): Date {
  const dateObj = parseDate(date);
  if (!dateObj) return new Date();
  return subYears(dateObj, amount);
}

function getYearFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getYear(dateObj);
}

function getMonthFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getMonth(dateObj);
}

function getDayFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getDate(dateObj);
}

function getDaysInMonthFromDate(date: MaybeDate): number {
  const dateObj = parseDate(date);
  if (!dateObj) return 0;
  return getDaysInMonth(dateObj);
}

function formatDateCustom(date: MaybeDate, formatStr: string): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return format(dateObj, formatStr);
}

function parseUTCDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return parseISO(dateString);
  }

  try {
    return parseISO(dateString + 'Z');
  } catch {
    return null;
  }
}

function formatTimeUntil(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m\u00A0${seconds % 60}s`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h\u00A0${Math.floor((seconds % 3600) / 60)}m\u00A0${seconds % 60}s`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function tomorrow(): Date {
  return addDays(new Date(), 1);
}

export function getWeekDates(weekOffset: number = 0, weekStartsOn: 0 | 1 = 1): Date[] {
  const today = new Date();
  const currentDay = today.getDay();
  const diff = weekStartsOn === 0 ? (currentDay === 0 ? 0 : -currentDay) : currentDay === 0 ? -6 : 1 - currentDay;

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

function formatWeekdayShort(date: MaybeDate, locale: string = 'en'): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toLocaleDateString(locale, { weekday: 'short' });
}

function formatMonthYear(date: MaybeDate, locale: string = 'en'): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function formatFullDate(date: MaybeDate, locale: string = 'en'): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateOnly(date: MaybeDate): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';
  return dateObj.toISOString().split('T')[0];
}
