import Holidays from "date-holidays";

const countriesCatalog = new Holidays();

const supportedCountryCodes = (): Set<string> =>
  new Set(Object.keys(countriesCatalog.getCountries()));

/**
 * Normalize and validate a country code against date-holidays supported countries.
 */
export function normalizeUserCountryCode(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const t = input.trim().toUpperCase();
  if (!t) return null;
  if (!/^[A-Z]{2}$/.test(t)) return null;
  if (!supportedCountryCodes().has(t)) return null;
  return t;
}

/**
 * Normalize a province/state/region code for date-holidays getStates keys (mixed case).
 */
export function normalizeCalendarSubdivision(
  countryCode: string | null | undefined,
  input: string | null | undefined,
): string | null {
  if (!countryCode || input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc) || !supportedCountryCodes().has(cc)) return null;

  const hd = new Holidays(cc);
  const states = hd.getStates(cc) as Record<string, string> | undefined;
  if (!states || Object.keys(states).length === 0) return null;

  if (Object.prototype.hasOwnProperty.call(states, raw)) return raw;
  const up = raw.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(states, up)) return up;
  const low = raw.toLowerCase();
  for (const k of Object.keys(states)) {
    if (k.toLowerCase() === low) return k;
  }
  return null;
}

export function listHolidayCountriesForApi(): Array<{
  country_code: string;
  default_name: string;
}> {
  const c = countriesCatalog.getCountries();
  return Object.entries(c)
    .map(([country_code, name]) => ({
      country_code,
      default_name: String(name),
    }))
    .sort((a, b) => a.country_code.localeCompare(b.country_code));
}

export function listHolidaySubdivisionsForApi(countryCode: string): Array<{
  subdivision_code: string;
  default_name: string;
}> {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc) || !supportedCountryCodes().has(cc)) {
    return [];
  }
  const hd = new Holidays(cc);
  const states = hd.getStates(cc) as Record<string, string> | undefined;
  if (!states) return [];
  return Object.entries(states)
    .map(([subdivision_code, name]) => ({
      subdivision_code,
      default_name: String(name),
    }))
    .sort((a, b) => a.default_name.localeCompare(b.default_name));
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function holidayRowToYmd(dateField: string): string {
  return dateField.slice(0, 10);
}

/**
 * Map app locale (e.g. fr-CA) to date-holidays language fallbacks.
 */
export function localeToHolidayLanguages(
  locale: string | null | undefined,
): string[] {
  const normalized = (locale || "en").trim().replace(/_/g, "-");
  const primary = (normalized.split("-")[0] || "en").toLowerCase();
  if (primary === "en") return ["en"];
  return [primary, "en"];
}

export interface HolidayCalendarRow {
  date: string;
  title: string;
  types: string[];
  rule: string;
  substitute?: boolean;
}

export function getPublicHolidaysForCalendarRange(
  countryCode: string,
  subdivisionCode: string | null | undefined,
  startDate: Date,
  endDate: Date,
  locale: string | null | undefined,
): HolidayCalendarRow[] {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc) || !supportedCountryCodes().has(cc)) {
    return [];
  }

  const sub = subdivisionCode?.trim();
  const hd = sub ? new Holidays(cc, sub) : new Holidays(cc);
  hd.setLanguages(localeToHolidayLanguages(locale));

  const startKey = localYmd(startDate);
  const endKey = localYmd(endDate);
  const out: HolidayCalendarRow[] = [];

  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    for (const h of hd.getHolidays(y)) {
      if (h.type !== "public" && h.type !== "bank") continue;
      const d = holidayRowToYmd(h.date);
      if (d < startKey || d > endKey) continue;
      out.push({
        date: d,
        title: h.name,
        types: [h.type],
        rule: h.rule,
        substitute: h.substitute,
      });
    }
  }

  return out;
}
