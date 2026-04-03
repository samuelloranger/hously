import { describe, it, expect } from "vitest";
import { formatLocalDate, addDays } from "../index";

describe("formatLocalDate", () => {
  it("formats a date as YYYY-MM-DD without timezone shift", () => {
    expect(formatLocalDate(new Date(2024, 0, 5))).toBe("2024-01-05");
    expect(formatLocalDate(new Date(2024, 11, 31))).toBe("2024-12-31");
  });

  it("pads month and day with leading zeros", () => {
    expect(formatLocalDate(new Date(2024, 2, 3))).toBe("2024-03-03");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    expect(addDays("2024-01-01", 1)).toBe("2024-01-02");
    expect(addDays("2024-01-01", 31)).toBe("2024-02-01");
  });

  it("subtracts days with negative value", () => {
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDays("2024-01-01", -1)).toBe("2023-12-31");
  });

  it("handles zero", () => {
    expect(addDays("2024-06-15", 0)).toBe("2024-06-15");
  });

  it("handles year boundaries", () => {
    expect(addDays("2023-12-31", 1)).toBe("2024-01-01");
    expect(addDays("2024-01-01", -1)).toBe("2023-12-31");
  });
});
