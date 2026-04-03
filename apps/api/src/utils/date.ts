/**
 * Date and time utility functions for the Elysia server.
 * These are shared across multiple route handlers.
 */

/**
 * Get timezone from environment variable or default to America/New_York
 */
export const getTimezone = (): string => {
  return Bun.env.TZ || "America/New_York";
};

/**
 * Format a date to ISO string, handling various input types
 */
export const formatIso = (
  date: string | Date | null | undefined,
): string | null => {
  if (!date) return null;
  if (typeof date === "string") return date;
  return date.toISOString();
};

/**
 * Get current UTC timestamp as ISO string
 */
export const nowUtc = (): string => new Date().toISOString();

/**
 * Get today's date in the local timezone (midnight local time)
 */
export const todayLocal = (): Date => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "0");
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "0");
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
  return new Date(year, month - 1, day);
};

/**
 * Convert UTC datetime to local date (date only, no time)
 */
export const toLocalDate = (
  utcDateInput: string | Date | null | undefined,
): Date | null => {
  if (!utcDateInput) return null;
  const utcDate =
    utcDateInput instanceof Date ? utcDateInput : new Date(utcDateInput);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(utcDate);
  const year = parseInt(parts.find((p) => p.type === "year")?.value || "0");
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "0");
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");
  return new Date(year, month - 1, day);
};

/**
 * Convert UTC date to local timezone (preserving time)
 */
export const utcToTimezone = (date: Date | string | null): Date | null => {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: getTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "0";
  return new Date(
    parseInt(getPart("year")),
    parseInt(getPart("month")) - 1,
    parseInt(getPart("day")),
    parseInt(getPart("hour")),
    parseInt(getPart("minute")),
    parseInt(getPart("second")),
  );
};

/**
 * Format date in local timezone as YYYY-MM-DD
 */
export const formatDateInTimezone = (date: Date | string | null): string => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: getTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
};

/**
 * Get number of days in a month
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

/**
 * Parse datetime string to Date, with validation
 */
export const parseDateTime = (dateStr: string): Date => {
  // Handle datetime-local format (without timezone)
  let normalizedDateStr = dateStr;
  if (dateStr.includes("T") && dateStr.length === 16) {
    console.warn(
      `Received datetime-local format without timezone: ${dateStr}. Treating as UTC.`,
    );
    normalizedDateStr = dateStr + ":00Z";
  }

  const date = new Date(normalizedDateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return date;
};

/**
 * Parse date string in YYYY-MM-DD format
 */
export const parseDate = (dateStr: string): Date | null => {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(date.getTime())) return null;
  return date;
};

/**
 * Round time to nearest 15 minutes
 */
export const roundTo15Minutes = (date: Date): Date => {
  const result = new Date(date);
  const minutes = result.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  result.setMinutes(roundedMinutes, 0, 0);
  return result;
};

/**
 * Get start of day (00:00:00.000)
 */
export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get end of day (23:59:59.999)
 */
export const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Get midnight (start of day) for a YYYY-MM-DD string in local timezone.
 */
export const midnightOf = (ymd: string): Date => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

/**
 * Add (or subtract) days to a Date, returning a new Date at midnight.
 */
export const addDaysInTz = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Calculate period boundaries for analytics
 */
export const calculatePeriodDates = (
  period: string,
  startDateStr?: string,
): { start: Date; end: Date } => {
  const todayTz = todayLocal();

  let startDate = todayTz;
  if (startDateStr) {
    try {
      const parsed = new Date(startDateStr);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed;
      }
    } catch {
      // Use today if parsing fails
    }
  }

  let startOfPeriod: Date;
  let endOfPeriod: Date;

  if (period === "week") {
    // Start of week (Monday)
    const dayOfWeek = startDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfPeriod = new Date(startDate);
    startOfPeriod.setDate(startDate.getDate() + mondayOffset);
    startOfPeriod.setHours(0, 0, 0, 0);

    endOfPeriod = new Date(startOfPeriod);
    endOfPeriod.setDate(startOfPeriod.getDate() + 6);
    endOfPeriod.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    startOfPeriod = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    endOfPeriod = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      0,
    );
    endOfPeriod.setHours(23, 59, 59, 999);
  } else if (period === "quarter") {
    const quarterStartMonth = Math.floor(startDate.getMonth() / 3) * 3;
    startOfPeriod = new Date(startDate.getFullYear(), quarterStartMonth, 1);
    endOfPeriod = new Date(startDate.getFullYear(), quarterStartMonth + 3, 0);
    endOfPeriod.setHours(23, 59, 59, 999);
  } else if (period === "year") {
    startOfPeriod = new Date(startDate.getFullYear(), 0, 1);
    endOfPeriod = new Date(startDate.getFullYear(), 11, 31);
    endOfPeriod.setHours(23, 59, 59, 999);
  } else {
    throw new Error(`Invalid period: ${period}`);
  }

  return { start: startOfPeriod, end: endOfPeriod };
};
