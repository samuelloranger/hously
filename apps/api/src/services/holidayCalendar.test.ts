import { describe, expect, it } from "bun:test";
import {
  normalizeUserCountryCode,
  normalizeCalendarSubdivision,
  localeToHolidayLanguages,
  getPublicHolidaysForCalendarRange,
} from "./holidayCalendar";

describe("holidayCalendar", () => {
  it("normalizeUserCountryCode accepts supported ISO codes", () => {
    expect(normalizeUserCountryCode("ca")).toBe("CA");
    expect(normalizeUserCountryCode(" US ")).toBe("US");
  });

  it("normalizeUserCountryCode rejects invalid or unsupported codes", () => {
    expect(normalizeUserCountryCode("")).toBeNull();
    expect(normalizeUserCountryCode("cba")).toBeNull();
    expect(normalizeUserCountryCode("ZZ")).toBeNull();
  });

  it("normalizeCalendarSubdivision maps keys for CA", () => {
    expect(normalizeCalendarSubdivision("CA", "qc")).toBe("QC");
    expect(normalizeCalendarSubdivision("CA", "QC")).toBe("QC");
    expect(normalizeCalendarSubdivision("CA", "ZZ")).toBeNull();
  });

  it("localeToHolidayLanguages prefers primary then English", () => {
    expect(localeToHolidayLanguages("en")).toEqual(["en"]);
    expect(localeToHolidayLanguages("en-US")).toEqual(["en"]);
    expect(localeToHolidayLanguages("fr")).toEqual(["fr", "en"]);
  });

  it("getPublicHolidaysForCalendarRange returns rows in range (national)", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 31);
    const rows = getPublicHolidaysForCalendarRange(
      "CA",
      null,
      start,
      end,
      "en",
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => r.date >= "2026-01-01" && r.date <= "2026-01-31"),
    ).toBe(true);
  });

  it("getPublicHolidaysForCalendarRange uses subdivision (CA-QC)", () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 30);
    const qc = getPublicHolidaysForCalendarRange("CA", "QC", start, end, "fr");
    const nat = getPublicHolidaysForCalendarRange("CA", null, start, end, "fr");
    expect(qc.length).toBeGreaterThan(0);
    expect(qc.some((r) => r.date === "2026-06-24")).toBe(true);
    expect(nat.length).toBe(0);
  });
});
